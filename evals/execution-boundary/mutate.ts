// mutate.ts — runs execution-boundary checks against checked-in mutants (#23's
// suggested `evals/execution-boundary/mutants/<name>/` + `mutate.ts`), for the four
// spawn-hook checks (r1-f1, r1-f4, r1-f6, r2-f3). DD-3 (proposed, see
// docs/design-testing-factory.md): a guard is untrusted until it has been OBSERVED
// FAILING against the fault it exists to catch, AND silent on the correct state.
// No check is changed here; this records both directions:
//
//   control  — the check runs unchanged against the real cortex checkout
//              (#23's positive control: every case still passes). Expected: pass.
//   known-bad — the same check runs against a temp copy of that checkout in which
//              ONE guard script is replaced by a mutant in ./mutants/<name>/
//              (allow-all / deny-all / contradictory). Expected: the check
//              REJECTS the broken guard (outcome "fail").
//
// A rejection only counts when it is for the injected defect: the check's own
// detail must name the decision the defect produces (e.g. "Read=allow"), and the
// fixture is first spawned directly to prove it emits exactly that decision with
// exit 0 (contradictory: its two documented lines in raw stdout + exit 1). A failure for any
// other reason is reported INVALID, not CAUGHT. A check that PASSES against a
// known-bad guard is reported ACCEPTED-KNOWN-BAD, plainly, and is not "fixed"
// here: deciding what the check should do is the maintainers' call.
//
// Usage (needs a cortex checkout, same resolution as the corpus; skips without one):
//   ASSAY_CORTEX_REPO_PATH=/path/to/cortex bun run evals/execution-boundary/mutate.ts
//   ... mutate.ts --only r1-f1/both-deny-all,r2-f3/bash-contradictory   (one or more entries)
// Exit: 0 only if every control behaved as documented and every known-bad entry
// was CAUGHT. The observed record (which rows, and why) is in mutants/README.md.

import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCortexRepo, CORTEX_CHECKOUT_HINT } from "./lib/cortex-repo";
import { spawnHook } from "./lib/spawn-hook";
import type { CheckFn } from "./lib/types";

const PATH_GUARD = "src/runner/hooks/path-guard.hook.ts";
const BASH_GUARD = "src/runner/hooks/bash-guard.hook.ts";
type Fixture = "allow-all" | "deny-all" | "contradictory";

interface Entry {
  id: string; // stable entry id, used by --only
  check: string; // case id; check module is checks/<id>.check.ts
  replace: { hook: string; fixture: Fixture }[];
  defect: string;
  expected: string;
  /** Substrings that must appear in the check's failure detail for the rejection to count. */
  mustName: string[];
}

const ENTRIES: Entry[] = [
  { id: "r1-f1/path-allow-all", check: "r1-f1", replace: [{ hook: PATH_GUARD, fixture: "allow-all" }], defect: "path-guard grants everything (Read containment removed); bash-guard real", expected: "fail, naming Read=allow", mustName: ["Read=allow"] },
  { id: "r1-f1/bash-allow-all", check: "r1-f1", replace: [{ hook: BASH_GUARD, fixture: "allow-all" }], defect: "bash-guard grants everything (Bash containment removed); path-guard real", expected: "fail, naming Bash cat=allow", mustName: ["Bash cat=allow"] },
  // mustName is empty while this row is ACCEPTED (#20). Once #20 adds r1-f1's in-scope
  // control, name the in-scope decision deny-all produces here, so that only that
  // failure counts as CAUGHT.
  { id: "r1-f1/both-deny-all", check: "r1-f1", replace: [{ hook: PATH_GUARD, fixture: "deny-all" }, { hook: BASH_GUARD, fixture: "deny-all" }], defect: "both guards deny everything, including legitimate in-scope work", expected: "fail (DD-3 corollary: firing on the correct state is a failure)", mustName: [] },
  { id: "r1-f4/bash-allow-all", check: "r1-f4", replace: [{ hook: BASH_GUARD, fixture: "allow-all" }], defect: "guard-off bash-guard grants out-of-scope reads", expected: "fail, naming cat=allow", mustName: ["cat=allow"] },
  { id: "r1-f4/bash-deny-all", check: "r1-f4", replace: [{ hook: BASH_GUARD, fixture: "deny-all" }], defect: "guard-off bash-guard denies in-scope uncataloged commands (G-300 regression)", expected: "fail, naming sort=deny", mustName: ["sort=deny"] },
  { id: "r1-f6/path-allow-all", check: "r1-f6", replace: [{ hook: PATH_GUARD, fixture: "allow-all" }], defect: "read-only dir is writable (Write granted)", expected: "fail, naming Write=allow", mustName: ["Write=allow"] },
  { id: "r1-f6/path-deny-all", check: "r1-f6", replace: [{ hook: PATH_GUARD, fixture: "deny-all" }], defect: "read-only dir is unreadable (Read denied)", expected: "fail, naming Read=deny", mustName: ["Read=deny"] },
  { id: "r2-f3/bash-deny-all", check: "r2-f3", replace: [{ hook: BASH_GUARD, fixture: "deny-all" }], defect: "bash-guard denies the repro command (looks like a fix, or a broken guard)", expected: "fail, naming got deny", mustName: ["got deny"] },
  { id: "r2-f3/bash-contradictory", check: "r2-f3", replace: [{ hook: BASH_GUARD, fixture: "contradictory" }], defect: "bash-guard emits deny then allow and exits 1 (no trustworthy verdict)", expected: "not a clean pass (fail or unknown)", mustName: [] },
];

const FIXTURE_EXPECT: Record<Exclude<Fixture, "contradictory">, { decision: string; exit: number }> = {
  "allow-all": { decision: "allow", exit: 0 },
  "deny-all": { decision: "deny", exit: 0 },
};

// The contradictory fixture is checked against RAW stdout, not spawnHook's parsed
// decision/reason. That parse takes the last line, which is the #15 defect, so a
// #15 fix would make a parsed probe report INVALID and the row could never turn
// CAUGHT. Both lines, in order, each naming the fixture, plus exit 1, prove the
// mutant ran whatever the parser does.
const CONTRADICTORY_LINES = [
  { decision: "deny", reason: "known-bad fixture: contradictory (1/2)" },
  { decision: "allow", reason: "known-bad fixture: contradictory (2/2)" },
];
function contradictoryRan(raw: string): boolean {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length !== CONTRADICTORY_LINES.length) return false;
  return lines.every((line, i) => {
    try {
      const o = (JSON.parse(line) as { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } }).hookSpecificOutput;
      const want = CONTRADICTORY_LINES[i];
      return want !== undefined && o?.permissionDecision === want.decision && o?.permissionDecisionReason === want.reason;
    } catch {
      return false;
    }
  });
}

async function runCheck(id: string, cortexRoot: string) {
  const prev = process.env.ASSAY_CORTEX_REPO_PATH;
  process.env.ASSAY_CORTEX_REPO_PATH = cortexRoot;
  try {
    const mod = (await import(join(import.meta.dir, "checks", `${id}.check.ts`))) as { default: CheckFn };
    return await mod.default();
  } finally {
    if (prev === undefined) delete process.env.ASSAY_CORTEX_REPO_PATH;
    else process.env.ASSAY_CORTEX_REPO_PATH = prev;
  }
}


// How each guard is swapped — explicit, not inferred from file contents:
//   reexport: the real module's entrypoint is behind `if (import.meta.main)` and other
//             hooks import its helpers (bash-guard imports parsePathGuardConfig from
//             path-guard). Keep it as <name>.real.ts, re-export it, replace only the
//             decision. Asserted below; a mismatch aborts the run rather than guessing.
//   replace:  the real module runs main() at top level and nothing imports it.
const COMPOSE: Record<string, "reexport" | "replace"> = {
  [PATH_GUARD]: "reexport",
  [BASH_GUARD]: "replace",
};

function mutantRoot(real: string, replace: Entry["replace"]): string {
  const root = mkdtempSync(join(tmpdir(), "assay-mutant-"));
  try {
    composeMutant(real, root, replace);
  } catch (err) {
    // A failed setup must not leave its half-built copy behind.
    rmSync(root, { recursive: true, force: true });
    throw err;
  }
  return root;
}

function composeMutant(real: string, root: string, replace: Entry["replace"]): void {
  // A plain copy (minus .git) in the OS temp dir: the real checkout is never written
  // to, and nothing from cortex is committed here; hooks are swapped in the copy only.
  const gitDir = join(real, ".git");
  cpSync(real, root, { recursive: true, filter: (src) => src !== gitDir && !src.startsWith(gitDir + "/") });
  for (const r of replace) {
    const target = join(root, r.hook);
    const mutant = readFileSync(join(import.meta.dir, "mutants", r.fixture, "hook.ts"), "utf8");
    const guarded = /if\s*\(\s*import\.meta\.main\s*\)/.test(readFileSync(target, "utf8"));
    if (COMPOSE[r.hook] === "reexport") {
      if (!guarded) throw new Error(`${r.hook}: expected an import.meta.main-guarded entrypoint for re-export; refusing to guess`);
      const base = r.hook.split("/").pop()!.replace(/\.ts$/, "");
      renameSync(target, join(root, r.hook.replace(/\.ts$/, ".real.ts")));
      writeFileSync(target, `export * from "./${base}.real.ts";\n` + mutant);
    } else {
      rmSync(target);
      writeFileSync(target, mutant);
    }
  }
}

const real = findCortexRepo();
if (!real) {
  console.log(`SKIP — ${CORTEX_CHECKOUT_HINT}`);
  process.exit(0);
}

const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > -1 ? new Set((process.argv[onlyArg + 1] ?? "").split(",")) : null;
const SELECTED = only ? ENTRIES.filter((e) => only.has(e.id)) : ENTRIES;
if (only && SELECTED.length !== only.size) {
  console.log(`unknown --only id(s); valid: ${ENTRIES.map((e) => e.id).join(", ")}`);
  process.exit(2);
}

const rows: string[] = [];
let ok = true;
console.log(`cortex (control): ${real}\n`);

// Positive control (#23): each target check, unchanged, against the real checkout.
for (const id of [...new Set(SELECTED.map((e) => e.check))]) {
  const r = await runCheck(id, real);
  const good = r.outcome === "pass";
  if (!good) ok = false;
  rows.push(`| ${id}/control | ${id} | real cortex (unchanged) | — | pass | ${r.outcome} | — | ${good ? "CONTROL OK" : "CONTROL BROKEN"} |`);
  console.log(`[${good ? "CONTROL OK" : "CONTROL BROKEN"}] ${id} on real cortex → ${r.outcome}: ${r.detail.slice(0, 160)}`);
}

for (const e of SELECTED) {
  let root: string | undefined;
  let probeDir: string | undefined;
  let sane = true;
  const ran: string[] = [];
  let r: Awaited<ReturnType<typeof runCheck>>;
  try {
    root = mutantRoot(real, e.replace);
    probeDir = mkdtempSync(join(tmpdir(), "assay-mutant-probe-"));
    // Sanity, so a check result below can be attributed to the mutant and nothing else.
    // Two probes per guard — out-of-scope AND in-scope — because a deny-all mutant and
    // the real guard agree on the out-of-scope one:
    //   swapped guard:   declared decision + exit on both probes, AND its reason names
    //                    the mutant ("known-bad fixture: <name>") — proof the swap ran;
    //   untouched guard: identical decision + exit to the real checkout on both probes,
    //                    never "unknown" — proof nothing else in the copy broke.
    const inScope = join(probeDir, "allowed");
    mkdirSync(inScope);
    const probeEnv = { CORTEX_CHANNEL: "mutant-sanity", CORTEX_PATH_GUARD: JSON.stringify({ allowedDirs: [inScope], readOnlyDirs: [] }) };
    const outside = join(probeDir, "outside.txt"), inside = join(inScope, "inside.txt");
    const probes: Record<string, unknown[]> = {
      [PATH_GUARD]: [outside, inside].map((p) => ({ session_id: "mutant-sanity", tool_name: "Read", tool_input: { file_path: p } })),
      [BASH_GUARD]: [outside, inside].map((p) => ({ session_id: "mutant-sanity", tool_name: "Bash", tool_input: { command: `cat ${p}` } })),
    };
    for (const hook of [PATH_GUARD, BASH_GUARD]) {
      const swapped = e.replace.find((x) => x.hook === hook);
      for (const stdin of probes[hook] ?? []) {
        const s = await spawnHook({ cortexRepo: root, hookRelPath: hook, stdin, env: probeEnv, cwd: inScope });
        if (swapped?.fixture === "contradictory") {
          const named = contradictoryRan(s.raw);
          if (!named || s.exitCode !== 1) sane = false;
          if (named) ran.push(`${hook.split("/").pop()}: raw stdout = both "known-bad fixture: contradictory" lines, exit ${s.exitCode}`);
        } else if (swapped) {
          const want = FIXTURE_EXPECT[swapped.fixture];
          const named = s.reason.includes(`known-bad fixture: ${swapped.fixture}`);
          if (s.decision !== want.decision || s.exitCode !== want.exit || !named) sane = false;
          if (named) ran.push(`${hook.split("/").pop()}: "${s.reason}"`);
        } else {
          const ref = await spawnHook({ cortexRepo: real, hookRelPath: hook, stdin, env: probeEnv, cwd: inScope });
          if (s.decision !== ref.decision || s.exitCode !== ref.exitCode || s.decision === "unknown") sane = false;
        }
      }
    }
    r = await runCheck(e.check, root);
  } finally {
    if (probeDir) rmSync(probeDir, { recursive: true, force: true });
    if (root) rmSync(root, { recursive: true, force: true });
  }
  let verdict: string;
  if (!sane) verdict = "INVALID (mutant did not behave as declared, or an untouched guard changed)";
  else if (r.outcome === "pass") verdict = "ACCEPTED-KNOWN-BAD";
  else if (r.outcome === "fail" && e.mustName.every((m) => r.detail.includes(m))) verdict = "CAUGHT";
  else if (r.outcome === "fail") verdict = `INVALID (failed, but detail does not name ${e.mustName.join(", ")})`;
  else verdict = `INVALID (${r.outcome})`;
  if (verdict !== "CAUGHT") ok = false;
  const fx = e.replace.map((x) => `${x.hook.split("/").pop()}→${x.fixture}`).join(" + ");
  const evidence = [...new Set(ran)].join("; ");
  rows.push(`| ${e.id} | ${e.check} | ${fx} | ${e.defect} | ${e.expected} | ${r.outcome} | ${evidence} | ${verdict} |`);
  console.log(`[${verdict}] ${e.id} (${e.check} with ${fx}) → ${r.outcome}: ${r.detail.slice(0, 200)}\n    mutant ran: ${evidence || "NOT CONFIRMED"}`);
}

console.log(`\n| entry | check | guard under test | injected defect | expected | observed | mutant ran (probe reason) | verdict |\n|---|---|---|---|---|---|---|---|\n${rows.join("\n")}`);
process.exit(ok ? 0 : 1);
