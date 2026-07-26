// r2-f6 — empty-path Glob/Grep trusts the working directory without
// checking it (NWS round 2, F6). OPEN — not fixed. Spawns the real
// path-guard.hook.ts with allowedDirs scoped to one fixture dir, cwd (a
// real spawn option) set to a DIFFERENT, out-of-scope fixture dir, and a
// Grep call with no `path` field — asserts the hook still auto-grants.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { makeTmpRoot } from "../lib/fixture";
import { spawnHook } from "../lib/spawn-hook";
import type { CheckResult } from "../lib/types";

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const root = makeTmpRoot("r2f6");
  const allowed = join(root, "allowed");
  const outsideCwd = join(root, "outside-cwd");
  mkdirSync(allowed, { recursive: true });
  mkdirSync(outsideCwd, { recursive: true });

  const result = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/path-guard.hook.ts",
    stdin: { session_id: "assay-r2f6", tool_name: "Grep", tool_input: {} },
    env: {
      CORTEX_CHANNEL: "assay-r2-f6",
      CORTEX_PATH_GUARD: JSON.stringify({ allowedDirs: [allowed], readOnlyDirs: [] }),
    },
    // The hook's own cwd (process.cwd()) is OUTSIDE every allowedDirs entry.
    cwd: outsideCwd,
  });

  if (result.decision === "allow") {
    return {
      outcome: "pass",
      detail:
        "path-guard.hook.ts auto-grants a path-less Grep despite an out-of-scope cwd — the " +
        "round-2 F6 finding still reproduces (status: open).",
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected the hook to auto-grant (matching the documented open finding); got ` +
      `${result.decision} ("${result.reason || result.raw}"). If cwd is now verified, update ` +
      `r2-f6's status to "fixed" and invert this check's expectation.`,
  };
}
