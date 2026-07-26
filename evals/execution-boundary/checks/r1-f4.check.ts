// r1-f4 — Principal-DM mode disables the Bash guard entirely (NWS round 1,
// F4). Fixed by EBH-1g: guard-off (G-300, CORTEX_BASH_GUARD={"disabled":true})
// sessions now run path containment in a lenient mode. Two assertions:
//   (a) an out-of-scope `cat` is still denied even guard-off
//   (b) an everyday, uncataloged in-scope command is NOT denied — G-300's
//       whole point (the principal may run any command) must survive.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { makeTmpRoot } from "../lib/fixture";
import { spawnHook } from "../lib/spawn-hook";
import type { CheckResult } from "../lib/types";

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const root = makeTmpRoot("r1f4");
  const allowed = join(root, "allowed");
  const secretDir = join(root, "secret");
  mkdirSync(allowed, { recursive: true });
  mkdirSync(secretDir, { recursive: true });
  const canaryPath = join(secretDir, "canary.txt");
  writeFileSync(canaryPath, "R1F4-CANARY-SHOULD-NOT-BE-READABLE\n");
  const inScopeFile = join(allowed, "notes.txt");
  writeFileSync(inScopeFile, "line one\nline two\nline three\n");

  const guardOffEnv = {
    CORTEX_CHANNEL: "assay-r1-f4",
    CORTEX_BASH_GUARD: JSON.stringify({ disabled: true }),
    CORTEX_PATH_GUARD: JSON.stringify({ allowedDirs: [allowed], readOnlyDirs: [] }),
  };

  const outOfScope = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/bash-guard.hook.ts",
    stdin: { session_id: "assay-r1f4-a", tool_name: "Bash", tool_input: { command: `cat ${canaryPath}` } },
    env: guardOffEnv,
    cwd: allowed,
  });

  // `sort` is not on DEFAULT_CONFIG's allowlist at all — in a NORMAL
  // (guard-on) session this would deny for lacking a shape-allowlist match.
  // In guard-off mode it must still be allowed to run (G-300), as long as
  // its path argument is in scope.
  const uncataloged = await spawnHook({
    cortexRepo,
    hookRelPath: "src/runner/hooks/bash-guard.hook.ts",
    stdin: { session_id: "assay-r1f4-b", tool_name: "Bash", tool_input: { command: `sort ${inScopeFile}` } },
    env: guardOffEnv,
    cwd: allowed,
  });

  const outOfScopeDenied = outOfScope.decision === "deny";
  const uncatalogedNotDenied = uncataloged.decision !== "deny";

  if (outOfScopeDenied && uncatalogedNotDenied) {
    return {
      outcome: "pass",
      detail:
        "guard-off (disabled:true) session still denies an out-of-scope `cat`, and still lets an " +
        "uncataloged in-scope command (`sort`) through un-denied — the F4 fix holds without " +
        "regressing G-300.",
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected out-of-scope cat DENIED and uncataloged sort NOT denied; got cat=` +
      `${outOfScope.decision} ("${outOfScope.reason || outOfScope.raw}"), sort=${uncataloged.decision} ` +
      `("${uncataloged.reason || uncataloged.raw}")`,
  };
}
