// Environment identity stamp — the MACHINE a run of this corpus was
// executed on (OS/arch/kernel/Bun version) and the cortex checkout it ran
// against. Exists because a result without its environment is not a
// result (README, "Environments" section) — and because rounds 1 and 2
// were locked into this corpus with NO environment recorded at all. Rob
// Chuvala (NWS) caught it: "what substrate were those captured on? If we
// didn't record it, we have cases locked against an unpinned baseline."
// This module is the fix. See CaseRecord.captured_on in ./types.ts for
// how a case records its own baseline, and runner.ts for the drift
// report.
//
// NAMING NOTE (2026-07-29): this module was originally named
// `substrate.ts` and its stamp `SubstrateStamp`. That was a
// ubiquitous-language error — the ecosystem's CONTEXT-MAP.md reserves
// "substrate" for the coding harness a session runs on (Claude Code,
// Codex, Cursor, Pi.dev; soma owns the word). What this module actually
// captures is a different concept, the machine, so it is named
// `environment` throughout. See ./substrate.ts for the concept this
// module's old name wrongly claimed: the actual coding-harness identity.
//
// Field choice favors content-addressable/immutable identifiers over
// mutable ones (Vincent Zontini's SAN-hardware-testing method, ideas/): a
// commit SHA over a branch name, a digest over a tag. `cortex_commit` is
// the field that matters most — every check in this corpus asserts
// against cortex's real code, so that commit is what a case is actually
// compared against. OS/arch/kernel/bun matter less for what this corpus's
// checks currently do (mostly unit-import or spawn-hook against cortex's
// TS, which is largely environment-independent) but cost one syscall each
// to record, and a future scenario/gate in this repo may depend on them.
//
// What this deliberately does NOT capture: hostname, username, home
// directory, or any other machine-identifying value. This is a public
// repo (README, "Confidentiality"); os/arch/kernel/bun-version/commit-SHA
// are not personally identifying, a hostname is borderline-identifying and
// adds no verification value over the fields already captured, so it's
// left out rather than justified in.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { findCortexRepo } from "./cortex-repo";
import type { SubstrateId } from "./substrate";

export interface EnvironmentStamp {
  /**
   * Wall-clock time the stamp was captured, ISO 8601. Informational only —
   * a clock reading is not an identity and is never itself compared for
   * drift (two runs one minute apart on the same environment are not
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
  /**
   * The provider-invariant half of the machine's fingerprint digest, as
   * published by the infrastructure factory that built it — see
   * ../../../environments/README.md for the contract and
   * https://github.com/the-metafactory/crucible for the producer.
   *
   * This is the field that turns "which machine" from a description into an
   * identity. `os`/`arch`/`kernel_release` describe a machine the way a
   * passport describes a face; this is content-addressed, so two runs
   * either agree or they do not.
   *
   * `null` on any machine no factory fingerprinted — a laptop, CI, a box
   * someone built by hand. That null is the honest answer and is reported
   * as an unpinned baseline, never defaulted to something that looks like
   * data.
   */
  environment_digest: string | null;
  /**
   * The provider-specific half: kernel flavour, image identity, mirror
   * URIs, cloud-init datasource. Expected to differ between providers for
   * the same environment definition, which is exactly why it is digested
   * apart from the core — a difference here is a fact about the provider,
   * not evidence of drift.
   *
   * Recorded so the honest differences are on the record. Compared for
   * drift like any other field, but a mismatch here reads very differently
   * from a mismatch in `environment_digest`. `null` when the factory
   * published no provider half, or when there is no factory.
   */
  environment_provider_digest: string | null;
}

/**
 * What a factory writes onto a machine it has fingerprinted. The full
 * field-by-field contract is ../../../environments/README.md; this type is
 * only the shape assay reads back.
 */
interface EnvironmentFile {
  schema: number;
  core_digest: string;
  provider_digest?: string | null;
  provider?: string | null;
  definition?: string | null;
}

/** Where a factory publishes the digest, per the contract. */
const ENVIRONMENT_FILE_DEFAULT = "/etc/assay/environment.json";

/** The only `schema` value this build knows how to read. */
const ENVIRONMENT_FILE_SCHEMA = 1;

/**
 * Reads the factory-published environment file, or returns nulls.
 *
 * Every failure path is the same answer — "we don't know" — and none of
 * them fails the run: no file (the overwhelmingly common case, i.e. every
 * laptop), unreadable, malformed JSON, a `schema` from the future, a
 * missing or non-string `core_digest`.
 *
 * A future schema is refused rather than best-effort parsed. Reading fields
 * out of a format this build does not know is how you end up recording a
 * digest that means something other than what it says, and a wrong identity
 * is worse than an absent one.
 */
function readEnvironmentFile(): {
  environment_digest: string | null;
  environment_provider_digest: string | null;
} {
  const path = process.env.ASSAY_ENVIRONMENT_FILE ?? ENVIRONMENT_FILE_DEFAULT;
  const absent = { environment_digest: null, environment_provider_digest: null };

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return absent;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return absent;
  }

  if (typeof parsed !== "object" || parsed === null) return absent;
  const file = parsed as Partial<EnvironmentFile>;

  if (file.schema !== ENVIRONMENT_FILE_SCHEMA) return absent;
  if (typeof file.core_digest !== "string" || file.core_digest.length === 0) return absent;

  return {
    environment_digest: file.core_digest,
    environment_provider_digest:
      typeof file.provider_digest === "string" && file.provider_digest.length > 0
        ? file.provider_digest
        : null,
  };
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

export function captureEnvironmentStamp(): EnvironmentStamp {
  const cortexRepo = findCortexRepo();
  let cortex_commit: string | null = null;
  let cortex_dirty: boolean | null = null;

  if (cortexRepo) {
    cortex_commit = tryGit(cortexRepo, ["rev-parse", "HEAD"]);
    const status = tryGit(cortexRepo, ["status", "--porcelain"]);
    cortex_dirty = status === null ? null : status.length > 0;
  }

  const { environment_digest, environment_provider_digest } = readEnvironmentFile();

  return {
    captured_at: new Date().toISOString(),
    os: platform(),
    arch: arch(),
    kernel_release: release(),
    bun_version: typeof Bun !== "undefined" ? Bun.version : null,
    cortex_commit,
    cortex_dirty,
    environment_digest,
    environment_provider_digest,
  };
}

/** Short, greppable one-liner for console output. */
export function formatEnvironmentStamp(s: EnvironmentStamp): string {
  const cortex = s.cortex_commit
    ? `cortex@${s.cortex_commit.slice(0, 12)}${s.cortex_dirty ? "-dirty" : ""}`
    : "cortex@none (no checkout found)";
  // Says "unfingerprinted" rather than omitting the field. A run on an
  // unidentified machine should look different from a run that simply did
  // not print anything.
  const env = s.environment_digest
    ? `env@${shortDigest(s.environment_digest)}`
    : "env@none (unfingerprinted machine)";
  return `${s.os}/${s.arch}  kernel ${s.kernel_release}  bun ${s.bun_version ?? "unknown"}  ${cortex}  ${env}`;
}

/**
 * `sha256:9f2a...` -> `9f2a3b1c8d4e`. Keeps the algorithm prefix out of the
 * console line while leaving enough hex to be greppable against the full
 * value in a case file.
 */
function shortDigest(d: string): string {
  const hex = d.includes(":") ? d.slice(d.indexOf(":") + 1) : d;
  return hex.slice(0, 12);
}

/**
 * Collapses "absent" into "explicitly null" for every nullable field of a
 * case's baseline, so the comparisons below can ask one question instead of
 * two. A field that is missing from the JSON and a field written as `null`
 * are the same claim: nobody recorded this.
 *
 * `note` is required by the type and left as-is; if a case file is missing it
 * that is a real defect in the case, not something to paper over here.
 */
function normalizeCapturedOn(c: CapturedOnStamp): CapturedOnStamp {
  return {
    date: c.date ?? null,
    os: c.os ?? null,
    arch: c.arch ?? null,
    kernel_release: c.kernel_release ?? null,
    bun_version: c.bun_version ?? null,
    cortex_commit: c.cortex_commit ?? null,
    environment_digest: c.environment_digest ?? null,
    environment_provider_digest: c.environment_provider_digest ?? null,
    substrate: c.substrate ?? null,
    note: c.note,
  };
}

/**
 * The environment AND substrate identity present when a case's
 * expectation was established — recorded ON THE CASE, at authoring/
 * verification time, and never auto-updated by a later run (that would
 * defeat the point: it must reflect what the case was actually compared
 * against, not what happens to be true today). Every field is nullable
 * because honesty about what wasn't recorded matters more than a
 * complete-looking stamp — see the backfill on cases/r1-*.json and
 * cases/r2-*.json for the worked example: we know the corpus's commit
 * date, nothing else, and the `note` says so instead of a field silently
 * defaulting to something that looks like data.
 *
 * This type deliberately spans two concepts this repo otherwise keeps
 * distinct (environment = the machine, substrate = the coding harness —
 * see ./substrate.ts): a case's baseline legitimately needs both, because
 * "what was this compared against" is incomplete without either half.
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
   * The factory-published environment digest present when this case's
   * expectation was established (see `EnvironmentStamp.environment_digest`
   * and ../../../environments/README.md). `null` for every case authored
   * before an infrastructure factory existed to publish one — which is all
   * of them at the time this field landed, and the `note` says so.
   *
   * A case whose baseline records this is pinned to a machine identity that
   * can be rebuilt and checked. A case whose baseline does not is the
   * unpinned baseline this corpus was created to stop producing.
   */
  environment_digest: string | null;
  /** The provider half, when recorded. See `EnvironmentStamp.environment_provider_digest`. */
  environment_provider_digest: string | null;
  /**
   * The coding harness this case's expectation was established under
   * (see ./substrate.ts). `null` when not recorded — which, honestly, is
   * every case backfilled before this field existed (see `note`).
   */
  substrate: SubstrateId | null;
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
 * Compares a case's recorded baseline against the current run's
 * environment stamp and detected substrate. `unknown` (no field on the
 * case's stamp is populated) is reported distinctly from `drift` (a
 * populated field disagrees) — collapsing the two would hide exactly the
 * silent-baseline problem this module exists to surface. Only fields
 * present on BOTH sides are compared; a case that only ever recorded
 * `date` can't be told it "matches" or "drifted" on arch it never
 * captured.
 */
export function assessDrift(
  capturedRaw: CapturedOnStamp,
  current: EnvironmentStamp,
  currentSubstrate: SubstrateId | null,
): DriftAssessment {
  // Case files are JSON read off disk, so a field this build knows about can
  // simply be ABSENT from a file written before it existed — and `undefined`
  // is not `null`. Reading absence as "recorded" is how you get a comparison
  // against a value that was never there; the crash it caused when this field
  // first landed was the lucky version of that bug.
  //
  // Absent and explicitly-null mean the same thing here — nobody recorded it —
  // so they are collapsed once, at the boundary, rather than at each of the
  // seven comparisons below.
  const captured = normalizeCapturedOn(capturedRaw);

  const comparableCount =
    (
      [
        "os",
        "arch",
        "kernel_release",
        "cortex_commit",
        "environment_digest",
        "environment_provider_digest",
      ] as const
    ).filter((f) => captured[f] !== null).length + (captured.substrate !== null ? 1 : 0);

  if (comparableCount === 0) {
    const dateNote = captured.date ? `the date (${captured.date})` : "nothing";
    return {
      kind: "unknown",
      reason: `captured_on records ${dateNote} and no environment or substrate identity (no environment_digest, so no factory-built machine to rebuild and compare against) — this case is locked against an unpinned baseline`,
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
  // Reported before substrate and after cortex_commit deliberately: this is
  // the strongest identity on the record, so when several fields disagree it
  // should be the one a reader sees first among the machine-level ones.
  if (
    captured.environment_digest !== null &&
    captured.environment_digest !== current.environment_digest
  ) {
    const from = shortDigest(captured.environment_digest);
    const to = current.environment_digest
      ? shortDigest(current.environment_digest)
      : "none (this run is on an unfingerprinted machine)";
    differences.push(`environment_digest: ${from} -> ${to}`);
  }
  // A provider-half mismatch on its own is a different statement from a core
  // mismatch: the same environment definition, built by a different backend.
  // Labelled so a reader is not left to infer which half moved.
  if (
    captured.environment_provider_digest !== null &&
    captured.environment_provider_digest !== current.environment_provider_digest
  ) {
    const from = shortDigest(captured.environment_provider_digest);
    const to = current.environment_provider_digest
      ? shortDigest(current.environment_provider_digest)
      : "none";
    differences.push(`environment_provider_digest (provider half): ${from} -> ${to}`);
  }
  if (captured.substrate !== null && captured.substrate !== currentSubstrate) {
    differences.push(`substrate: ${captured.substrate} -> ${currentSubstrate ?? "unknown"}`);
  }

  return differences.length > 0 ? { kind: "drift", differences } : { kind: "match" };
}
