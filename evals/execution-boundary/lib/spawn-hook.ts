// Spawn a cortex PreToolUse hook script exactly as Claude Code invokes it —
// stdin carries the tool-call JSON, env carries the guard's own config vars,
// `cwd` is the invoking session's working directory — and parse its stdout
// per the shared hook I/O contract both path-guard.hook.ts and
// bash-guard.hook.ts document:
//
//   {"continue": true}                                            — pass
//   {"hookSpecificOutput":{"permissionDecision":"allow", ...}}     — grant
//   {"hookSpecificOutput":{"permissionDecision":"deny", ...}}      — deny
//
// This is a black-box, ground-truth test: it runs the actual hook binary,
// not a reimplementation of its logic (assay practice #2).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The hooks' best-effort telemetry (emitBlockEvent) writes JSONL under
// CORTEX_EVENTS_DIR (default `~/.claude/events`, cortex#1908/#1870). Point it
// at a scratch dir by default so running this corpus never touches a real
// developer's actual ~/.claude/events — one scratch dir for the whole
// process, created lazily on first spawn.
let scratchEventsDir: string | undefined;
function defaultEventsDir(): string {
  scratchEventsDir ??= mkdtempSync(join(tmpdir(), "assay-eb-events-"));
  return scratchEventsDir;
}

export interface SpawnHookResult {
  decision: "allow" | "deny" | "continue" | "unknown";
  reason: string;
  raw: string;
  exitCode: number;
}

export interface SpawnHookOptions {
  /** Root of the cortex checkout (from findCortexRepo()). */
  cortexRepo: string;
  /** Path to the hook script, relative to the cortex repo root. */
  hookRelPath: string;
  /** JSON-serializable PreToolUse payload written to the hook's stdin. */
  stdin: unknown;
  /** Env vars for the child process. Deliberately NOT merged with the
   *  runner's own env (beyond PATH/HOME) — a case's env must be fully
   *  explicit, or a stray CORTEX_* var in the runner's shell could silently
   *  change the result. */
  env?: Record<string, string>;
  /** Working directory for the spawned hook — several findings (round-2 F6)
   *  are specifically about what the hook does or doesn't verify about cwd. */
  cwd: string;
  /** Cap in ms; hooks themselves cap stdin reads at 200ms-5s, this is a
   *  belt-and-braces upper bound so a stuck process can't hang the suite. */
  timeoutMs?: number;
}

export async function spawnHook(opts: SpawnHookOptions): Promise<SpawnHookResult> {
  const hookPath = join(opts.cortexRepo, opts.hookRelPath);

  const proc = Bun.spawn([process.execPath, hookPath], {
    cwd: opts.cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Minimal, explicit base — PATH/HOME so Bun itself and any incidental
      // homedir lookups work; everything security-relevant comes from
      // opts.env so a case's env is fully declared, not inherited.
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      // Scratch dir so the hook's best-effort telemetry never touches a
      // real ~/.claude/events; overridable per-call if a check needs to.
      CORTEX_EVENTS_DIR: defaultEventsDir(),
      ...opts.env,
    },
  });

  proc.stdin.write(JSON.stringify(opts.stdin));
  await proc.stdin.end();

  const timeoutMs = opts.timeoutMs ?? 10_000;
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`spawnHook: ${opts.hookRelPath} exceeded ${timeoutMs}ms`)), timeoutMs);
  });

  const raw = await Promise.race([new Response(proc.stdout).text(), timeout]);
  const exitCode = await proc.exited;

  let decision: SpawnHookResult["decision"] = "unknown";
  let reason = "";

  // Hooks print exactly one JSON line; be lenient about trailing whitespace
  // or stray output and take the last non-empty line as the decision.
  const lastLine = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();

  if (lastLine) {
    try {
      const parsed = JSON.parse(lastLine) as {
        continue?: boolean;
        hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
      };
      if (parsed.continue === true) {
        decision = "continue";
      } else if (parsed.hookSpecificOutput?.permissionDecision === "allow") {
        decision = "allow";
        reason = parsed.hookSpecificOutput.permissionDecisionReason ?? "";
      } else if (parsed.hookSpecificOutput?.permissionDecision === "deny") {
        decision = "deny";
        reason = parsed.hookSpecificOutput.permissionDecisionReason ?? "";
      }
    } catch {
      // leave decision "unknown" — caller sees the raw output for diagnosis
    }
  }

  return { decision, reason, raw, exitCode };
}
