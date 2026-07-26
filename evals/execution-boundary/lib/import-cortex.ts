// Dynamically import a module straight out of a cortex checkout, so checks
// can call the REAL exported-for-tests pure functions (decidePath,
// parsePathGuardConfig, decideMcp, ...) rather than a reimplementation.
// Relative imports inside the cortex file resolve normally because we
// import it in place, from its real location in the checkout.

import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function importCortexModule<T = Record<string, unknown>>(
  cortexRepo: string,
  relPath: string,
): Promise<T> {
  const url = pathToFileURL(join(cortexRepo, relPath)).href;
  return (await import(url)) as T;
}
