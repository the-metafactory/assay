// Substrate identity stamp — what a run of this corpus was executed
// against. Exists because a result without its substrate is not a result
// (README, "Substrates" section) — and because rounds 1 and 2 were locked
// into this corpus with NO substrate recorded at all. Rob Chuvala (NWS)
// caught it: "what substrate were those captured on? If we didn't record
// it, we have cases locked against an unpinned baseline." This module is
// the fix. See CaseRecord.captured_on in ./types.ts for how a case records
// its own baseline, and runner.ts for the drift report.
//
// Field choice favors content-addressable/immutable identifiers over
// mutable ones (Vincent Zontini's SAN-hardware-testing method, ideas/): a
// commit SHA over a branch name, a digest over a tag. `cortex_commit` is
// the field that matters most — every check in this corpus asserts
// against cortex's real code, so that commit is what a case is actually
// compared against. OS/arch/kernel/bun matter less for what this corpus's
// checks currently do (mostly unit-import or spawn-hook against cortex's
// TS, which is largely substrate-independent) but cost one syscall each to
// record, and a future scenario/gate in this repo may depend on them.
//
// What this deliberately does NOT capture: hostname, username, home
// directory, or any other machine-identifying value. This is a public
// repo (README, "Confidentiality"); os/arch/kernel/bun-version/commit-SHA
// are not personally identifying, a hostname is borderline-identifying and
// adds no verification value over the fields already captured, so it's
// left out rather than justified in.

import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { findCortexRepo } from "./cortex-repo";

export interface SubstrateStamp {
  /**
   * Wall-clock time the stamp was captured, ISO 8601. Informational only —
   * a clock reading is not an identity and is never itself compared for
   * drift (two runs one minute apart on the same substrate are not
   * "drifted").
   */
  captured_at: string;
  /** `process.platform` — "darwin", "linux", ... */
  os: string;
  /** `process.arch` — "arm64", "x64", ... */
  arch: string;
  /**
   * `os.release()` — kernel version string. Mutable (an OS update changes
   * it) but not attacker- or author-controlled, unlike a branch name.
   */
  kernel_release: string;
  /** `Bun.version`, when run under Bun; `null` under a different runtime. */
  bun_version: string | null;
  /**
   * The cortex checkout's HEAD commit SHA — full 40 hex chars,
   * content-addressable. This is the field that matters most: cases assert
   * against cortex's real code, so this is what a case is actually
   * compared against. `null` when no cortex checkout was found (checks
   * that need one skip cleanly; there is nothing to stamp).
   */
  cortex_commit: string | null;
  /**
   * Whether the cortex checkout had uncommitted changes at capture time. A
   * clean SHA is an exact pin; a dirty one means the working tree the
   * checks actually read from may differ from what the SHA alone
   * promises — worth knowing, since a digest that can silently drift from
   * its own working tree is exactly the "tag, not digest" failure this
   * module exists to avoid. `null` when no checkout was found.
   */
  cortex_dirty: boolean | null;
}

function tryGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    // Not a git checkout, git not on PATH, or the command failed for some
    // other reason — all of these are "we don't know", not an error worth
    // failing a run over. The caller sees `null` and reports it as such.
    return null;
  }
}

export function captureSubstrateStamp(): SubstrateStamp {
  const cortexRepo = findCortexRepo();
  let cortex_commit: string | null = null;
  let cortex_dirty: boolean | null = null;

  if (cortexRepo) {
    cortex_commit = tryGit(cortexRepo, ["rev-parse", "HEAD"]);
    const status = tryGit(cortexRepo, ["status", "--porcelain"]);
    cortex_dirty = status === null ? null : status.length > 0;
  }

  return {
    captured_at: new Date().toISOString(),
    os: platform(),
    arch: arch(),
    kernel_release: release(),
    bun_version: typeof Bun !== "undefined" ? Bun.version : null,
    cortex_commit,
    cortex_dirty,
  };
}

/** Short, greppable one-liner for console output. */
export function formatStamp(s: SubstrateStamp): string {
  const cortex = s.cortex_commit
    ? `cortex@${s.cortex_commit.slice(0, 12)}${s.cortex_dirty ? "-dirty" : ""}`
    : "cortex@none (no checkout found)";
  return `${s.os}/${s.arch}  kernel ${s.kernel_release}  bun ${s.bun_version ?? "unknown"}  ${cortex}`;
}

/**
 * The substrate identity present when a case's expectation was
 * established — recorded ON THE CASE, at authoring/verification time, and
 * never auto-updated by a later run (that would defeat the point: it must
 * reflect what the case was actually compared against, not what happens to
 * be true today). Every field is nullable because honesty about what
 * wasn't recorded matters more than a complete-looking stamp — see the
 * backfill on cases/r1-*.json and cases/r2-*.json for the worked example:
 * we know the corpus's commit date, nothing else, and the `note` says so
 * instead of a field silently defaulting to something that looks like data.
 */
export interface CapturedOnStamp {
  /** YYYY-MM-DD, if known. */
  date: string | null;
  os: string | null;
  arch: string | null;
  kernel_release: string | null;
  bun_version: string | null;
  cortex_commit: string | null;
  /**
   * Required whenever any field above is `null` (i.e. almost always for
   * now): says what's actually known, where it came from, and why the rest
   * isn't reconstructable. Never leave a null field unexplained.
   */
  note: string;
}

export type DriftAssessment =
  | { kind: "unknown"; reason: string }
  | { kind: "match" }
  | { kind: "drift"; differences: string[] };

/**
 * Compares a case's recorded baseline against the current run's stamp.
 * `unknown` (no field on the case's stamp is populated) is reported
 * distinctly from `drift` (a populated field disagrees) — collapsing the
 * two would hide exactly the silent-baseline problem this module exists to
 * surface. Only fields present on BOTH sides are compared; a case that
 * only ever recorded `date` can't be told it "matches" or "drifted" on
 * arch it never captured.
 */
export function assessDrift(captured: CapturedOnStamp, current: SubstrateStamp): DriftAssessment {
  const comparable = (
    ["os", "arch", "kernel_release", "cortex_commit"] as const
  ).filter((f) => captured[f] !== null);

  if (comparable.length === 0) {
    const dateNote = captured.date ? `the date (${captured.date})` : "nothing";
    return {
      kind: "unknown",
      reason: `captured_on records ${dateNote} and no substrate identity — this case is locked against an unpinned baseline`,
    };
  }

  const differences: string[] = [];
  if (captured.os !== null && captured.os !== current.os) {
    differences.push(`os: ${captured.os} -> ${current.os}`);
  }
  if (captured.arch !== null && captured.arch !== current.arch) {
    differences.push(`arch: ${captured.arch} -> ${current.arch}`);
  }
  if (captured.kernel_release !== null && captured.kernel_release !== current.kernel_release) {
    differences.push(`kernel_release: ${captured.kernel_release} -> ${current.kernel_release}`);
  }
  if (captured.cortex_commit !== null && captured.cortex_commit !== current.cortex_commit) {
    const from = captured.cortex_commit.slice(0, 12);
    const to = current.cortex_commit ? current.cortex_commit.slice(0, 12) : "none";
    differences.push(`cortex_commit: ${from} -> ${to}`);
  }

  return differences.length > 0 ? { kind: "drift", differences } : { kind: "match" };
}
