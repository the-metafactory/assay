// Substrate identity — the CODING HARNESS a session runs on (ecosystem
// vocabulary: compass CONTEXT-MAP.md, "substrate — the host runtime a
// session runs on (Claude Code, Codex, Cursor, Pi.dev). soma owns it."),
// as distinct from ./environment.ts (the machine: OS/arch/kernel/bun) and
// from `requires` on ./types.ts (what a case's verification needs
// present, e.g. `requires-cortex-checkout`).
//
// THE GAP THIS CLOSES: every case in this corpus was in fact captured
// while running under Claude Code, and until now nothing recorded that.
// It genuinely matters — a boundary check that holds under one coding
// harness need not hold under another: different harnesses issue
// different tool calls, expand paths differently, and open files by
// different routes. That is a real variable this corpus's results depend
// on, not a detail. (This module used to occupy `substrate.ts` under the
// wrong meaning — see ./environment.ts's naming note.)
//
// DETECTION, HONESTLY: `CLAUDECODE=1` is the one signal checked here,
// because it is the one this repo can actually stand behind — Claude Code
// sets it in every subprocess it spawns (confirmed in Claude Code's own
// changelog: "Stdio MCP server subprocesses now receive
// CLAUDE_CODE_SESSION_ID and CLAUDECODE=1 in their environment"; used the
// same way elsewhere in this ecosystem, e.g. PAI's nested-session guards).
// No comparably reliable env var/marker is known here for the other
// `SubstrateId` values (bus-peer, openai-codex, cursor, gemini, mistral,
// pi-dev, agent-team, api-agent) — add a check for one only when it's
// actually confirmed, never guessed. Absent a signal, this returns
// `unknown` rather than defaulting to "claude-code" — the same discipline
// the `captured_on` backfill uses for os/arch/kernel/etc: a plausible
// guess is not a record.

/**
 * Mirrors cortex's `HarnessId` (src/common/substrates/types.ts) — the
 * closed enum cortex's own dispatch layer uses for the same concept. Kept
 * as a local literal union rather than an import so this repo stays
 * runnable without a cortex checkout (most checks here still need one,
 * but substrate detection itself should not). This union CAN drift from
 * cortex's if `HarnessId` grows a new member there — that is a known,
 * accepted seam, not a hidden one.
 */
export type SubstrateId =
  | "claude-code"
  | "bus-peer"
  | "openai-codex"
  | "cursor"
  | "gemini"
  | "mistral"
  | "pi-dev"
  | "agent-team"
  | "api-agent";

export interface SubstrateDetection {
  /** `null` means genuinely unknown — never a guessed default. */
  substrate: SubstrateId | null;
  /** How this was determined, or why it couldn't be. Always populated. */
  note: string;
}

export function detectSubstrate(): SubstrateDetection {
  if (process.env.CLAUDECODE === "1") {
    return {
      substrate: "claude-code",
      note: "inferred from CLAUDECODE=1 in the process environment (Claude Code sets this in every subprocess it spawns).",
    };
  }
  return {
    substrate: null,
    note:
      "no reliable substrate signal found in the environment. Only Claude Code's " +
      "CLAUDECODE=1 is currently checked here — no confirmed env-var/marker is known " +
      "for the other SubstrateId values (bus-peer, openai-codex, cursor, gemini, " +
      "mistral, pi-dev, agent-team, api-agent). Recorded as unknown rather than " +
      "assumed, per this corpus's no-guessing rule.",
  };
}

/** Short, greppable one-liner for console output. */
export function formatSubstrate(d: SubstrateDetection): string {
  return d.substrate ?? "unknown";
}
