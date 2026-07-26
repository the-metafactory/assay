// r1-f1 — No cortex-owned deterministic filesystem confinement for CC
// sessions (NWS round 1, F1). Fixed by EBH-1 (path-guard.hook.ts +
// bash-guard.hook.ts path containment). This check spawns the REAL hooks
// against a fresh fixture and asserts the out-of-scope read now denies.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { makeTmpRoot } from "../lib/fixture";
import { spawnHook } from "../lib/spawn-hook";
import type { CheckResult } from "../lib/types";

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const root = makeTmpRoot("r1f1");
  const allowed = join(root, "allowed");
  const secretDir = join(root, "secret");
  mkdirSync(allowed, { recursive: true });
  mkdirSync(secretDir, { recursive: true });
  const canaryPath = join(secretDir, "canary.txt");
  writeFileSync(canaryPath, "R1F1-CANARY-SHOULD-NOT-BE-READABLE\n");

  const guardEnv = {
    CORTEX_CHANNEL: "assay-r1-f1",
    CORTEX_PATH_GUARD: JSON.stringify({ allowedDirs: [allowed], readOnlyDirs: [] }),
  };

  const readResult = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/path-guard.hook.ts",
    stdin: { session_id: "assay-r1f1", tool_name: "Read", tool_input: { file_path: canaryPath } },
    env: guardEnv,
    cwd: allowed,
  });

  const bashResult = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/bash-guard.hook.ts",
    stdin: { session_id: "assay-r1f1", tool_name: "Bash", tool_input: { command: `cat ${canaryPath}` } },
    env: guardEnv,
    cwd: allowed,
  });

  const readDenied = readResult.decision === "deny";
  const bashDenied = bashResult.decision === "deny";

  if (readDenied && bashDenied) {
    return {
      outcome: "pass",
      detail:
        "path-guard.hook.ts denied the out-of-scope Read and bash-guard.hook.ts denied the " +
        "out-of-scope `cat` — the F1 fix (cortex-owned PreToolUse containment) holds.",
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected BOTH tools to deny the out-of-scope canary; got Read=${readResult.decision} ` +
      `("${readResult.reason || readResult.raw}"), Bash cat=${bashResult.decision} ` +
      `("${bashResult.reason || bashResult.raw}")`,
  };
}
