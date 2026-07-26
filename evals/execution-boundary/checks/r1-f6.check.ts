// r1-f6 — readOnlyDirs are not deterministically read-only at the cortex
// layer (NWS round 1, F6). Fixed by EBH-1 (decidePath's write-deny branch)
// wired live by EBH-1b. Asserts: Write into a readOnlyDirs-scoped fixture
// is denied; Read of the same path is allowed (read-only means read-only,
// not no-access).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { makeTmpRoot } from "../lib/fixture";
import { spawnHook } from "../lib/spawn-hook";
import type { CheckResult } from "../lib/types";

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const root = makeTmpRoot("r1f6");
  const readOnlyDir = join(root, "readonly");
  mkdirSync(readOnlyDir, { recursive: true });
  const targetFile = join(readOnlyDir, "protected.txt");
  writeFileSync(targetFile, "do not modify\n");

  const guardEnv = {
    CORTEX_CHANNEL: "assay-r1-f6",
    CORTEX_PATH_GUARD: JSON.stringify({ allowedDirs: [], readOnlyDirs: [readOnlyDir] }),
  };

  const writeResult = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/path-guard.hook.ts",
    stdin: { session_id: "assay-r1f6-w", tool_name: "Write", tool_input: { file_path: targetFile } },
    env: guardEnv,
    cwd: readOnlyDir,
  });

  const readResult = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/path-guard.hook.ts",
    stdin: { session_id: "assay-r1f6-r", tool_name: "Read", tool_input: { file_path: targetFile } },
    env: guardEnv,
    cwd: readOnlyDir,
  });

  const writeDenied = writeResult.decision === "deny";
  const readAllowed = readResult.decision !== "deny";

  if (writeDenied && readAllowed) {
    return {
      outcome: "pass",
      detail:
        "Write into a readOnlyDirs-scoped path is denied; Read of the same path is not — F6 fix " +
        "holds (read-only is deterministic, not prose).",
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected Write denied and Read allowed; got Write=${writeResult.decision} ` +
      `("${writeResult.reason || writeResult.raw}"), Read=${readResult.decision} ` +
      `("${readResult.reason || readResult.raw}")`,
  };
}
