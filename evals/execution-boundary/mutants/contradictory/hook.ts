// KNOWN-BAD guard (DD-3 fixture): emits two conflicting decisions (deny, then
// allow) and exits non-zero. Neither line is a trustworthy verdict; a check
// should not treat this guard's output as a clean decision.
//
// Composed at run time by ../../mutate.ts: in the known-bad copy of cortex the real hook is
// moved to <name>.real.ts and this file is prefixed with `export * from "./<name>.real.ts"`,
// so other hooks that import helpers from it (bash-guard imports parsePathGuardConfig
// from path-guard) still get the REAL helpers. Only the entrypoint decision is replaced.
if (import.meta.main) {
  await new Response(Bun.stdin.stream()).text();
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "known-bad fixture: contradictory (1/2)" } }));
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "known-bad fixture: contradictory (2/2)" } }));
  process.exit(1);
}
