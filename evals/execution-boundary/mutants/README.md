# mutants: checked-in known-bad guards for the spawn-hook checks

A first slice of #23's suggested checked-in mutant set: `evals/execution-boundary/mutants/<name>/` plus `mutate.ts`. It covers the four checks that spawn a real cortex guard: `r1-f1`, `r1-f4`, `r1-f6`, `r2-f3`.

**This is regression evidence for findings already filed (#20, #23, #15), not new findings.** assay locks in known-good; it does not find unknown-bad.

**No existing check, case, lib or doc file is changed.** Fixing checks stays with #20 (r1-f1, r1-f6, r2-f5) and #23 (the other nine).

DD-3 (`docs/design-testing-factory.md`, one of the proposed decisions DD-1..DD-10): a guard is untrusted until it has been **observed failing** against the fault it exists to catch, and it must be **silent on the correct state**. "A markdown file beside the checks was enough". This file is that record.

## Contents
| Path | Mutant |
|---|---|
| `allow-all/hook.ts` | grants every call (the containment is gone) |
| `deny-all/hook.ts` | denies every call, including legitimate in-scope work |
| `contradictory/hook.ts` | prints a `deny` line, then an `allow` line, then exits 1 |
| `../mutate.ts` | runs each target check **unchanged** against your cortex checkout (positive control), then against a temp copy with one guard swapped for a mutant |

## How a mutant checkout is built
`mutate.ts` copies the cortex checkout (minus `.git`) into the OS temp dir and swaps one guard. The real checkout is never written to, and no cortex code is committed here.
- **path-guard:** its entrypoint sits behind `import.meta.main`, and bash-guard imports `parsePathGuardConfig` from it. So the real module is kept as `path-guard.hook.real.ts` and the mutant re-exports it; only the entrypoint decision changes.
- **bash-guard:** runs `main()` at top level, and nothing imports it. It is replaced outright.

This is a different construction from #23's throwaway fake checkouts. Every guard *not* under test stays real, so a check fails only because of the swapped guard. That is enforced, not assumed.

## When a row counts
Each guard is probed twice before the check runs: once with an out-of-scope request and once with an in-scope one. A deny-all mutant and the real guard give the same answer to the out-of-scope request, so one probe alone cannot prove the swap happened.

A failing check counts as **CAUGHT** only if all three hold:
1. **The swap ran:** on both probes, the swapped guard emits its declared decision and exit code, **and** its reason names the mutant (`known-bad fixture: <name>`). That reason is recorded in the "mutant ran" column.
   - **`contradictory`** is checked against the guard's **raw stdout**: both lines, in order, each naming the fixture, plus exit 1. It is not checked against `spawnHook`'s parsed decision, because that parse takes the last line (#15). A #15 fix would otherwise make the probe itself report INVALID, and the row could never turn CAUGHT.
2. **Nothing else broke:** on both probes, every guard *not* swapped decides exactly as it does on the real checkout, and never `unknown`.
3. **The check names the injected decision:** its own failure detail names the decision the mutant produces (e.g. `Read=allow`).

Anything else is reported **INVALID**.

This step has failed for real:
- **Collateral breakage:** a version that replaced path-guard wholesale broke bash-guard (`SyntaxError: Export named 'parsePathGuardConfig' not found`). Those rows were reported INVALID, not CAUGHT.
- **A swap that never happened:** a "deny-all" mutant that was secretly the real bash-guard was reported INVALID with "mutant ran: NOT CONFIRMED".
- **A parser fix:** with `spawnHook` patched locally to return `unknown` when stdout carries more than one decision line (a stand-in for a #15 fix), `r2-f3/bash-contradictory` reports **CAUGHT**. Before the raw-stdout probe it reported INVALID.

A check that passes against a mutant is reported **ACCEPTED-KNOWN-BAD**, and is left as found.

## Run
```bash
ASSAY_CORTEX_REPO_PATH=/path/to/cortex bun run evals/execution-boundary/mutate.ts
ASSAY_CORTEX_REPO_PATH=/path/to/cortex bun run evals/execution-boundary/mutate.ts --only <entry>[,<entry>…]
```
- With no cortex checkout it skips, like the corpus.
- **Exit code:** 0 only if every control passes and every row is CAUGHT.
- It is a separate script, not part of `bun test`, so recording today's two ACCEPTED rows does not turn `bun test` red.

## Observed record
**Run conditions:**
- assay `2ae3da6556f4` with only this change.
- cortex `01f43bb9029e`, the pin the 12 baselines were re-established on.
- bun 1.4.2, linux x64 (kernel 6.6). The baselines were captured on bun 1.3.14 / kernel 7.0.0, so the runner's environment-drift note applies.
- Two consecutive runs produced identical tables.
- The full corpus (`runner.ts`) is unchanged: `CORPUS INTEGRITY 12/12`, `4 STILL OPEN`.

| Entry | Check (what it asserts) | Mutant | Expected | Observed check detail (trimmed) | Verdict |
|---|---|---|---|---|---|
| `r1-f1/control` | out-of-scope Read **and** Bash `cat` both denied | none | pass | `path-guard.hook.ts denied the out-of-scope Read and bash-guard.hook.ts denied the out-of-scope cat` | CONTROL OK |
| `r1-f1/path-allow-all` | r1-f1 | path-guard → allow-all (bash-guard real) | fail, `Read=allow` | `got Read=allow (…), Bash cat=deny ("[Cortex Bash Guard] Blocked …")` | CAUGHT |
| `r1-f1/bash-allow-all` | r1-f1 | bash-guard → allow-all (path-guard real) | fail, `Bash cat=allow` | `got Read=deny ("[Cortex Path Guard] Blocked Read …"), Bash cat=allow (…)` | CAUGHT |
| `r1-f1/both-deny-all` | r1-f1 | both guards → deny-all | fail (silent-on-correct-state direction) | `pass: … denied the out-of-scope Read and … denied the out-of-scope cat`; mutant ran: both guards answered `known-bad fixture: deny-all` | **ACCEPTED-KNOWN-BAD** (see #20) |
| `r1-f4/control` | guard-off still denies out-of-scope `cat`, still lets in-scope `sort` through | none | pass | `still denies an out-of-scope cat, and still lets an uncataloged in-scope command (sort) through` | CONTROL OK |
| `r1-f4/bash-allow-all` | r1-f4 | bash-guard → allow-all | fail, `cat=allow` | `got cat=allow (…), sort=allow (…)` | CAUGHT |
| `r1-f4/bash-deny-all` | r1-f4 | bash-guard → deny-all | fail, `sort=deny` | `got cat=deny (…), sort=deny (…)` | CAUGHT |
| `r1-f6/control` | Write to a readOnlyDirs path denied, Read allowed | none | pass | `Write into a readOnlyDirs-scoped path is denied; Read of the same path is not` | CONTROL OK |
| `r1-f6/path-allow-all` | r1-f6 | path-guard → allow-all | fail, `Write=allow` | `got Write=allow (…), Read=allow (…)` | CAUGHT |
| `r1-f6/path-deny-all` | r1-f6 | path-guard → deny-all | fail, `Read=deny` | `got Write=deny (…), Read=deny (…)` | CAUGHT |
| `r2-f3/control` | open finding: guard still grants `GIT_PAGER=/bin/sh git log` | none | pass (= finding reproduces) | `bash-guard.hook.ts grants "GIT_PAGER=/bin/sh git log" without ever inspecting …` | CONTROL OK |
| `r2-f3/bash-deny-all` | r2-f3 | bash-guard → deny-all | fail, `got deny` | `expected the guard to GRANT … got deny (…)` | CAUGHT |
| `r2-f3/bash-contradictory` | r2-f3 | bash-guard → contradictory, exit 1 | not a clean pass | `pass: bash-guard.hook.ts grants "GIT_PAGER=/bin/sh git log" …`; mutant ran: raw stdout = both `known-bad fixture: contradictory` lines, exit 1 | **ACCEPTED-KNOWN-BAD** (see #15, #23 C2) |

## The two ACCEPTED rows map to existing issues
1. **`r1-f1/both-deny-all`** is #20 / finding 7, already filed: "a deny-all … passes it". This row makes that failure re-runnable.
   - Reproduce: `… mutate.ts --only r1-f1/both-deny-all`
2. **`r2-f3/bash-contradictory`** is the last-line verdict parse (#15, `lib/spawn-hook.ts:93-97`) combined with r2-f3's missing contrast control (#23, class C2). The exit code (1) is captured but not used.
   - Reproduce: `… mutate.ts --only r2-f3/bash-contradictory`

This change fixes neither row. Those fixes are #20's, #23's and #15's.

## Limits
- **Checks covered:** the four `spawn-hook` checks only.
  - **Not covered:** the `unit-import` checks (r2-f1, r2-f2, r2-f4, r2-f5) and the `doc-grep` checks (r1-f2, r1-f3, r1-f5). These need module-level and document mutants (#23's mutants A and C) and are not attempted here.
- **Mutants:**
  - Three whole-guard mutants only. Partial bypasses are not modeled.
  - #23's mutant B (a bash guard that crashes on everything except `cat`) is not included.
- **Environment:** one machine, not the factory VM.
- **Not wired into CI:** it needs a cortex checkout.
