// r1-f2 — Plugins execute with full daemon authority; no post-load sandbox
// (NWS round 1, F2). Accepted residual per ADR-0024 D4. This is a
// positive-invariant guard, not a vulnerability check: it confirms the
// accepting document still discloses the residual honestly, so a future
// change can't silently narrow the disclosure (or silently make it worse)
// without anyone noticing.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import type { CheckResult } from "../lib/types";

const ADR_REL_PATH = "docs/adr/0024-pluggable-surface-adapters.md";

const REQUIRED_MARKERS = [
  "full daemon authority",
  "compat gate is not a security gate",
];

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  let adrText: string;
  try {
    adrText = readFileSync(join(cortexRepo, ADR_REL_PATH), "utf8");
  } catch (err) {
    return {
      outcome: "fail",
      detail: `could not read ${ADR_REL_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const missing = REQUIRED_MARKERS.filter((m) => !adrText.toLowerCase().includes(m.toLowerCase()));

  if (missing.length === 0) {
    return {
      outcome: "pass",
      detail:
        "ADR-0024 D4 still discloses the accepted residual verbatim (full daemon authority; " +
        "compat gate is not a security gate). F2 remains accurately documented as accepted.",
    };
  }

  return {
    outcome: "fail",
    detail:
      `ADR-0024 no longer contains the expected disclosure marker(s): ${missing.join(", ")} — ` +
      `either the doc was reworded (update this case's expected markers) or the residual was ` +
      `silently narrowed/widened without a matching doc update.`,
  };
}
