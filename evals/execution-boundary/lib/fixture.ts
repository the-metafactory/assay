// Shared fixture helper — every check creates its own throwaway temp
// directory tree rather than touching any real path, per this repo's
// no-real-personal-paths rule and assay practice #3 (never verify through
// the path you acted through — a fresh fixture per check also means checks
// can't leak state into each other).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function makeTmpRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `assay-${prefix}-`));
}
