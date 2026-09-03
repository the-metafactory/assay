// Re-establishment helper — turns THIS RUN's live environment stamp into
// ready-to-paste `captured_on` blocks, one per case. Print-only, by design
// and by contract (assay#36): this module NEVER writes a case file. A
// baseline moves when a human pastes the block, reads the diff, and
// commits it — the honest-null discipline survives precisely because the
// last step stays human.
//
// Why a helper at all, instead of 12 hand edits: the values being moved
// are 64-hex-char digests and a 40-char commit SHA. Hand-transcribing
// those is how a baseline ends up pinned to a typo — an identity that
// matches nothing, which is worse than no identity because it LOOKS like
// one. Printing from the live stamp removes transcription as a failure
// mode while changing nothing about who decides.
//
// Why it refuses instead of printing nulls: a re-established baseline
// exists to pin a rebuildable machine identity and the cortex code the
// checks actually ran against. On a machine where either half is missing,
// the only block this helper could print is a fresh unpinned baseline
// wearing a re-establishment note — the exact artifact this corpus was
// built to stop producing. So every value in a printed block is a real,
// captured reading; when one can't be captured, the output is a refusal
// that says why, never a guess (same rule as lib/substrate.ts and the
// original backfill).

import type { EnvironmentStamp } from "./environment";
import { CORTEX_CHECKOUT_HINT } from "./cortex-repo";
import type { SubstrateDetection } from "./substrate";

export interface ReEstablishInput {
  stamp: EnvironmentStamp;
  substrate: SubstrateDetection;
  /** The run receipt URL every printed note must cite. `null` = not given. */
  receipt: string | null;
  /** The case ids the blocks are being printed for (already filtered). */
  caseIds: string[];
}

export type ReEstablishResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export function buildReEstablishment(input: ReEstablishInput): ReEstablishResult {
  const { stamp, substrate, receipt, caseIds } = input;

  // A note that cites no receipt is a claim with no evidence behind it —
  // and a placeholder in printed output has a way of getting committed.
  if (!receipt || receipt.trim().length === 0) {
    return {
      ok: false,
      reason:
        "--re-establish requires --receipt <url>. Every re-established note must cite " +
        "the run receipt it is answerable to (who ran it, on what, validated where); " +
        "printing a block with a placeholder would invite committing a baseline that " +
        "cites nothing.",
    };
  }

  // No cortex checkout → the checks this stamp would vouch for cannot have
  // run against cortex's real code on this machine. There is no
  // expectation here to re-establish.
  if (stamp.cortex_commit === null) {
    return {
      ok: false,
      reason:
        "no cortex checkout found — this corpus's cases assert against cortex's real " +
        "code, so a baseline captured without one would pin nothing any check actually " +
        `ran against. ${CORTEX_CHECKOUT_HINT}`,
    };
  }

  // A dirty checkout means the SHA alone does not pin the working tree the
  // checks read — the "tag, not digest" failure lib/environment.ts exists
  // to avoid. `null` (couldn't determine) is refused for the same reason:
  // unknown-clean is not clean.
  if (stamp.cortex_dirty !== false) {
    const why =
      stamp.cortex_dirty === true
        ? "has uncommitted changes"
        : "cleanliness could not be determined (git status failed)";
    return {
      ok: false,
      reason:
        `the cortex checkout at ${stamp.cortex_commit.slice(0, 12)} ${why} — the SHA ` +
        "alone would not pin the working tree the checks actually read from. Commit or " +
        "stash, re-run the corpus, then re-establish.",
    };
  }

  // No factory identity → nothing to pin. The absent/refused distinction
  // is kept here for the same reason lib/environment.ts keeps it
  // everywhere else: they are different claims and get different refusals.
  if (stamp.environment_file === "absent") {
    return {
      ok: false,
      reason:
        "no factory-published environment file on this machine (env@none — a laptop, " +
        "CI, or a hand-built box). A re-established baseline exists to pin a machine " +
        "identity that can be rebuilt and checked; a block printed here would be a " +
        "fresh unpinned baseline wearing a re-establishment note. Run this on a " +
        "factory-built VM.",
    };
  }
  if (stamp.environment_file === "refused") {
    return {
      ok: false,
      reason:
        `the environment file exists but was refused (${stamp.environment_file_refusal ?? "no reason recorded"}) — ` +
        "assay knows nothing about this machine's identity, which is not the same as " +
        "knowing it has none. Fix the file (or this build's schema gap) rather than " +
        "printing a block without a digest.",
    };
  }
  // status === "read" guarantees a core digest; guard anyway so a future
  // refactor cannot print a block with a null where an identity belongs.
  if (stamp.environment_digest === null) {
    return { ok: false, reason: "environment file read but no core digest captured — refusing." };
  }

  const date = stamp.captured_at.slice(0, 10);

  const substrateSentence =
    substrate.substrate === null
      ? "substrate is null because no coding-harness signal was detected at capture " +
        "time (the runner renders this as 'unknown') — recorded as null rather than " +
        "guessed, per this corpus's no-guessing rule."
      : `substrate '${substrate.substrate}' was detected at capture time: ${substrate.note}`;

  const note =
    `Re-established ${date}: every field above is this run's real EnvironmentStamp, ` +
    `captured live and printed by the runner's --re-establish helper (which only ` +
    `prints; a human pastes, reviews the diff, and commits) — stamp captured ` +
    `${stamp.captured_at}. Run receipt: ${receipt}. ${substrateSentence}`;

  // The exact shape of CapturedOnStamp (lib/environment.ts) — field for
  // field, no more and no less, so the paste is the whole edit.
  const block = JSON.stringify(
    {
      date,
      os: stamp.os,
      arch: stamp.arch,
      kernel_release: stamp.kernel_release,
      bun_version: stamp.bun_version,
      cortex_commit: stamp.cortex_commit,
      environment_digest: stamp.environment_digest,
      environment_provider_digest: stamp.environment_provider_digest,
      substrate: substrate.substrate,
      note,
    },
    null,
    2,
  );

  const header =
    `--re-establish: ${caseIds.length} case(s). Paste each block below as that ` +
    "case's \"captured_on\" value. This helper never writes case files — the " +
    "commit, and the decision to move each baseline, stay yours.";
  const sections = caseIds.map((id) => `── ${id} ──\n${block}`);
  return { ok: true, text: [header, ...sections].join("\n\n") };
}
