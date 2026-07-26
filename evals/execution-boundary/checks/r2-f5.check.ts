// r2-f5 — no denylist for boundary-weakening config files inside an
// allowed dir (NWS round 2, F5). OPEN — not fixed. Unit-imports decidePath
// and asserts a Write to a boundary-weakening filename (.claude/settings.json)
// inside an allowedDirs-only fixture (no readOnlyDirs entry covering it) is
// still allowed — decidePath has no filename-based denylist.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { makeTmpRoot } from "../lib/fixture";
import { importCortexModule } from "../lib/import-cortex";
import type { CheckResult } from "../lib/types";

interface PathGuardModule {
  decidePath: (
    toolName: string,
    absPath: string,
    policy: { allowedDirs: string[]; readOnlyDirs: string[] },
  ) => { allow: boolean; reason: string };
}

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const root = makeTmpRoot("r2f5");
  const workspace = join(root, "workspace");
  const claudeDir = join(workspace, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  const settingsPath = join(claudeDir, "settings.json");

  const mod = await importCortexModule<PathGuardModule>(cortexRepo, "src/runner/hooks/path-guard.hook.ts");

  // allowedDirs covers the whole workspace; nothing marks .claude/settings.json
  // as special (no readOnlyDirs entry, no boundary-file denylist).
  const decision = mod.decidePath("Write", settingsPath, { allowedDirs: [workspace], readOnlyDirs: [] });

  if (decision.allow === true) {
    return {
      outcome: "pass",
      detail:
        "decidePath allows a Write to a boundary-weakening path (.claude/settings.json) with no " +
        "denylist protecting it — the round-2 F5 finding still reproduces (status: open).",
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected decidePath to allow this write (matching the documented open finding); got ` +
      `allow:false ("${decision.reason}"). If a boundary-file denylist was added, update r2-f5's ` +
      `status to "fixed" and invert this check's expectation.`,
  };
}
