// r1-f5 — Good marks recorded as explicitly as the gaps (NWS round 1, F5).
// Not a defect: a positive-invariant regression guard. Confirms the three
// properties the review specifically credited are still present in
// loader.ts — unconditional org-trust gating, the explicit non-spoofable
// first-party exemption, and the TOCTOU-closing frozen export copy.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import type { CheckResult } from "../lib/types";

const REQUIRED_MARKERS = ["org-trust gate", "un-spoofable", "TOCTOU", "Object.freeze("];

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  let loaderText: string;
  try {
    loaderText = readFileSync(join(cortexRepo, "src/adapters/loader.ts"), "utf8");
  } catch (err) {
    return {
      outcome: "fail",
      detail: `could not read src/adapters/loader.ts: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const missing = REQUIRED_MARKERS.filter((m) => !loaderText.includes(m));

  if (missing.length === 0) {
    return {
      outcome: "pass",
      detail:
        "loader.ts still carries the org-trust gate, the explicit un-spoofable first-party " +
        "exemption, and the TOCTOU-closing frozen export copy — the properties this review " +
        "credited are still present.",
    };
  }

  return {
    outcome: "fail",
    detail:
      `loader.ts is missing expected marker(s): ${missing.join(", ")} — either the code was ` +
      `refactored (update this check's markers) or one of the credited properties regressed.`,
  };
}
