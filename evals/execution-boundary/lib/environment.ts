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

import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
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
  /**
   * How the read of the factory-published environment file ended. The two
   * digests above are `null` for BOTH `"absent"` and `"refused"`, and that
   * is correct — assay recorded no digest either way — but the two are very
   * different claims and must not render alike:
   *
   * - `"absent"` — there is no file. "This machine was never fingerprinted"
   *   is then a fact assay has actually established.
   * - `"refused"` — there IS a file and assay declined to read a digest out
   *   of it (see `environment_file_refusal`). Saying "unfingerprinted
   *   machine" here would be asserting an absence nothing established; the
   *   machine may well be fingerprinted and assay simply cannot tell.
   * - `"read"` — a digest was read.
   *
   * The distinction exists because the refusal is a promise this repo makes
   * out loud (../../../environments/README.md: "assay refuses a version it
   * does not know rather than guessing at the fields"), and a promise kept
   * silently is indistinguishable from one not kept.
   */
  environment_file: "read" | "absent" | "refused";
  /**
   * Why the file was refused, phrased to drop into a console line — e.g.
   * `schema 2 — this build reads schema 1`. `null` unless
   * `environment_file` is `"refused"`.
   */
  environment_file_refusal: string | null;
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
 * Hard cap on the environment file assay will read into memory. The
 * contract (../../../environments/README.md) defines five short scalar
 * fields; a conforming file is a couple of hundred bytes. 16 KiB leaves a
 * factory room to add fields without ever letting an unbounded read happen
 * on assay's side — a `core_digest` is a digest, and a 200 KB one is not a
 * digest whatever else it may be.
 */
const ENVIRONMENT_FILE_MAX_BYTES = 16 * 1024;

/**
 * The outcome of reading the factory-published environment file.
 *
 * The digests are `null` for both `"absent"` and `"refused"` — assay
 * recorded no digest either way, which is the honest answer — but the
 * `status` keeps the two apart, because "there is no file" is an
 * established fact and "there is a file I would not read" is not. See
 * `EnvironmentStamp.environment_file`.
 */
export type EnvironmentFileRead =
  | { status: "absent"; environment_digest: null; environment_provider_digest: null }
  | { status: "refused"; reason: string; environment_digest: null; environment_provider_digest: null }
  | {
      status: "read";
      environment_digest: string;
      environment_provider_digest: string | null;
    };

const ABSENT: EnvironmentFileRead = {
  status: "absent",
  environment_digest: null,
  environment_provider_digest: null,
};

function refused(reason: string): EnvironmentFileRead {
  return { status: "refused", reason, environment_digest: null, environment_provider_digest: null };
}

/** Resolved once here so the reader and its error messages agree on the path. */
export function environmentFilePath(): string {
  // `||`, not `??`: ASSAY_ENVIRONMENT_FILE="" is an unset variable spelled
  // badly (an empty string is not a path), and `??` would dutifully try to
  // open "". Falling back is the only reading of "" that is ever useful.
  return process.env.ASSAY_ENVIRONMENT_FILE || ENVIRONMENT_FILE_DEFAULT;
}

/**
 * Reads the factory-published environment file.
 *
 * NOTHING HERE FAILS THE RUN, and that is a guarantee this function has to
 * earn rather than assert. It is enforced by construction:
 *
 * - the open is `O_NONBLOCK`, so a FIFO (or any other file whose open
 *   blocks for a writer) returns a usable fd instead of hanging the run
 *   forever — the earlier `readFileSync` did hang, indefinitely, which is a
 *   worse outcome than any failure this function was written to tolerate;
 * - the fd is then `fstat`ed and anything that is not a regular file is
 *   refused, so a FIFO/device/directory never reaches a read;
 * - the size is checked against `ENVIRONMENT_FILE_MAX_BYTES` before a byte
 *   is copied, so the read is bounded;
 * - the read is from the SAME fd that was stat'ed, so there is no window in
 *   which the path could be swapped for something else between the check
 *   and the read.
 *
 * Two shapes of "no digest" come back, and the caller must keep them apart:
 * `absent` (no file — every laptop, and the overwhelmingly common case) and
 * `refused` (a file assay declined to read a digest out of: unopenable,
 * not a regular file, oversized, malformed JSON, a `schema` from the
 * future, a missing or non-string `core_digest`).
 *
 * A future schema is refused rather than best-effort parsed. Reading fields
 * out of a format this build does not know is how you end up recording a
 * digest that means something other than what it says, and a wrong identity
 * is worse than an absent one.
 */
export function readEnvironmentFile(path: string = environmentFilePath()): EnvironmentFileRead {
  let fd: number;
  try {
    // O_NONBLOCK is the whole point: opening a FIFO read-only blocks until a
    // writer arrives, and "until a writer arrives" can be never.
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // No file (and "a path component isn't a directory", which is the same
    // claim) is genuine absence. Anything else — EACCES, ELOOP, ENXIO — is a
    // file assay could not read, which is not the same as no file at all.
    if (code === "ENOENT" || code === "ENOTDIR") return ABSENT;
    return refused(`cannot open it (${code ?? "unknown error"})`);
  }

  let raw: string;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) return refused("not a regular file");
    if (stat.size === 0) return refused("empty file");
    if (stat.size > ENVIRONMENT_FILE_MAX_BYTES) {
      return refused(`${stat.size} bytes, over the ${ENVIRONMENT_FILE_MAX_BYTES}-byte cap`);
    }

    const buf = Buffer.alloc(stat.size);
    let got = 0;
    while (got < stat.size) {
      const n = readSync(fd, buf, got, stat.size - got, got);
      if (n === 0) break; // truncated under us; parse whatever arrived
      got += n;
    }
    raw = buf.subarray(0, got).toString("utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return refused(`cannot read it (${code ?? "unknown error"})`);
  } finally {
    try {
      closeSync(fd);
    } catch {
      // Nothing useful to do about a failed close, and it must not be the
      // thing that fails a run this function promised would not fail.
    }
  }

  // A UTF-8 BOM is legal in a file a factory's editor or PowerShell wrote,
  // and JSON.parse rejects it. Refusing a well-formed digest over a byte
  // order mark would be a refusal about nothing.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return refused("not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return refused("not a JSON object");
  }
  const file = parsed as Partial<EnvironmentFile>;

  if (file.schema !== ENVIRONMENT_FILE_SCHEMA) {
    const got =
      file.schema === undefined ? "no schema field" : `schema ${JSON.stringify(file.schema)}`;
    return refused(`${got} — this build reads schema ${ENVIRONMENT_FILE_SCHEMA}`);
  }
  if (typeof file.core_digest !== "string" || file.core_digest.length === 0) {
    return refused("no usable core_digest");
  }

  return {
    status: "read",
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

  const environmentFile = environmentFilePath();
  const file = readEnvironmentFile(environmentFile);

  // One line, on stderr, once per run. The refusal is a promise this repo
  // makes in writing (../../../environments/README.md: "assay refuses a
  // version it does not know rather than guessing at the fields"); a
  // refusal nobody can observe is not a kept promise, it is the same
  // silence as never having checked. stderr rather than stdout so it
  // cannot be mistaken for part of the run's reported result.
  if (file.status === "refused") {
    console.error(
      `assay: refusing the environment file at ${environmentFile} — ${file.reason}. ` +
        "No environment digest recorded for this run; this machine may or may not be fingerprinted.",
    );
  }

  return {
    captured_at: new Date().toISOString(),
    os: platform(),
    arch: arch(),
    kernel_release: release(),
    bun_version: typeof Bun !== "undefined" ? Bun.version : null,
    cortex_commit,
    cortex_dirty,
    environment_digest: file.environment_digest,
    environment_provider_digest: file.environment_provider_digest,
    environment_file: file.status,
    environment_file_refusal: file.status === "refused" ? file.reason : null,
  };
}

/** Short, greppable one-liner for console output. */
export function formatEnvironmentStamp(s: EnvironmentStamp): string {
  const cortex = s.cortex_commit
    ? `cortex@${s.cortex_commit.slice(0, 12)}${s.cortex_dirty ? "-dirty" : ""}`
    : "cortex@none (no checkout found)";
  // Three renderings for three different claims, never one for all of them.
  //
  // "unfingerprinted machine" is a positive assertion — it says assay looked
  // and established there is no factory identity here — so it is reserved
  // for the one case where assay actually established that: no file. When a
  // file was present and refused, assay established nothing about the
  // machine, and the line says so rather than borrowing a claim it has not
  // earned. Both still print (rather than omitting the field), because a run
  // on an unidentified machine should look different from a run that simply
  // did not print anything.
  const env = s.environment_digest
    ? `env@${shortDigest(s.environment_digest)}`
    : s.environment_file === "refused"
      ? `env@unreadable (${s.environment_file_refusal ?? "refused"})`
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
 * The `-> to` half of a digest difference line: what THIS run has to offer
 * for a digest the case recorded.
 *
 * Exists because `formatEnvironmentStamp` learned the absent/refused
 * distinction and the drift renderer did not. That left one run printing two
 * incompatible claims about the same machine — a header reading `env@unreadable
 * (schema 2 — this build reads schema 1)` above per-case lines reading
 * `environment_digest: baseline1111 -> none (this run is on an unfingerprinted
 * machine)`. The second is the exact assertion ../../../environments/README.md
 * forbids: "a refusal means assay knows nothing about this machine's identity,
 * which is not at all the same as knowing it has none." A refused file may
 * well be sitting on a properly fingerprinted machine; assay simply declined
 * to read it, and has established nothing either way.
 *
 * So the same three renderings the header uses, for the same three claims —
 * derived from `environment_file` rather than from the digest being `null`,
 * because `null` is where absent and refused are indistinguishable. Both
 * digest fields share this: neither is read when the file is refused, so
 * neither may report an absence on the strength of it.
 *
 * `absent` is a parameter rather than a constant because the two fields make
 * different claims when the file genuinely is not there. No file means no
 * machine identity at all, which is worth spelling out; the provider half is
 * additionally optional WITHIN a file assay read successfully, so a bare
 * "none" there covers both "no file" and "a factory that published no
 * provider half" — and those really are the same fact about the record.
 *
 * The digest test is truthiness, not `!== null`, for the same reason
 * `normalizeCapturedOn` collapses `""` on the captured side: an empty string
 * is a third spelling of "nothing was recorded", and `shortDigest("")` would
 * render the nonsense `environment_digest: 9f2a3b1c8d4e -> `. `readEnvironmentFile`
 * guards `.length === 0` on both digests so no empty string should reach a
 * stamp — but this module's habit is to harden the render rather than trust
 * that, and matching `formatEnvironmentStamp`'s truthiness keeps the two
 * renderers from disagreeing on an edge either might meet first.
 */
function renderCurrentDigest(
  digest: string | null,
  current: EnvironmentStamp,
  absent: string,
): string {
  if (digest) return shortDigest(digest);
  if (current.environment_file === "refused") {
    return `unreadable (${current.environment_file_refusal ?? "refused"})`;
  }
  return absent;
}

/**
 * Collapses "absent" into "explicitly null" for every nullable field of a
 * case's baseline, so the comparisons below can ask one question instead of
 * two. A field that is missing from the JSON and a field written as `null`
 * are the same claim: nobody recorded this.
 *
 * An EMPTY STRING is the third spelling of the same claim and is collapsed
 * with the other two. `captureEnvironmentStamp` will never produce one — the
 * producer side already guards `.length === 0` on both digests — but a case
 * file is hand-written JSON, and `""` there is a field somebody left blank,
 * not a recording. Counted as recorded it would both inflate the comparable
 * count (letting a case escape the `unpinned` branch on nothing) and render
 * as the nonsense `environment_digest:  -> none`. Applied to every string
 * field, not just the digests: an empty `os` is no more a recording than an
 * empty digest is.
 *
 * `note` is required by the type and left as-is; if a case file is missing it
 * that is a real defect in the case, not something to paper over here.
 */
function normalizeCapturedOn(c: CapturedOnStamp): CapturedOnStamp {
  return {
    date: c.date || null,
    os: c.os || null,
    arch: c.arch || null,
    kernel_release: c.kernel_release || null,
    bun_version: c.bun_version || null,
    cortex_commit: c.cortex_commit || null,
    environment_digest: c.environment_digest || null,
    environment_provider_digest: c.environment_provider_digest || null,
    substrate: c.substrate || null,
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

/**
 * NAMING NOTE (2026-08-23): this kind was `"unknown"` while both READMEs
 * — ../../../environments/README.md and ../README.md — named the same
 * outcome **unpinned**, and the runner printed "UNPINNED baseline" for it.
 * Three names for one concept, in a repo whose entire subject is that a
 * claim and the thing it describes must agree. Renamed in the code rather
 * than in the docs because "unpinned" is the word the concept is actually
 * carried by: it is the term Rob Chuvala's finding used ("cases locked
 * against an unpinned baseline"), the term every case's `note` uses, and
 * the term the runner already printed. "unknown" also actively misleads —
 * it suggests assay could not determine something, when in fact assay
 * determined precisely what happened: nothing was recorded. Same class of
 * fix as the `SubstrateStamp` -> `EnvironmentStamp` rename above, and safe
 * for the same reason: this type is internal to the runner and never
 * serialized into a case file.
 */
export type DriftAssessment =
  | { kind: "unpinned"; reason: string }
  | { kind: "match" }
  | { kind: "drift"; differences: string[] };

/**
 * Compares a case's recorded baseline against the current run's
 * environment stamp and detected substrate. `unpinned` (no field on the
 * case's stamp is populated) is reported distinctly from `drift` (a
 * populated field disagrees) — collapsing the two would hide exactly the
 * silent-baseline problem this module exists to surface. Only fields
 * present on BOTH sides are compared; a case that only ever recorded
 * `date` can't be told it "matches" or "drifted" on arch it never
 * captured.
 *
 * The parameter is typed to admit `null`/`undefined` because the runner
 * genuinely can pass them: `runner.ts` casts case JSON straight to
 * `CaseRecord` without validating it, so a case file with no `captured_on`
 * block at all reaches here as `undefined`. Declaring that impossible does
 * not make it so — it just moves the crash out of the type system's sight.
 */
export function assessDrift(
  capturedRaw: CapturedOnStamp | null | undefined,
  current: EnvironmentStamp,
  currentSubstrate: SubstrateId | null,
): DriftAssessment {
  // The container itself, before its fields. `normalizeCapturedOn` hardens
  // every field of the stamp and none of them matter if the stamp is not
  // there: `undefined.date` throws a TypeError, the runner's loop is not
  // wrapped, and the whole run dies — which is the exact crash class this
  // module was written to fix, reproduced one level up. A case with no
  // baseline at all is not an error, it is the most unpinned a baseline
  // gets, and it is reported as such alongside the cases that at least
  // recorded a date.
  if (typeof capturedRaw !== "object" || capturedRaw === null) {
    return {
      kind: "unpinned",
      reason:
        "this case records no captured_on block at all — not even a date, and not even a note " +
        "saying why — so there is nothing whatsoever to compare this run against",
    };
  }
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

  // WHAT COUNTS AS A PIN, and what merely gets compared. These are two
  // different questions and this list answers only the first.
  //
  // A field belongs here when recording it means the case is pinned to an
  // identity a later run can be held against. `date` and `bun_version` are
  // recorded and compared but deliberately absent: a date is a clock
  // reading, not an identity, and a Bun version does not say which machine.
  //
  // `environment_provider_digest` is absent for the same reason and it is
  // the one that bites. It is the PROVIDER half — by this module's own
  // docstring above, "a difference here is a fact about the provider, not
  // evidence of drift", and by the contract (../../../environments/README.md)
  // it is expected to differ between providers for the identical
  // environment definition. A case whose baseline recorded only that half
  // has pinned nothing about the machine, yet counting it here let such a
  // case clear this gate and be reported `match` — a positive claim of
  // sameness resting entirely on a field the module says is not evidence of
  // sameness. It is still compared below, and still reported when it moves;
  // it just cannot, alone, make a case count as pinned.
  const comparableCount =
    (["os", "arch", "kernel_release", "cortex_commit", "environment_digest"] as const).filter(
      (f) => captured[f] !== null,
    ).length + (captured.substrate !== null ? 1 : 0);

  if (comparableCount === 0) {
    // Says what WAS recorded, so the line is never a flat "nothing" over a
    // case that did record something which merely does not pin it. A
    // provider-half-only baseline is the case worth naming out loud: it
    // looks like an identity and is not one.
    const recorded = [
      captured.date ? `the date (${captured.date})` : null,
      captured.bun_version ? `a bun version (${captured.bun_version})` : null,
      captured.environment_provider_digest
        ? `the provider half of a digest (${shortDigest(captured.environment_provider_digest)})`
        : null,
    ].filter((x): x is string => x !== null);
    const what = recorded.length > 0 ? recorded.join(" and ") : "nothing";
    const providerNote = captured.environment_provider_digest
      ? " The provider half names which backend built a machine, not which machine, so it pins nothing on its own."
      : "";
    return {
      kind: "unpinned",
      reason:
        `captured_on records ${what}, and no environment or substrate identity ` +
        `(no environment_digest, so no factory-built machine to rebuild and compare against) — ` +
        `this case is locked against an unpinned baseline.${providerNote}`,
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
    const to = renderCurrentDigest(
      current.environment_digest,
      current,
      "none (this run is on an unfingerprinted machine)",
    );
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
    const to = renderCurrentDigest(current.environment_provider_digest, current, "none");
    differences.push(`environment_provider_digest (provider half): ${from} -> ${to}`);
  }
  if (captured.substrate !== null && captured.substrate !== currentSubstrate) {
    differences.push(`substrate: ${captured.substrate} -> ${currentSubstrate ?? "unknown"}`);
  }

  return differences.length > 0 ? { kind: "drift", differences } : { kind: "match" };
}
