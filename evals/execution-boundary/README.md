# execution-boundary

Every finding from the NorthWoods Sentinel Labs (NWS) adversarial review of
`the-metafactory/cortex` — round 1 (2026-07-23) and round 2 (2026-07-27) —
as a permanent, runnable eval case. The rule this corpus exists to enforce:
**a future round automatically re-runs everything prior.**

Round 1 and round 2 each independently label their findings F1–F6, so cases
are namespaced by round: `r1-f1`..`r1-f6`, `r2-f1`..`r2-f6`. Do not conflate
`r1-f1` with `r2-f1` — they are different findings that happen to share a
label.

## Running it

```bash
bun run evals/execution-boundary/runner.ts               # all cases
bun run evals/execution-boundary/runner.ts --round 2      # one round
bun run evals/execution-boundary/runner.ts --id r2-f4,r2-f6
```

Most cases need a local checkout of `the-metafactory/cortex` (a public repo)
to import its exported-for-tests pure functions or spawn its hook scripts
directly against — this corpus verifies against the REAL guard code, never a
reimplementation (assay practice #2). Resolution order:

1. `ASSAY_CORTEX_REPO_PATH=/path/to/cortex` env var, if set.
2. A sibling `cortex` checkout next to this assay checkout
   (`~/Developer/cortex` next to `~/Developer/assay` — the ecosystem's
   standard sibling-repo layout).

No cortex checkout found → every case needing one **skips cleanly**, it does
not fail. That is the `requires-cortex-checkout` contract, not an error.

### Unit tests for the harness itself

```bash
bun test
```

The corpus verifies cortex. This verifies the thing doing the verifying —
`lib/*.test.ts`, no cortex checkout required, no network. It exists because
the harness has its own defect history: `lib/environment.ts` has now twice
shipped a bug in the seam between "recorded", "absent" and "merely present",
and both times the code read as though it had considered the case. A module
whose entire job is to refuse to overstate what it knows is exactly the
module whose refusals need testing, so the tests are mostly refusal paths
rather than happy paths.

## Case format — why JSON, not YAML

One JSON file per case (`cases/<id>.json`), validated against the shape in
`lib/types.ts`. JSON over YAML: Bun/Node parse it with zero dependencies (no
YAML library to pin, update, or trust), there is exactly one way to write a
given value (no flow-vs-block, no implicit typing footguns), and it stays
`git grep`-able the same way a YAML file would. The cost — verbose
multi-line strings need `\n` escapes instead of literal block scalars — is
worth it for "boring and greppable" over "pretty."

Each case carries (see `lib/types.ts` for the authoritative shape):

- **`finding`** — the finding, verbatim (or lightly excerpted) from its source.
- **`repros[]`** — the repro(s), **verbatim, never paraphrased** — the
  original review's repro (often "not attempted" for round 1), plus any
  follow-up repro cortex ran itself (e.g. EBH-0's `--add-dir` test), plus
  what this corpus's own check found when it ran the repro itself.
- **`provenance`** — who found it, when, which round, and the exact doc/API
  reference the text was pulled from.
- **`captured_on`** — the environment AND substrate identity present when THIS
  CASE's expectation was established (see "Environment & substrate attestation"
  below). Not the same thing as `provenance.date` — that's when the underlying
  finding was *discovered*; `captured_on` is when it was *locked into this
  corpus*.
- **`status`** — `fixed` / `open` / `accepted-residual` / `unverified`.
- **`fix`** — PR number + commit + summary, when `status: fixed`.
- **`verification`** — `method` (`unit-import` / `spawn-hook` / `doc-grep` /
  `none`), what it `requires` (`requires-cortex-checkout` / `requires-live-session`
  / `any` — a dependency, not an identity), and a pointer to its
  `checks/*.check.ts` module (or `null`, with a `note` explaining why none
  exists).

## Environment & substrate attestation

**"A result without its environment is not a result"** (charter,
"Environments"). Rob Chuvala (NWS) caught the gap this corpus originally
had: rounds 1 and 2 were locked in with no record of what they were
captured on. The original fix answered that under the wrong name —
`SubstrateStamp` — conflating two concepts the ecosystem keeps distinct:
**environment** (the machine: OS/arch/kernel/Bun) and **substrate** (the
coding harness a session runs on — Claude Code, Codex, Cursor, Pi.dev;
soma's word, per `compass/ecosystem/CONTEXT-MAP.md`). Fixed 2026-07-29:
the two are now separate modules, separate fields, and — because it turned
out the corpus was never actually recording substrate at all, under any
name — a genuine substrate capture was added alongside the rename.

### Environment (the machine)

`runner.ts` captures an `EnvironmentStamp` (`lib/environment.ts`) at the
start of every run — OS, arch, kernel release, Bun version, and (the field
that matters most, because every check here asserts against cortex's real
code) the cortex checkout's HEAD commit SHA and whether it was clean. It's
printed at the top of every run's output, before anything else.

### Substrate (the coding harness)

`runner.ts` also detects the coding harness via `detectSubstrate()`
(`lib/substrate.ts`), against the ecosystem's `HarnessId` vocabulary
(`claude-code`, `bus-peer`, `openai-codex`, `cursor`, `gemini`, `mistral`,
`pi-dev`, `agent-team`, `api-agent`). This is a real variable this corpus's
results depend on: a boundary check that holds under one coding harness
need not hold under another — different harnesses issue different tool
calls, expand paths differently, and open files by different routes.

Detection is honest, not assumed: it checks `CLAUDECODE=1` in the process
environment (Claude Code sets this in every subprocess it spawns) and
returns `claude-code` only when that's present. No other `HarnessId` has a
confirmed signal here, so anything else reads as `unknown` rather than a
guess — the same discipline the `os`/`arch`/`kernel_release` backfill below
uses. The 12 existing cases record `substrate: null`, not `"claude-code"`:
their re-established baselines were captured by a corpus run executed
directly on the factory VM, outside any coding harness, so no substrate
signal was present to detect — recorded as `null` per the same rule, and
each case's `note` says so. (Their original backfilled notes recorded the
circumstantial commit-trailer evidence that the cases were *authored* in
Claude Code sessions; that history lives in git.)

### Per-case baseline

Each case's `captured_on` field records the same shape — both environment
and substrate — as it stood when the case's expectation was established,
set once at authoring time, never auto-updated by a later run (a stamp
that updates itself on every run isn't recording a baseline, it's
recording "now").

**All 12 cases are pinned** (since 2026-09-03). A pinned baseline is one
whose `captured_on` records a factory-published `environment_digest` — a
machine identity that can be rebuilt and checked, not merely described —
alongside the cortex commit the checks actually ran against. Pinned is a
claim with teeth: on the factory VM the runner reports every case as
`match`; on any other machine it reports **drift** for every case, because
the baselines now *distinguish* machines. That drift on your laptop is the
system working, not a problem to fix.

It was not always so. The `r1-*`/`r2-*` cases spent their first weeks on
the **unpinned** count: their real capture-time environment was never
recorded, so they were backfilled honestly rather than retroactively —
only the corpus's own commit date known, every other field `null`, with a
`note` saying so instead of a field silently defaulting to something that
looks like data. That history (and the no-guessing rule it established) is
in each case file's git history; the rule still governs every new case and
every re-establishment. The count moved to zero only when the cases were
re-established from a real factory run — see the procedure below.

At the end of every run, a **third signal** — `ENVIRONMENT DRIFT`,
alongside `CORPUS INTEGRITY` and `SECURITY POSTURE` below — reports, per
case, over BOTH environment and substrate together:

- **unpinned baseline** (`captured_on` has no comparable field recorded —
  none today; the state every backfilled case was in before re-establishment)
  — loudest, because this is exactly the silent gap the finding named;
- **drift** (a recorded field disagrees with this run's readings, e.g. a
  different `cortex_commit`, or a different `substrate`) — informational,
  not a failure: it means this result isn't directly comparable to the one
  on file, not that anything is wrong;
- **match** — the quiet case.

Environment/substrate drift is never folded into `CORPUS
INTEGRITY`/`SECURITY POSTURE` and never fails the run — same reasoning as
the existing two-signal split: collapsing "not comparable" into pass/fail
is exactly the aggregate-green failure shape this repo exists to avoid.

### Re-establishing a baseline

`captured_on` is never auto-updated (see `lib/environment.ts`'s
doc-comment — a stamp that updates itself on every run records "now", not
a baseline). Moving a baseline is therefore a deliberate, human-committed
act, and this is the procedure for it.

A case is **re-established** when its check has been run on a
factory-built VM and its `captured_on` is updated from that run's real
`EnvironmentStamp` — every field (`os`, `arch`, `kernel_release`,
`bun_version`, `cortex_commit`, `environment_digest`,
`environment_provider_digest`, `substrate`), plus a `note` replacing the
previous one that says **when** it was re-established, **on what** (which
machine, which provider), and **from which run receipt** — the published,
independently validated evidence of the factory run the stamp came from.
A value that was not captured stays `null`, and the note says why; a
plausible guess is not a record.

**Mechanism — decided (assay#36):** the runner's `--re-establish` helper,
not manual per-case JSON editing. The reason: the values being moved are
two 64-hex-char digests and a 40-char commit SHA, and hand-transcribing
those twelve times is how a baseline ends up pinned to a typo — an
identity that matches nothing, which is worse than no identity because it
looks like one. The helper prints ready-to-paste `captured_on` blocks from
the **live** stamp of the run it is invoked in; it **never writes case
files** — a human pastes each block, reads the diff, and commits, so the
honest-null discipline stays intact: the machine removes transcription as
a failure mode, the human keeps the decision.

```bash
# on the factory VM, after a corpus run:
bun run evals/execution-boundary/runner.ts --re-establish --receipt <run-receipt-url>
```

The helper refuses to print (stderr, exit 1) rather than ever printing a
block containing a guessed value:

- no `--receipt` — a note must cite the run it is answerable to;
- no cortex checkout — nothing here ran against cortex's real code, so
  there is no expectation to re-establish;
- a dirty cortex checkout (or one whose cleanliness can't be determined) —
  the SHA alone would not pin the tree the checks read;
- no factory-published environment file — an unfingerprinted machine can
  only yield a fresh unpinned baseline wearing a re-establishment note;
- an environment file that was refused — distinct from absent, as
  everywhere else in `lib/environment.ts`: assay established nothing about
  the machine, which is not the same as establishing it has no identity.

Each refusal has an observed-red test in `lib/re-establish.test.ts` — the
guard is trusted because it has been seen firing, not because it reads
plausibly.

One honest asterisk on the first batch: the 2026-09-03 re-establishment of
all 12 cases predates the helper by one change (they landed together), so
those blocks were transcribed from the factory run's stamp **as published
in its run receipt** (smithy `evidence/ac-3.md`, validated check-by-check
on crucible#27) rather than printed by the helper on the VM — which is why
every one of those notes cites that receipt. Future re-establishments use
the helper on the machine itself.

## Check contract

A check module (`checks/<id>.check.ts`) default-exports:

```ts
() => Promise<{ outcome: "pass" | "fail" | "skip"; detail: string }>
```

**`pass`** means *reality still matches what the case documents* — for a
`status: "fixed"` case that means the fix holds (a regression guard);
for a `status: "open"` case it means the vulnerability still reproduces
exactly as described (so the finding hasn't silently regressed into a false
memory of being fixed, and a real fix will visibly flip this to `fail` —
that flip is the signal to update the case's `status`).

**`fail`** means reality diverged from the case. Read the detail — it is
deliberately worded to say which direction: a fixed-case regression (bad
news) or an open-case fix (usually good news, but still requires a human to
update the case's `status`/`fix` fields — a check flipping green on its own
is not the same as the corpus's own bookkeeping being updated).

**`skip`** means what this case `requires` isn't available here (no cortex
checkout, or a live `claude` session — several cases are
`requires-live-session` and cannot run until the account's weekly quota
resets; see the corpus run notes in the branch this was built on).

Two verification methods do most of the work:

- **`unit-import`** (`lib/import-cortex.ts`) — dynamically imports the real
  hook `.ts` file from the cortex checkout and calls its pure,
  exported-for-tests functions directly (`decidePath`, `parsePathGuardConfig`,
  `decideMcp`, ...). Fast, precise, and it's calling cortex's actual code.
- **`spawn-hook`** (`lib/spawn-hook.ts`) — spawns the real hook script as a
  subprocess with a crafted PreToolUse stdin payload, explicit env vars, and
  an explicit `cwd`, then parses its stdout decision. Used when the thing
  under test lives in `main()` itself (stdin handling, `cwd` trust, gating)
  rather than in an exported pure function.

Both talk to cortex's real, unmodified source — nothing in this corpus edits
or vendors a copy of cortex code, and no run of it writes anywhere inside the
cortex checkout (fixtures are throwaway `os.tmpdir()` trees; hook telemetry is
redirected to a scratch `CORTEX_EVENTS_DIR` so a run never touches a real
`~/.claude/events`).

## Status summary (as of the corpus's initial commit)

| Case | Round | Finding | Status |
|---|---|---|---|
| r1-f1 | 1 | No cortex-owned deterministic FS confinement | fixed |
| r1-f2 | 1 | Plugins run with full daemon authority, no sandbox | accepted-residual |
| r1-f3 | 1 | Sovereignty enforcement defaults to audit-only | fixed (posture now honest + reachable; still off by default, by design) |
| r1-f4 | 1 | Principal-DM disables the Bash guard entirely | fixed |
| r1-f5 | 1 | Good marks (loader.ts trust gates) | fixed (positive-invariant guard, not a defect fix) |
| r1-f6 | 1 | `readOnlyDirs` not deterministically read-only | fixed |
| r2-f1 | 2 | read-only silently overridden by overlapping allowed dir | fixed |
| r2-f2 | 2 | malformed config field fails open | fixed |
| r2-f3 | 2 | env-prefix stripping unmodeled | open (modeling gap confirmed; exec-escape itself unverified) |
| r2-f4 | 2 | MCP grant-grammar separator collision | open |
| r2-f5 | 2 | no denylist for boundary-weakening config files | open |
| r2-f6 | 2 | empty-path Glob/Grep trusts cwd unchecked | open |

Run the corpus for current, authoritative results — this table is a snapshot,
not the source of truth.
