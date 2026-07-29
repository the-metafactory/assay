// Case schema for the execution-boundary corpus. See ../README.md for the
// field-by-field rationale; this file is the type the runner and every
// case JSON file are checked against.

import type { CapturedOnStamp } from "./environment";

export type CaseStatus = "fixed" | "open" | "accepted-residual" | "unverified";

export type VerificationMethod =
  | "unit-import" // imports the real exported-for-tests function(s) from the cortex checkout
  | "spawn-hook" // spawns the real hook script as a subprocess, feeds it stdin/env/cwd
  | "doc-grep" // greps the cortex checkout for a durable, cited phrase/marker
  | "none"; // no automated verification exists (see case.verification.note for why)

export type Requirement =
  | "requires-cortex-checkout" // needs a local cortex clone (see lib/cortex-repo.ts)
  | "requires-live-session" // needs a real `claude` CLI session (unrunnable: quota exhausted until 2026-07-29)
  | "any"; // no special requirement

export interface ReproRecord {
  /** The repro/finding text, verbatim from its source — never paraphrased. */
  verbatim: string;
  /** Where this exact text was captured (doc path, or gh api comment ref). */
  source: string;
  /**
   * What this repro needs present to run — a dependency, not an identity.
   * Not to be confused with `CaseRecord.captured_on.substrate` (the coding
   * harness, lib/substrate.ts) or `.environment` fields (the machine,
   * lib/environment.ts) — those name WHAT something IS; this names WHAT IT
   * NEEDS.
   */
  requires: Requirement;
  /** What happened when (if) this repro was actually run. */
  outcome?: string;
}

export interface CaseRecord {
  id: string; // e.g. "r1-f1", "r2-f4" — namespaced by round, see README
  round: 1 | 2;
  /** The finding's own label in its source round (both rounds independently use F1-F6). */
  source_id: string;
  title: string;
  /** Severity as the reviewer stated it — not re-rated by this corpus. */
  severity: string;
  provenance: {
    found_by: string;
    date: string; // YYYY-MM-DD
    source: string; // doc path or gh api ref this finding's text was pulled from
  };
  /** The finding, verbatim (or lightly excerpted with ellipses marked) from its source. */
  finding: string;
  /** One or more repro records — the original review's repro (often
   *  "not attempted"), plus any follow-up repro cortex ran itself. */
  repros: ReproRecord[];
  /**
   * The environment AND substrate identity present when THIS CASE's
   * expectation was established — not when it was last run (see
   * lib/environment.ts, lib/substrate.ts). The existing r1-f1..r1-f6 /
   * r2-f1..r2-f6 cases were backfilled: their real capture-time
   * environment and substrate were never recorded, so most fields here
   * are honestly `null` rather than guessed. A case authored from this
   * point forward should set this from `captureEnvironmentStamp()` +
   * `detectSubstrate()` at the time its check first locks in.
   */
  captured_on: CapturedOnStamp;
  /** What correct looks like, stated so it can be refuted. */
  expected: string;
  status: CaseStatus;
  fix: {
    pr: number | null;
    commit: string | null;
    summary: string;
  } | null;
  verification: {
    method: VerificationMethod;
    /** What this case's verification needs present to run — see ReproRecord.requires. */
    requires: Requirement;
    /** Relative path (from evals/execution-boundary/) to the check module, or null. */
    check: string | null;
    note: string;
  };
  notes?: string;
}

/** What a check module (checks/<id>.check.ts) must export. */
export type CheckOutcome = "pass" | "fail" | "skip";

export interface CheckResult {
  outcome: CheckOutcome;
  detail: string;
}

export type CheckFn = () => Promise<CheckResult>;
