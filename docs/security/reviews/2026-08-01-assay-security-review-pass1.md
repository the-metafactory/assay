# assay security review — pass 1 (runner + harness integrity), 2026-08-01

Scope: `the-metafactory/assay`, `evals/execution-boundary/runner.ts` + libs (cloned fresh /root/assay, ~1454 LOC). Frame (Rob's DM): can the gates be fooled / harness subverted? Findings verified against read code, not speculation. **DISCLOSURE-GATED: private to maintainers first (Rob's DM line), Rob sends, scope not yet veto-confirmed by Andreas. Do NOT post to #assay/GitHub.**

## What's GOOD (state it — a review that only finds bad is dishonest)
The runner fails CLOSED on the obvious paths: a check module that won't load → `fail` (runner.ts:76-84); a check that throws → `fail` (:89-97); no check module → `skip` (declares what wasn't verified, not silent-omit). And its headline design is sophisticated: it **refuses to merge pass/fail into one health number** — `CORPUS INTEGRITY` (behaved-as-documented) is surfaced separately from `SECURITY POSTURE` (open-finding count), explicitly defeating the "aggregate green = healthy" failure the repo was founded to name (:143-165). Environment drift is a third, never-merged signal. This is well-built; the core integrity discipline holds.

## Findings

**F-A (HIGH) — case JSON → unbounded dynamic import, no path containment = code execution on an untrusted corpus.**
`runner.ts:71` `checkPath = join(HERE, c.verification.check)` then `:74` `await import(checkPath)`, where `c.verification.check` is a string read straight from `cases/*.json` (JSON.parse, :47). `join()` does NOT contain `../` — a case whose `verification.check` is `"../../../../root/evil.ts"` (or an absolute path) imports and executes a module OUTSIDE `checks/`. For assay's OWN cases this is trusted input; the risk materializes the moment assay ingests a case it didn't author — a **shared corpus, a contributed PR case** — which is precisely assay's stated goal ("someone outside picks it up and runs it on their own system," "a practice other people can run"). A tool whose thesis is portability executes arbitrary code from a data file it treats as trusted. Same class as the classic path-traversal→RCE findings. Fix: resolve `checkPath`, assert it stays within `CHECKS_DIR` (realpath prefix check), reject otherwise; treat case JSON as untrusted input.

**F-B (MEDIUM) — no timeout on `checkFn()`; a hung check stalls the corpus with no signal.**
`runner.ts:87` `await checkFn()` is unbounded. `spawn-hook.ts` has a per-spawn timeout, but a check that hangs OUTSIDE a spawn (infinite loop, un-timeout'd network/IO) hangs the whole run forever — no pass, no fail, no result. A testing factory that can be made to produce NO signal is the silent-gap it exists to prevent. Fix: wrap `checkFn()` in a `Promise.race` timeout → `fail` on expiry (mirror spawn-hook's pattern at the runner level).

**F-C (LOW-MED) — check outcome is self-reported and not validated.**
`runner.ts:88` passes `result.outcome` straight through with no check that it ∈ {pass,fail,skip}. A check returning `undefined`/`"PASS"`/garbage is mis-badged (`badge()` defaults non-pass/fail to "SKIP", :100-104) and corrupts the counts. The tested artifact self-reporting its own verdict, unvalidated, is the same class as trusting a subagent's self-reported completion (the Straight Edge mediator lesson: validate the shape, don't trust the reporter). Fix: validate `result.outcome`; malformed → `fail`.

## The through-line worth naming to Andreas
F-A and F-B are the same shape as **the F2 bug I fixed in Straight Edge tonight**: fail-open / no-containment on the *unknown*. assay's runner fails closed on the errors it anticipates (load, throw) but not on the ones it doesn't (traversal, hang). That's the honest, non-preachy way to deliver it — "your harness holds where it expects trouble; here are the two edges where the unexpected slips through," which is exactly the offensive eye's value and the "can the gates be fooled" answer.

Owed: F-D scan of spawn-hook.ts / import-cortex.ts / substrate.ts (attestation-spoof via env) — pass-2. Ties: [[2026-07-31-andreas-dm-team-up-with-vincent-infra-uplift]], [[project_sordino_sentinel_bridge_built_2026_08_01]] (F2 same class).
