// r2-f4 — MCP grant-grammar separator collision (NWS round 2, F4). OPEN —
// not fixed. Unit-imports decideMcp/parseMcpToolName and reproduces both of
// the finding's own repro shapes directly. Expects both to still return
// allow:true (vulnerability reproduces, matching status:open).

import { CORTEX_CHECKOUT_HINT, findCortexRepo } from "../lib/cortex-repo";
import { importCortexModule } from "../lib/import-cortex";
import type { CheckResult } from "../lib/types";

interface McpGuardModule {
  decideMcp: (toolName: string, grants: string[]) => { allow: boolean; reason?: string };
}

export default async function check(): Promise<CheckResult> {
  const cortexRepo = findCortexRepo();
  if (!cortexRepo) return { outcome: "skip", detail: CORTEX_CHECKOUT_HINT };

  const mod = await importCortexModule<McpGuardModule>(cortexRepo, "src/runner/hooks/mcp-guard.hook.ts");

  // Repro 1: a server literally named "github.read_file" collides with a
  // per-tool grant meant for a DIFFERENT server's single tool.
  const dotCollision = mod.decideMcp("mcp__github.read_file__x", ["github.read_file"]);

  // Repro 2: a server named "github__evil" parses to server "github" and
  // rides a server-wide "github" grant meant for the real github server.
  const doubleUnderscoreCollision = mod.decideMcp("mcp__github__evil__y", ["github"]);

  const bothVulnerable = dotCollision.allow === true && doubleUnderscoreCollision.allow === true;

  if (bothVulnerable) {
    return {
      outcome: "pass",
      detail:
        `both repro shapes still reproduce (status: open): dot-collision allow=` +
        `${dotCollision.allow}, double-underscore-collision allow=${doubleUnderscoreCollision.allow}.`,
    };
  }

  return {
    outcome: "fail",
    detail:
      `expected BOTH collisions to return allow:true (matching the documented open finding); got ` +
      `dot-collision=${dotCollision.allow}, double-underscore-collision=${doubleUnderscoreCollision.allow}. ` +
      `If this is a genuine fix, update r2-f4's status to "fixed" and invert this check's expectation.`,
  };
}
