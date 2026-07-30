# assay — Context

assay is a practice for knowing what is true about a system, at the pace
software is now built: every claim about a system is paired with an
executable comparison that can fail, and the pairing itself is checked
(`README.md`, "The goal"). This is the canonical domain glossary for the
**assay** bounded context — one canonical term per concept, aliases listed
under _Avoid_. Boundary terms shared with soma, cortex, and compass are
reconciled below and, where the ecosystem map has already ruled, in
`~/.config/metafactory/compass-main/ecosystem/CONTEXT-MAP.md` (installed
copy of `compass/ecosystem/CONTEXT-MAP.md`). Where it hasn't, this file says
so rather than inventing a ruling — see "Boundary with adjacent contexts".

This glossary exists because of a real error: an earlier draft of this repo
used **substrate** to mean the machine a check ran on, when the ecosystem
had already reserved that word for the coding harness a session runs on.
Corrected 2026-07-29 (`fix(lang): substrate vs environment`, PR #8) — a
community member outside this project caught it before any structure did.
The "environment vs substrate vs requires" entry below is the fix, made
durable.

## Language

### The corpus and its pieces

**Corpus**:
A directory under `evals/` holding one coherent set of **cases** plus the
**checks** and library code that verify them, e.g. `evals/execution-boundary/`.
"Every finding becomes a permanent case" (`evals/README.md`) is the rule a
corpus exists to enforce: a later round of findings against the same system
automatically re-runs every case a prior round already locked in.
_Avoid_: suite (implies a fixed pass/fail contract; a corpus deliberately
carries `open` cases that are meant to keep failing-as-documented), test
suite.

**Case**:
One permanent, JSON record of a single finding — `evals/<corpus>/cases/<id>.json`,
shaped by `CaseRecord` (`lib/types.ts`). A case carries the **finding**
verbatim, one or more **repros**, its **provenance** (who found it, when,
which round), its **attestation** (`captured_on`), what **correct** looks
like (`expected`, stated so it can be refuted), a **case status**, and a
**verification** block naming its **check** module. Namespaced by round —
`r1-f1`, `r2-f4` — because independent review rounds reuse their own F1–F6
labels; `r1-f1` and `r2-f1` are unrelated findings that happen to share a
label.
_Avoid_: test, ticket, issue (a case is a permanent record in the corpus,
not a tracked-to-closure item).

**Golden case**:
The artifact of **blueprinting** (Vincent Zontini's method,
`ideas/2026-07-28-blueprinting-golden-cases.md`): a known-good output,
captured once, compared against on every run — any variance is a finding,
full stop, because a total comparison has no assertion logic to be vacuous.
Named deliberately to avoid "blueprint" (already a separate ecosystem repo)
— "blueprinting" is the practice, "golden case" is the artifact it produces.
**Not yet built**: this is a proposed practice recorded in `ideas/`, not a
directory or format that exists in this repo yet. The idea's own proposal is
to *re-express* the existing JSON **case** format as golden cases rather
than maintain two formats side by side — that convergence has not happened.
Do not read "golden case" as a synonym for the current `cases/*.json`
records; they are verified by **check** modules (`unit-import` /
`spawn-hook` / `doc-grep`), not by total output comparison.
_Avoid_: blueprint (the sibling repo, `the-metafactory/blueprint`, is a
different thing entirely — don't let "blueprinting" bleed into that name).

**Runner**:
The script that discovers every `cases/*.json` in a corpus, loads each
case's matching **check** module (or records a clean **skip** if none
exists), executes it, and reports three independent signals — see
"Runner signals" below. One runner per corpus today
(`evals/execution-boundary/runner.ts`, invoked via
`bun run evals/execution-boundary/runner.ts`).

**Check**:
A module at `checks/<id>.check.ts` that default-exports a `CheckFn`:
`() => Promise<{ outcome: "pass" | "fail" | "skip"; detail: string }>`.
`pass` means *reality still matches what the case documents* — for a
`fixed` case that means the fix holds; for an `open` case it means the
vulnerability still reproduces. `fail` means reality diverged (which can be
good news — an undocumented fix — or bad news — a regression; `detail` says
which). `skip` means the case's `requires` isn't available in this run. Two
methods do most of the work today: **`unit-import`** (imports the real,
exported-for-tests function straight from the target checkout) and
**`spawn-hook`** (spawns the real hook script as a subprocess with a crafted
input). **`doc-grep`** and **`none`** are the other two `VerificationMethod`
values (`lib/types.ts`) — `none` is a legitimate, declared state (the case's
`verification.note` says why no automated check exists yet), not an
omission.
_Avoid_: assertion (too generic — a check is the whole pass/fail/skip
module, not one assertion inside it), test (see **Case**).

**Runner signals** (never merged into one number):
Three independent lines a run prints, deliberately kept apart because
collapsing any pair of them into one verdict is exactly the **aggregate
green** failure shape this repo exists to name:
- **Corpus integrity** — how many cases behaved as documented (pass) vs.
  diverged (fail) vs. couldn't run (skip). This is *not* a health score: a
  fully green corpus integrity line can still describe a pile of live,
  unfixed findings.
- **Security posture** — how many cases are documented `open`, named
  loudly. An `open` case **passing** means the vulnerability **still
  reproduces** — reading a passing corpus as "secure" is the mistake this
  line exists to prevent.
- **Environment drift** — see **Attestation**.
_Avoid_: reading a single "N/N passed" figure as the corpus's health; that
number alone cannot distinguish "everything is fixed" from "everything
insecure is behaving exactly as documented."

### Environment, substrate, requires — the three that collided

The exact split this repo's own naming error taught it to keep. Get this
distinction right before writing code or a case against it: these are three
different questions — *what machine*, *what harness*, *what's needed* — and
conflating any two of them is the mistake `fix(lang)` (PR #8) exists to
prevent from recurring. Canonical worked split:
`evals/execution-boundary/lib/environment.ts` and `lib/substrate.ts`.

**Environment**:
The **machine** a run executed on — OS, arch, kernel release, language
runtime version, and (for corpora that assert against another repo's code)
that checkout's commit SHA and dirty bit (`EnvironmentStamp`,
`lib/environment.ts`). "A result without its environment is not a result"
(README, "Environments") — a boundary check that holds on one kernel need
not hold on another. This is *the machine*, full stop; it says nothing about
what coding tool produced the session under test.
_Avoid_: substrate (the naming error this repo made and fixed — see below);
using "environment" for the five environment *tiers* the charter's "The
shape" section names (ephemeral container / VM / real host / multi-host /
physical-OT) — those are environment **classes**, not the per-run stamp.

**Substrate**:
The **coding harness** a session runs on — Claude Code, Codex, Cursor,
Pi.dev (`SubstrateId`, `lib/substrate.ts`). This word is **soma's** — soma
owns it ecosystem-wide as "the only word" and rejects `harness`/`host`/
`runtime` as aliases (`compass/ecosystem/CONTEXT-MAP.md`, boundary-terms
table). assay consumes the word, it does not coin it. `SubstrateId` mirrors
cortex's own closed enum for the same concept
(`cortex:src/common/substrates/types.ts` → `HarnessId`) as a **local
literal union, not an import**, so this repo stays runnable without a
cortex checkout; this is a known, accepted seam that can drift if cortex's
enum grows a member assay hasn't mirrored yet — not a hidden one.
Detection is honest, not assumed: only `CLAUDECODE=1` has a confirmed
signal here (`detectSubstrate()`); every other `SubstrateId` value reads as
`null` (genuinely unknown) rather than a guessed default. This matters
because agent behaviour is the thing that varies by harness — different
harnesses issue different tool calls, expand paths differently, open files
by different routes — so a boundary check proven on one substrate is not
automatically proven on another.
_Avoid_: environment (the inverse of this repo's naming error); harness,
host, runtime (soma's rejected aliases — see `CONTEXT-MAP.md`); treating
`SubstrateId` as authoritative over cortex's `HarnessId` — it is a mirror,
cortex's enum is the source.

**Requires**:
What a **repro** or a **check**'s verification *needs present to run* — a
**dependency**, not an identity (`Requirement`, `lib/types.ts`:
`requires-cortex-checkout` / `requires-live-session` / `any`). This is the
third axis, and the one most easily folded into the other two by mistake:
`environment` and `substrate` name **what something IS** (the machine, the
harness); `requires` names **what a repro or check NEEDS** to execute at
all, independent of whether it can currently get it (a `requires-cortex-checkout`
check with no checkout present **skips cleanly** — that is the contract, not
a failure). A case can be fully attested (`captured_on` populated) and still
`skip` on a given run because a `requires` dependency is absent; the two
never collapse into each other.
_Avoid_: conflating with **environment** ("requires" is a need, not a
machine identity) or **substrate** ("requires" is a need, not a harness
identity); dependency (fine informally, but the closed `Requirement` enum is
the canonical vocabulary — don't invent a fourth value ad hoc).

### Gates, classes, and the shape of a claim

**Gate** (lifecycle stage):
*When* something is checked, one of five stages named in README ("The
shape"): **Specification** (are acceptance criteria falsifiable, predictions
recorded before the run), **Build** (does declared behaviour match actual,
and: is this test even capable of failing), **Review** (are all call sites
covered, was an adversarial pass run), **Release** (does the artifact behave
as announced, can detectors prove they still fire), **Continuous** (drift
and decay only visible over time, never at build). None of `gates/`,
`scenarios/`, or `environments/` has content yet (empty directories,
Status: Early) — the five stages are the charter's shape, not yet a set of
executable gate definitions in this repo.
_Avoid_: conflating this lifecycle-stage sense with a **compass CI gate**
(e.g. `confidentiality-gate`, `shippable-hygiene`) — those are specific,
named, automated go/no-go checks that compass's own tooling runs; an assay
**gate** is the *stage of the lifecycle* a check like that would belong to,
a coarser-grained concept. compass has no `CONTEXT.md` yet to formally
reconcile against (only soma/cortex/myelin/signal do as of this writing,
per `CONTEXT-MAP.md`'s contexts table) — this line is assay's own
observation, not a ruling either side has made.

**Class** (question kind):
*What kind of question* a case or check asks, per README: `unit` ·
`contract` (do two layers still agree) · `integration` · `scenario`
(end-to-end, recovery, soak) · **`adversarial`** (can this be broken — a
different question from does it work) · **`eval`** (graded behaviour over a
corpus, not binary) · **`capability`** (what a host supports — feeds
decisions, not pass/fail). The `execution-boundary` corpus's cases are
adversarial-regression in character (do NWS's findings still reproduce) but
the corpus itself does not yet tag cases with a `class` field — the
vocabulary is charter-level, not yet a schema field.

**Finding** vs **repro** vs **expected**:
Three parts of a case's claim, kept distinct in `CaseRecord`: the
**finding** is the original claim, verbatim from its source, never
paraphrased; a **repro** (`ReproRecord`) is one attempt to reproduce it —
carrying its own `requires` and `outcome`, since the original reviewer's
repro and this corpus's own follow-up repro are different attempts recorded
side by side; **expected** is what correct looks like, stated so it can be
refuted. A case's **check** verifies the repro against the expected
statement; it does not re-derive either from the finding text.

### Case status

**Case status** (`CaseStatus`, `lib/types.ts`): `fixed` | `open` |
`accepted-residual` | `unverified`. What each means, per
`evals/execution-boundary/README.md` and the runner's own framing:
- **`fixed`** — the finding was remediated; a passing check is a regression
  guard, and a check flipping to `fail` on a `fixed` case is bad news.
- **`open`** — the vulnerability is still present by design of the record;
  a passing check means the finding **still reproduces**, and a check
  flipping to `fail` here is *usually* good news (the finding may have been
  fixed) but still requires a human to update `status`/`fix` — a check
  going green on its own is not the corpus's bookkeeping updating itself.
- **`accepted-residual`** — the finding is confirmed present and
  deliberately not remediated (e.g. `r1-f2`: plugins run with full daemon
  authority by design, ADR-0024 D4). A passing check confirms the accepted
  posture is still accurately documented, not that anything is "wrong."
- **`unverified`** — inferred from the schema by elimination, since no case
  in this corpus currently carries this status (all twelve are `fixed`,
  `open`, or `accepted-residual`): a finding recorded but not yet
  re-confirmed against current reality either way. **Flagged, not
  established**: do not treat the description above as a worked
  definition — there is no example to point to yet. Distinct from a repro
  that couldn't run because its `requires` was unavailable (that is a
  property of one `ReproRecord`, not the case's own `status`).

### Attestation

**Attestation** (verb: to attest; noun: the record it produces):
The practice of recording a case's **environment** and **substrate**
identity *at the moment its expectation was established* — not at whatever
moment it was last run. "A result without its environment is not a result"
(README) names the requirement; `captured_on` is where a case keeps the
answer.

**`captured_on`**:
The field on `CaseRecord` (`CapturedOnStamp`, `lib/environment.ts`) holding
both halves of a case's attestation — environment fields (`os`, `arch`,
`kernel_release`, `bun_version`, `cortex_commit`) and `substrate` — as they
stood when the case's check first locked in, plus a `note` that is
**required whenever any field is null**, explaining what's actually known
and why the rest isn't reconstructable. Every field is nullable **on
purpose**: an honestly-`null` field beats a plausible-looking guess. The
twelve existing cases were backfilled honestly rather than retroactively —
their real capture-time environment was never recorded, so `captured_on`
says so instead of inventing one. This is the concrete meaning behind
"never fabricate an attestation: an inferred pin is worse than an honest
unknown" (see also `docs/agents-md/critical-rules.md`).

**Unpinned baseline** vs **drift** vs **match**:
The three outcomes `assessDrift()` reports when comparing a case's
`captured_on` against the current run (`DriftAssessment`, `lib/environment.ts`).
**Unpinned baseline** — no comparable field was ever recorded (every case
in this corpus today) — is reported **loudest**, because it is exactly the
silent gap the finding that created this module named. **Drift** — a
recorded field disagrees with this run (different commit, different
substrate) — is informational, not a failure: the result isn't directly
comparable to the one on file, not that anything broke. **Match** is the
quiet case. None of the three ever fails a run or folds into **corpus
integrity** — same discipline as keeping **security posture** a separate
line.

### Fault injection

**Fault injection**:
Deliberately triggering a fault so a detector's ability to *fire* can be
observed directly, rather than trusted on the strength of its configuration
looking correct. Named in README ("How we will know it is working") as one
of the still-missing yield measures this repo does not yet have: "detectors
proven — how many guards have been observed going red against an injected
fault, with the proof recorded." **Not yet a mechanism in this repo** —
there is no `injectFault()` helper, no fault-injection harness, and no case
field that records one. The closest existing practice is narrower: a
**check** like `spawn-hook` feeds a *crafted* input to real guard code and
observes the decision, which exercises the control but does not yet
constitute a generalized, repeatable fault-injection capability. Rob
Chuvala's framing (`ideas/2026-07-27-red-team-lens-control-assurance.md`)
is the clearest statement of why it matters: "you never trust a green
light, you verify a control by trying to trip it."
_Avoid_: reading any case's `spawn-hook` check as "fault injection" in the
generalized sense above — it is one narrow instance of the same idea, not
the missing capability itself.

### The five failure shapes

Named in README ("Why this exists") as one idea seen from five angles — "a
claim exists and nothing forces the comparison" — not five unrelated bugs.
Used as load-bearing vocabulary elsewhere in this repo (e.g. `runner.ts`'s
comments cite **the aggregate green** by name to justify why its three
signals are never merged):

- **The silent detector** — a monitor that is configured, correct-looking,
  and never fires; a control that cannot alarm is not weak, it is absent,
  and it also buys false confidence for free.
- **The test that cannot fail** — a check that computes its expected value
  using the code under test; green forever, meaningless forever.
- **The aggregate green** — a rollup ("seven of seven healthy") that hides
  components with no check at all, or one designed to stay green while
  disconnected.
- **The second call site** — a fix that lands on the path named in the bug
  report while a sibling path stays open, because the fix was shaped like
  the bug report rather than enumerated against every call site.
- **The declared boundary** — a rule written in prose, config, or a
  manifest, and never enforced at the moment it matters.

## Boundary with adjacent contexts

Authority for cross-repo terms is
`compass/ecosystem/CONTEXT-MAP.md` (installed copy:
`~/.config/metafactory/compass-main/ecosystem/CONTEXT-MAP.md`). **assay is
not yet listed in that map's contexts table** (only soma, cortex, myelin,
and signal carry a ✅ `CONTEXT.md` there as of this writing) — this file is
assay's own glossary, written to the same shape, but its cross-repo claims
below are assay's reading of the map, not an entry the map itself has
ratified yet. Flagged, not resolved by fiat.

- `assay:substrate` **≡** `soma:substrate` — the coding harness a session
  runs on. soma owns the word ecosystem-wide; assay consumes it, and
  `SubstrateId` mirrors `cortex:HarnessId`'s enum values without importing
  it (see **Substrate**, above). No conflict — this is the word working as
  designed after this repo's own naming fix.
- `assay:environment` has **no boundary term to reconcile against**: it is
  not `cortex:environment` (cortex's `CONTEXT.md` has no such entry — cortex
  reasons about `stack`/`principal`/`network` deployment topology, not "the
  machine a check ran on") and not `soma:environment` (soma's glossary
  doesn't define the word either, as far as this repo's authors could
  determine). assay's **environment** is a locally-scoped term with no
  known collision, not a term this repo is claiming ecosystem-wide.
- `assay:capability` is **distinct from** `cortex:capability` (a
  bus-routable ability tag an assistant declares) and from
  `assay:environment class` "capability" (README's `class` vocabulary: "what
  a host supports"). assay does not currently use the bare word
  `capability` as a term of art of its own — where README's `class` list
  uses it, it means cortex's/soma's general sense (what a host/system
  supports), not a defined assay concept. No case field or type in this
  repo is named `capability`.
- `assay:session` — assay does not define this term. Where a case's
  `requires-live-session` value names "a real `claude` CLI session," that is
  `cortex:session` / soma's substrate-hosted session concept, used exactly
  as those contexts define it (one run of a **substrate**) — not a redefinition.
- `assay:gate` is **narrower-grained than, and does not conflict with**, a
  compass CI gate (`confidentiality-gate`, `shippable-hygiene`, etc.) — see
  the **Gate** entry above. compass has no `CONTEXT.md` yet to formally
  reconcile against.
- `assay:skill` — not used. Where this repo's checks call into another
  repo's code, they call **exported functions** or **spawn scripts**
  directly (`unit-import` / `spawn-hook`), never through a soma **skill**
  invocation. If that changes, it should be reconciled against
  `soma:skill` at that time, not assumed compatible now.

### Flagged, not resolved

- **For a generic eval case, is the machine or the harness "the" thing
  that needs pinning?** The `execution-boundary` corpus pins both
  **environment** and **substrate** because its checks exercise agent
  guard code whose behaviour plausibly varies by coding harness. But
  nothing in this repo, `compass/ecosystem/CONTEXT-MAP.md`, or any
  adjacent context's `CONTEXT.md` states which one is authoritative — or
  whether *both* are required — for a **generic** case that isn't
  specifically about agent/session behaviour (e.g. a future golden case
  over deterministic infrastructure output, per
  `ideas/2026-07-28-blueprinting-golden-cases.md`, where "substrate" in
  Vincent's original sense was the machine image, not a coding harness at
  all). This repo takes no position on the generic answer here — it is an
  open question, named so the next case author doesn't have to rediscover
  it, not a ruling.
