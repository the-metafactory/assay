# Design: the testing factory

**Status:** Draft for review — decisions DD-1..DD-10 are proposals, not settled
**Author:** Luna (with Andreas)
**Contributors whose work this specifies:** Robert Chuvala (NorthWoods Sentinel), Vincent Zontini, Magnús Smárason
**Refs:** [`../README.md`](../README.md) (charter) · [`../CONTEXT.md`](../CONTEXT.md) (language) · `ideas/` (source notes) · [vision#4 §5a](https://github.com/the-metafactory/vision/issues/4) · cortex#2341

---

## 1. Problem

The charter states the goal:

> Every claim we make about a system is paired with an executable comparison that can fail — and the pairing itself is checked.

What the charter does **not** do is decide anything. It names five failure shapes, lists practices, and describes a taxonomy. Meanwhile the repo contains one corpus of 12 cases, a bespoke runner, and three tray notes describing methods nobody has implemented.

Three specific gaps this spec closes:

1. **No prior-art grounding.** Nearly everything here was derived from live failures and independently reinvented. Publishing without naming what it rests on would be both misleading and wasteful.
2. **No decisions.** Build or adopt? Which harness? What counts as done for each gate?
3. **No measures with definitions.** The charter lists five candidate measures. None is defined precisely enough to compute.

---

## 2. Prior art — what we are standing on

Stated first, because it constrains every decision after it. **We are rediscovering, not inventing.** Arriving at these from real failures is why we understand them; it is not a reason to rebuild them.

| Our term | Established name | Source |
|---|---|---|
| Blueprinting / golden output (Vincent) | **Approval / characterization testing** ("golden master") | Feathers, *Working Effectively with Legacy Code*; ApprovalTests |
| "Can this test fail?" (Rob) | **Mutation testing**; its metric is *mutation score* | DeMillo/Lipton/Sayward 1978; Stryker, PIT, mutmut |
| Fault injection (Magnús) | **Chaos engineering** + "monitor the monitors" | Netflix; Google SRE; Prometheus Watchdog |
| Environment/substrate pinning | **Hermetic & reproducible builds** | Bazel, Nix, reproducible-builds.org |
| "Find upstream, lock downstream" (Rob) | **Fuzzing + regression corpus** | OSS-Fuzz, libFuzzer |
| Claim paired with comparison | **Design by contract**; **property-based testing** | Meyer/Eiffel; QuickCheck, Hypothesis |
| Cross-layer contract | **Consumer-driven contract testing** | Pact |
| Detector precision / alert fatigue | **Precision–recall**; SLO alerting | Google SRE ch. 6 |
| Graded case corpora | **LLM evals** — pass@k, LLM-as-judge, rubric scoring | OpenAI Evals, DeepEval, UK AISI Inspect |
| The whole practice | **Eval-driven development (EDD)** — TDD adapted for non-deterministic output | Airbnb Engineering, *Lessons from Evaluating GenAI at Scale* |
| Agent traces, trajectory eval, data-quality blind spots | **Agent observability** (distinct from LLM observability) | Monte Carlo, *Agent Observability*; OTel GenAI semconv |

### What is genuinely ours

Being fair to the work, four things do not map cleanly onto prior art and are the publishable contribution:

- **The five failure shapes as a collected taxonomy**, with the unifying mechanism named: a claim exists and nothing forces the comparison.
- **Three-signal reporting** — separating *did the case behave as documented* from *is the system safe* from *is the baseline pinned*. Standard harnesses collapse these into pass/fail, which is how an open finding hides under a green rollup.
- **Substrate attestation for agent work.** Labs pin model versions. Nobody pins the **coding harness** — and a boundary check that holds under one harness need not hold under another.
- **The agent execution-boundary corpus** itself.

---

## 2b. A sixth failure shape: the healthy trace

The charter names five shapes, all found in our own systems. A sixth arrives from outside, and it has been independently observed twice, which is the bar the other five met.

> **The healthy trace.** Every step is correct, every span is green, the agent did exactly what it was told — and the answer is wrong, because the input was stale, unindexed, or never loaded.

Monte Carlo puts it precisely: *"plenty of bad answers start out as a stale table or a broken pipeline… your trace will look perfectly healthy, because the agent did exactly what it was told with the numbers it was handed."*

We have our own instance and did not recognise it as a shape at the time. Magnús's audit found **455 of 602 knowledge files never added to the index that loads them** — so they existed and influenced nothing. Every read succeeded. Every trace would have looked healthy. The corpus was simply not there.

**Why it belongs with the other five:** it is the same mechanism one layer upstream. A claim ("the agent has this context") with nothing forcing the comparison. Process correctness is *asserted by the trace* and mistaken for answer correctness.

**What it implies for us:** the inputs an agent is handed are themselves claims requiring paired comparisons — is the index complete, is the file loaded, is the map current. Tracing the agent will never surface it, because the agent is behaving perfectly.

---

## 3. Design decisions

### DD-1 — Adopt an existing eval harness; do not grow our own
**Decision:** migrate the corpus onto **UK AISI Inspect**. Keep the bespoke runner only until parity is proven, then delete it.

**Why:** Inspect's *dataset + solver + scorer* model with sandboxed tool support is almost exactly the case/check/runner shape we built, except mature and externally maintained. Ours is days old and has 12 cases. Migration is cheap now and expensive at 200.

**Rejected:** *promptfoo* — strong CI ergonomics and built-in red-teaming, but OpenAI acquired it in March 2026; for a project whose thesis includes sovereignty, a core dependency owned by one lab deserves at minimum a deliberate decision rather than a default. *DeepEval* — pytest-native, and this ecosystem is Bun/TypeScript. *Keep our own* — rejected on the "don't reinvent" test that this whole section exists to apply.

**Open:** Inspect is Python; the ecosystem is TypeScript. This is a real cost and DD-1 is the decision most likely to be wrong. See OQ-1.

### DD-2 — Mutation testing is the meta-gate's implementation
**Decision:** run **Stryker** over the corpus checks; publish the mutation score as a first-class measure.

**Why:** Rob named "can this test fail?" as the keystone and least-built gate. It is a solved problem with an off-the-shelf tool and a numeric metric. We do not need to invent a way to ask whether our tests can fail.

### DD-3 — Fault injection is required before any detector is trusted
**Decision:** adopt Magnús's protocol verbatim. A guard is untrusted until it has been **observed failing** against the fault it exists to catch, and the injected fault plus the observed red output are recorded beside the check.

**Why:** *"A claim that a detector works decays into folklore within weeks; the re-runnable injection does not."* This is the operational form of DD-2 for things mutation testing cannot reach — live guards, monitors, alerts.

**Corollary (Magnús's false positive):** a detector that fires on a correct configuration trains people to ignore it. Noise and silence are the same failure at opposite ends, so injection must prove **both** directions: fires on the fault, silent on the correct state.

### DD-4 — Environment and substrate are attested, never inferred
**Decision:** every result carries an environment stamp (os, arch, kernel, tool versions, code SHA) and a substrate identity (the coding harness). Where either is unknown, it is recorded as **unknown** — never guessed.

**Why:** already implemented (PR #7, #8) after Rob and Vincent independently found it missing. An inferred pin is worse than an honest unknown, because it looks like evidence.

### DD-5 — Golden cases are the default comparison; the exact/bounded boundary is governed
**Decision:** adopt Vincent's blueprinting as the primary mechanism. Two assertion classes, with the boundary explicit:

- **exact** — filesystem shape, permissions, hashes, generated config/code, tool-call sequences. Byte-for-byte; any variance is a finding. **Kept as large as possible.**
- **bounded** — model prose. Assert schema and structure, never bytes.

Moving a case from exact to bounded **requires a commit explaining why** (guarding *bounded creep*).

**Why:** a total comparison has no assertion logic to be vacuous — it is structurally resistant to the test-that-cannot-fail. And a control manifest listing *expected* paths turns a **missing** file into a variance, which is the silent-detector fix.

### DD-6 — Observability rides OpenTelemetry GenAI semantic conventions
**Decision:** use OTel GenAI semconv for session traces rather than a bespoke schema.

**Also required — trajectory evaluation, not just final output.** Two independent sources say the same thing: Airbnb evaluates agent-level correctness, sub-agent correctness, **and** path efficiency; Monte Carlo notes agents produce hierarchical traces where final-output checks miss tool-selection errors and infinite loops. Our corpus currently checks only terminal decisions (allow/deny) — correct for boundary work, insufficient for anything behavioural.

**And the loop closes the other way:** production failures should become cases automatically. That is our findings-become-regressions rule, independently arrived at, and it is the capability both sources flag as inconsistently implemented in existing tools.

**Why:** it is the standard the tooling ecosystem is converging on, and it serves three separate needs at once — Vincent's observability substrate, Magnús's guards, and evals over **real traces** rather than only synthetic cases. That last one is a genuine gap: our corpus never observes a live session.

### DD-7 — Environment before corpus
**Decision:** environment/reset work is a prerequisite, not a parallel track. Vincent's sequencing stands: the agent's world must be deterministic and green before assistant behaviour is meaningfully testable.

**Why:** we already built it in the wrong order and only discovered the unpinned baseline because a reviewer asked. **A green assistant test on an unverified environment is an aggregate green.**

### DD-8 — The audience is external
**Decision:** every artifact is judged by *"could someone outside this project apply it on day one?"* The shareable output is the **practice**; cortex is the first proving ground and the corpus is evidence, not the product.

### DD-9 — Three evaluation layers; we currently have only the first
**Decision:** adopt Airbnb's three-layer stack and state plainly where we sit.

| Layer | What it does | Our status |
|---|---|---|
| **1 — programmatic** | deterministic checks: format, bounds, validity, exact comparison | **all 12 cases** |
| **2 — LLM-as-judge** | nuanced qualities against a rubric, one dimension per judge | **none** |
| **3 — human** | validates edge cases, recalibrates the layers above | **none** |

**Why it matters:** our corpus is entirely layer 1, which is fine for boundary checks (allow/deny is deterministic) and useless for anything about agent *quality*. Claiming eval coverage while holding only layer 1 would be an aggregate green about our own evals.

**Constraint carried from Airbnb:** never build "God evaluators" — each judge targets exactly one dimension. 3–5 specialised, well-calibrated judges beat many noisy ones. That is our detector-precision standard restated for judges.

**Also carried:** golden sets must contain **failures**. *"You can't test discernment without negative examples."* We have this accidentally right — an `open` case is a negative example, which is why an open case passing means the vulnerability still reproduces.

### DD-10 — A judge is untrusted until calibrated; and if humans disagree, stop
**Decision:** no LLM-as-judge enters service without calibration against 50–100 human-labelled examples, measured agreement in the high 80s–90s, disagreements analysed, and periodic recalibration as failure modes shift.

**Why:** *"an uncalibrated judge creates false confidence."* That is precisely our silent-detector shape wearing eval clothing — an instrument that reports confidently while detecting nothing.

**Note the symmetry with DD-3.** Fault injection proves a detector can fire; calibration proves a judge can discriminate. **They are the same rule: prove the instrument before trusting its output.** That is the meta-gate generalised, and it is the strongest argument that the meta-gate is the keystone rather than a nicety.

**The harder half — a rule we should have applied to ourselves:** *"if your experts disagree on a label, stop. Solve human disagreement before automating anything."*

Four people used **substrate** to mean two different things in this repo's first week. Had we automated a judge on top of that disagreement, we would have baked the confusion into scores nobody could interpret. So `CONTEXT.md` was not bureaucracy — it was a precondition, and we built it late.

**Corollary:** rubric ambiguity is the enemy. Prefer explicit error categories over vague standards.

---

## 4. Gates — with machine-checkable criteria

The charter names five gates but not what passing means. Proposed:

| Gate | Machine-checkable criterion |
|---|---|
| **Specification** | Every acceptance criterion is falsifiable. Predictions recorded **before** the run, including predicted failures. A spec with no refutable claim fails this gate. |
| **Build** | Tests pass; **mutation score ≥ threshold** (DD-2); no test derives its expected value from the code under test. |
| **Review** | Every call site of the changed behaviour enumerated, not just the reported one. Each claim in the PR traced to code. Adversarial pass recorded. |
| **Release** | Artifact behaves as announced. **Every detector has a recorded fault-injection proof** (DD-3). Attestation present (DD-4). |
| **Continuous** | Config references still resolve against live reality. Golden diffs clean or variances triaged. Detector proofs re-run on a schedule. |

---

## 5. Measures — defined well enough to compute

| Measure | Definition | Current value |
|---|---|---|
| **claims paired** | load-bearing claims with an executable comparison ÷ total identified | unknown — no claim inventory exists |
| **mutation score** | mutants killed ÷ mutants generated, over corpus checks | **0 — never run** |
| **detectors proven** | guards with a recorded fault-injection proof ÷ total guards | **0 of n** |
| **time-to-detection** | wall-clock from fault introduced to a non-human signal | unmeasured |
| **judge agreement** | judge-vs-human label agreement on the calibration set (DD-10) | n/a — no judges exist |
| **findings locked** | findings with a permanent case ÷ total findings | 12 of 12 for NWS r1–r2; 0% elsewhere |
| **unpinned baselines** | cases with no comparable environment+substrate recorded | **12 of 12** |

Three of six are zero and one is 100% bad. That is the honest baseline and the reason to measure.

---

## 6. Non-goals

- **Discovery.** assay locks in known-good; it does not find unknown-bad. The adversarial cases are regression, not bypass discovery. Discovery is a separate engine; the two compose — *find upstream, lock downstream*. A factory that believed it was also a discovery engine would produce the most dangerous aggregate green of all. *(Rob's boundary.)*
- **Alerting.** Findings write to files read at session start. Magnús built his guards while fixing alert fatigue — one monitor had 2,759 consecutive failures renotifying every six hours. Adding a channel would be self-defeating. Guard failures are also **not** pipeline failures: a stale map entry is hygiene, not an outage.
- **A framework.** This repo is an evolutionary foundation. Layout and formats are expected to be replaced.

---

## 7. Open questions

**OQ-1 — Inspect is Python; the ecosystem is TypeScript.** *Recommendation: spike Inspect against three existing cases before adding a fourteenth.* Decide on evidence, not on language preference. If the boundary is ugly, reconsider promptfoo with the OpenAI-ownership caveat stated explicitly.

**OQ-2 — Container or VM for the environment tier?** Vincent's question: standard installs may suit containers, but cortex's own test paths deploy containers, implying nested virtualisation. *Recommendation: judge by Rob's criterion — whichever yields a content-addressable identity recordable at lock time and again at replay.* Note this may not settle it, since that is a property of the artifact rather than the runtime. Awaiting JC's CI/CD read.

**OQ-3 — Does a generic eval case need the machine or the harness pinned?** No ruling exists here, in `CONTEXT-MAP.md`, or in any adjacent context. *Recommendation: both, until a counterexample appears* — and raise it as a context-map addition.

**OQ-4 — Where does the continuous gate run?** It needs live credentials to resolve references against reality, so build-time CI may be the wrong home. *Recommendation: session-start, following Magnús's file-based pattern, not a pipeline stage.*

**OQ-5 — ARM coverage.** Everything so far was captured on Apple Silicon and nothing recorded it. *Recommendation: treat as a declared variance in case identity, not a hardware purchase.*

---

## 8. Delivery

Ordered by DD-7 — environment before corpus.

1. **Environment tier + desired-state reset** (Vincent) — the prerequisite.
2. **Mutation score on existing checks** (DD-2) — one command, produces a real number this week.
3. **Fault-injection protocol + first proofs** (DD-3, Magnús) — a markdown file beside the checks was enough for him.
4. **Inspect spike** on three cases (OQ-1) — decide DD-1 on evidence.
5. **Golden-case format** (DD-5), then re-express the corpus rather than maintaining two formats.
6. **OTel semconv traces** (DD-6) — unlocks evals over real sessions.

**Definition of done for the spec itself:** every DD either accepted, rejected with reasoning, or converted to an OQ with a recommendation. No DD stays "proposed" once work starts against it.
