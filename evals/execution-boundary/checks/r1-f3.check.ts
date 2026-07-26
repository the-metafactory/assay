// r1-f3 — Sovereignty enforcement defaults to audit-only, and was
// unreachable from config (NWS round 1, F3). Fixed by EBH-6b: a real
// `policy.sovereignty.enforce` config key, resolved once and threaded to
// BOTH consumers. This check greps src/cortex.ts for that single resolved
// value reaching both consumer construction sites — the exact asymmetry
// the EBH-6 investigation found (one path could see the flag, the other
// couldn't) and closed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import type { CheckResult } from "../lib/types";

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  let cortexTs: string;
  try {
    cortexTs = readFileSync(join(cortexRepo, "src/cortex.ts"), "utf8");
  } catch (err) {
    return {
      outcome: "fail",
      detail: `could not read src/cortex.ts: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const resolvesKey = /sovereigntyEnforce\s*=\s*resolvedPolicy\?\.sovereignty\?\.enforce\s*\?\?\s*false/.test(
    cortexTs,
  );
  // Both consumer construction sites must receive the SAME resolved value —
  // count occurrences of `sovereigntyEnforce,` (the shorthand-property pass)
  // after the resolution line; the EBH-6 finding was that only one of two
  // consumers could reach it at all.
  const passSiteCount = (cortexTs.match(/\bsovereigntyEnforce,/g) ?? []).length;

  if (resolvesKey && passSiteCount >= 2) {
    return {
      outcome: "pass",
      detail:
        `src/cortex.ts resolves policy.sovereignty.enforce (default false) once and threads it ` +
        `to ${passSiteCount} consumer construction site(s) (>=2 expected) — the review-consumer/` +
        `brain-consumer asymmetry EBH-6 found is closed.`,
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected a single resolved sovereigntyEnforce fed to >=2 consumer sites; ` +
      `resolvesKey=${resolvesKey}, passSiteCount=${passSiteCount}. Either the code moved ` +
      `(update this check's patterns) or the config key regressed to being unreachable again.`,
  };
}
