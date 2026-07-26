// r2-f1 — read-only is silently overridden by an overlapping allowed dir
// (NWS round 2, F1). Fixed: decidePath now computes inAllowed/inReadOnly
// independently and read-only wins on containment overlap (deny-precedence).
// Unit-imports the real decidePath and reproduces the finding's own repro
// shape: allowedDirs:["/repo"], readOnlyDirs:["/repo/.claude"].

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

  const root = makeTmpRoot("r2f1");
  const repo = join(root, "repo"); // stands in for the finding's "/repo"
  const claudeDir = join(repo, ".claude"); // stands in for "/repo/.claude"
  mkdirSync(claudeDir, { recursive: true });
  const settingsPath = join(claudeDir, "settings.json");

  const mod = await importCortexModule<PathGuardModule>(cortexRepo, "src/runner/hooks/path-guard.hook.ts");

  const decision = mod.decidePath("Write", settingsPath, {
    allowedDirs: [repo],
    readOnlyDirs: [claudeDir],
  });

  if (decision.allow === false) {
    return {
      outcome: "pass",
      detail: `decidePath denies the Write into the nested readOnlyDirs entry: "${decision.reason}"`,
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected decidePath to deny (allow:false) a Write into a readOnlyDirs entry nested ` +
      `inside a broader allowedDirs root; got allow:true ("${decision.reason}") — the round-2 F1 ` +
      `bypass may have regressed.`,
  };
}
