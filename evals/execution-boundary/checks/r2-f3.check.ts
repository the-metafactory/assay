// r2-f3 — env-prefix stripping is unmodeled and can carry capability-bearing
// env vars (NWS round 2, F3). OPEN — not fixed. This check spawns the real
// bash-guard.hook.ts with the finding's own repro command verbatim and
// asserts the guard currently GRANTS it (i.e. it expects the vulnerability
// to still reproduce). A future fix should flip this to deny, which is the
// signal to update this case's status to "fixed".

import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { makeTmpRoot } from "../lib/fixture";
import { spawnHook } from "../lib/spawn-hook";
import type { CheckResult } from "../lib/types";

// Verbatim from the finding.
const REPRO_COMMAND = "GIT_PAGER=/bin/sh git log";

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const root = makeTmpRoot("r2f3");

  const result = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/bash-guard.hook.ts",
    stdin: { session_id: "assay-r2f3", tool_name: "Bash", tool_input: { command: REPRO_COMMAND } },
    env: {
      CORTEX_CHANNEL: "assay-r2-f3",
      // No CORTEX_BASH_GUARD -> DEFAULT_CONFIG floor, which allows
      // `^git\s+(log|diff|show|status|branch|fetch|remote|rev-parse)\b`.
    },
    cwd: root,
  });

  if (result.decision === "allow") {
    return {
      outcome: "pass",
      detail:
        `bash-guard.hook.ts grants "${REPRO_COMMAND}" without ever inspecting the stripped ` +
        `GIT_PAGER assignment — the modeling gap NWS described still reproduces (status: open). ` +
        `This does NOT confirm the env var is actually invoked as a shell by the downstream tool ` +
        `(that half remains unverified, per the finding's own conditional severity) — it confirms ` +
        `only that cortex's own guard classifies and grants the command unexamined.`,
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected the guard to GRANT "${REPRO_COMMAND}" (matching the documented open finding); ` +
      `got ${result.decision} ("${result.reason || result.raw}"). If this is a genuine fix, ` +
      `update r2-f3's status to "fixed" and invert this check's expectation.`,
  };
}
