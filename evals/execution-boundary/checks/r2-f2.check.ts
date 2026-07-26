// r2-f2 — a malformed config field fails open to no restriction at all
// (NWS round 2, F2). Fixed: validateDirsField distinguishes ABSENT from
// PRESENT-BUT-WRONG-SHAPE, and parsePathGuardConfig now denies on the
// latter. Unit-imports parsePathGuardConfig and calls it with the finding's
// own repro string, verbatim.

import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { importCortexModule } from "../lib/import-cortex";
import type { CheckResult } from "../lib/types";

interface PathGuardModule {
  parsePathGuardConfig: (raw: string | undefined) => { ok: boolean; reason: string };
}

// Verbatim from the finding: 'CORTEX_PATH_GUARD='{"allowedDirs":"/repo","readOnlyDirs":[]}''
const MALFORMED_CONFIG = '{"allowedDirs":"/repo","readOnlyDirs":[]}';

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const mod = await importCortexModule<PathGuardModule>(cortexRepo, "src/runner/hooks/path-guard.hook.ts");
  const result = mod.parsePathGuardConfig(MALFORMED_CONFIG);

  if (result.ok === false) {
    return {
      outcome: "pass",
      detail: `parsePathGuardConfig treats the malformed field as a genuine failure: "${result.reason}"`,
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected ok:false for CORTEX_PATH_GUARD='${MALFORMED_CONFIG}' (a string where allowedDirs ` +
      `must be an array); got ok:true — this would silently disable all containment, the exact ` +
      `round-2 F2 bypass.`,
  };
}
