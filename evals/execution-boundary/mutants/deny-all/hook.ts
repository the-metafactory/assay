// KNOWN-BAD guard (DD-3 fixture): denies every tool call, including legitimate
// in-scope work. DD-3's corollary: a detector that fires on the correct state is
// the same failure as one that stays silent on the fault. Well-formed "deny", exit 0.
//
// Composed at run time by ../../mutate.ts: in the known-bad copy of cortex the real hook is
// moved to <name>.real.ts and this file is prefixed with `export * from "./<name>.real.ts"`,
// so other hooks that import helpers from it (bash-guard imports parsePathGuardConfig
// from path-guard) still get the REAL helpers. Only the entrypoint decision is replaced.
if (import.meta.main) {
  await new Response(Bun.stdin.stream()).text();
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "known-bad fixture: deny-all" } }));
}
