// Locate a local checkout of the-metafactory/cortex so this corpus's checks
// can import its exported-for-tests pure functions, or spawn its hook
// scripts directly — this corpus verifies against the REAL guard code,
// never a reimplementation (assay practice #2: verify against ground truth,
// not your own assertions).
//
// cortex is a public repo (the-metafactory/cortex); depending on a local
// checkout of it is not a confidentiality problem. What matters is that NO
// personal path is ever written into THIS repo — resolution happens at
// runtime, from an env var or from the ecosystem's standard sibling-checkout
// layout (`~/Developer/<repo>`), never a literal path in source.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const MARKER_REL_PATH = "src/runner/hooks/path-guard.hook.ts";

/**
 * Resolution order:
 *   1. `ASSAY_CORTEX_REPO_PATH` env var, if set and it looks like a cortex
 *      checkout (has the path-guard hook at the expected relative path).
 *   2. A sibling `cortex` checkout next to this assay checkout — the
 *      ecosystem's standard `~/Developer/<repo>` sibling layout.
 *
 * Returns `null` when no checkout is found. Callers MUST skip cleanly, not
 * fail, when this returns `null` — "requires-cortex-checkout" is a real
 * requirement, not an error.
 */
export function findCortexRepo(): string | null {
  const fromEnv = process.env.ASSAY_CORTEX_REPO_PATH;
  if (fromEnv) {
    const candidate = resolve(fromEnv);
    if (existsSync(resolve(candidate, MARKER_REL_PATH))) return candidate;
  }

  // lib/ -> execution-boundary/ -> evals/ -> <assay repo root> -> <parent> -> cortex/
  const sibling = resolve(import.meta.dir, "../../../../cortex");
  if (existsSync(resolve(sibling, MARKER_REL_PATH))) return sibling;

  return null;
}

export const CORTEX_CHECKOUT_HINT =
  "no cortex checkout found — set ASSAY_CORTEX_REPO_PATH=/path/to/cortex, " +
  "or clone the-metafactory/cortex as a sibling of this assay checkout " +
  "(~/Developer/cortex next to ~/Developer/assay).";
