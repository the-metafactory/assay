# assay

**A practice for knowing what is true about a system, at the pace software is now built.**

> *assay* — a test to determine what something actually contains, as opposed to what it is labelled as.

---

## The goal

> **Every claim we make about a system is paired with an executable comparison that can fail — and the pairing itself is checked.**

That is the whole thing. Everything below is machinery for it.

It is deliberately *not* "write more tests". A test is one kind of comparison, and most claims in a running system have none at all: a detector claims coverage, an aggregate claims health, a fix claims completeness, a boundary claims enforcement, a config claims a policy still holds. Each is a claim. Very few are paired with anything that could contradict them.

**A claim without a paired, re-runnable comparison is folklore.** It may well be true. You cannot tell, and it decays.

## What this is

**A diagnostic instrument.** Install it, point it at a project, and it reports what that project can currently *prove* about itself — and where it cannot.

It is **not a factory** (ADR-0001). A factory is a member-operated production capability — an operator, their agents, their installed stack, turning models into outcomes (`vision/factory-of-factories.md`). This repo is distributed, and produces a report. It is the instrument such a factory would use.

The repo launched as "the testing factory", which was an overclaim on a word that already had a definition. Corrected 2026-07-31; the bar for earning it is explicit — when a second project's verification is cheaper than ours was.

## Who this is for

Not only us. The intended output is **a practice other people can run against their own systems** — not our test cases. cortex is simply the first system it was proven against, and the corpus here is *evidence the practice works*, not the product.

So the bar for anything in this repo is: **could someone outside this project pick it up and apply it on day one?** If it only makes sense with our context loaded, it is not finished.

## How we will know it is working

We do not have this yet, and that is itself a finding. A factory with no yield measure is not a factory.

Candidates, deliberately concrete:

- **claims paired** — how many load-bearing claims have an executable comparison, and how many do not
- **detectors proven** — how many guards have been *observed going red* against an injected fault, with the proof recorded
- **time-to-detection** — when something breaks, how long before something other than a human noticing says so
- **findings locked** — what fraction of findings became permanent cases
- **unpinned baselines** — cases whose environment or substrate was never recorded

The first honest run of these will look bad. That is the point of measuring.

---

## Why this exists

AI moved the bottleneck. Writing code used to be the expensive part, and our verification habits were built for that world: review the diff, run the suite, ship. When a system can produce a week of changes in a night, the expensive part becomes **knowing whether any of it is true**.

Our tests mostly answer *"did the thing I wrote do what I meant?"* They rarely answer *"is this control actually doing anything?"* — and at pace, the second question is the one that bites.

In a single week, two unrelated systems — an agent security boundary and a remote field deployment — independently produced the same failure shapes. That repetition is the point: these are structural, not carelessness, and they will not be fixed by trying harder.

- **The silent detector.** A monitor configured, correct-looking, and it never fires. Telemetry died for hours with a staleness alert provisioned and routed; the gap was found because a human opened a dashboard. A control that cannot alarm is not a weak control — it is an absent one that also buys false confidence.
- **The test that cannot fail.** A regression test that computes its expected value using the code under test. Green forever, meaningless forever.
- **The aggregate green.** "Seven of seven healthy" — where two of the seven had no healthcheck defined and one was designed to stay green while disconnected.
- **The second call site.** The fix lands on the path named in the bug report; the other path stays open. One epic hit this three times.
- **The declared boundary.** A rule written in prose, config, or a manifest, and never enforced at the moment it matters.

## The one idea

**A practice written down decays. A practice encoded as a gate cannot be skipped, forgotten, or self-verified around.**

The five shapes above are not five problems. They are one, seen from five angles: **a claim exists and nothing forces the comparison.** That is why the goal is stated as a pairing rather than as a list of things to test — the list can never be complete, the pairing rule can.

Documents are what we write for the parts we cannot yet automate. Everything here is aimed at reducing that set.

## What this is for — and what it is not

All five failure shapes are **detection** failures, which is what an operator hunts for on an engagement. A control that cannot fire is the first thing an attacker looks for, because it buys the defender false confidence for free. So this is not only proving the code does what you meant — it is proving the defences can actually fire. Purple-teaming your own test suite.

And the boundary, named honestly:

> **assay locks in known-good. It does not find unknown-bad.**

It tests whether controls work; it does not test whether they can be *defeated*. The `adversarial` cases here are regression — does yesterday's fix still hold — not discovery of tomorrow's bypass. That is not a gap in the design; it is the edge of what a testing factory is.

Discovery is a different engine. The two compose: **find upstream, lock downstream.** Every finding a discovery pass produces drops into the corpus as a permanent case.

Stating this matters, because a factory that believed it was also a discovery engine would produce the most dangerous shape of all — an aggregate green that thinks it is complete.

*(That framing is Rob Chuvala's, from `ideas/2026-07-27-red-team-lens-control-assurance.md`.)*

---

## The shape

### Gates — *when* something is checked

| Gate | What a machine can check |
|---|---|
| **Specification** | Acceptance criteria are falsifiable. Predictions recorded *before* the run. Claims stated so they can be refuted. |
| **Build** | Declared behaviour matches actual. And: **is this test capable of failing?** |
| **Review** | All call sites covered, not just the reported one. Every claim traced to code. Adversarial pass ran. |
| **Release** | The artifact behaves as announced. **Detectors prove they can still fire.** |
| **Continuous** | Drift. Decay. The things that are only visible over time and never at build. |

### Environments — *where* it runs, which is part of the assertion

A result without its environment is not a result. "`bwrap` works" is not a fact; it is a fact relative to a kernel, a namespace policy, and whether you are in a container.

*(Note on terms: "environment" here means the machine — kernel, namespace, container/VM/host tier. It is a distinct concept from **substrate**, the coding harness a session runs on — Claude Code, Codex, Cursor, Pi.dev; see `evals/execution-boundary/lib/substrate.ts`. An earlier version of this repo used "substrate" for both, which was a naming error, corrected 2026-07-29.)*

| Environment | What is only true here |
|---|---|
| Ephemeral container | fast iteration; most unit and contract work |
| VM (OrbStack / Tart / ProxMox) | real kernel, systemd, namespaces |
| Real host | hardware, keychain, OS integration |
| Multi-host | federation, bus, cross-principal |
| Physical / OT | devices, power loss, repower ordering |

Plus the capability that makes any of it repeatable: **desired-state reset**. Without reset you have one run, not a test.

### Classes — *what kind of question*

`unit` · `contract` (do two layers still agree) · `integration` · `scenario` (end-to-end, recovery, soak) · **`adversarial`** (can I break it — a different question from does it work) · **`eval`** (graded behaviour over a corpus; not binary) · **`capability`** (what does this host support — feeds decisions, not pass/fail)

The last three are the ones we lack and need most. Agent behaviour is a distribution, not a verdict, which is why evals matter: it is the methodology labs use for black boxes, and we are now building black boxes.

---

## Practices

The discipline the gates exist to enforce. Each one earned by a specific failure.

1. **Write predictions before the run** — including the ones predicting failure. Turns "we knew that would happen" from a face-saving remark into a dated finding.
2. **Verify against ground truth, not your own assertions.** Check a sandbox against the kernel, not against your unit test's expectations.
3. **Never verify through the path you acted through.** A lookup and its verification sharing one fault means the verification cannot fail.
4. **Assert per component, never the aggregate.** Name which side owns each check.
5. **Every finding becomes a permanent test, with the repro verbatim** — not paraphrased.
6. **Declare what you did not verify.** "This passed earlier but I could not re-run it" is worth more than a green tick.
7. **Adversarial review is a separate role**, framed to refute rather than approve.
8. **Enumerate call sites.** Fixes are shaped like bug reports, and bug reports name one location.

## Infrastructure

The unglamorous half that decides whether any of it survives.

- **Baseline tracking** — before/after failure counts, as a tool rather than a habit
- **Flake quarantine** — so a red gate is a decision, not a judgement call
- **Observability for tests** — you cannot debug what you cannot see
- **Evidence store** — repros, logs, traces, kept with the finding
- **Score tracking** — evals are trends, not verdicts
- **Cost budget** — expensive tests (real model calls, real hardware) are scarce. Iterate against cheap stand-ins; spend real runs on final confirmation. We exhausted a weekly model quota learning this.

## Verifying the tests themselves

The gate that makes this a factory rather than a test suite.

One week produced: a regression test that could not fail, three broken verification harnesses, and a check that read through the same faulty alias it was verifying. In every case the code was fine and **the instrument was wrong**.

So: can this test fail? Does it assert what it claims? Is it measuring the environment or the code?

---

## How the pieces fit

Two contributions arrived independently, from opposite ends of the problem, and they compose exactly.

**Rob Chuvala (NorthWoods Sentinel)** brought the offensive read: this is control-assurance, the meta-gate is the keystone, and — the important limit — *assay locks in known-good, it does not find unknown-bad.* He named the composition himself: **find upstream, lock downstream.**

**Vincent Zontini** brought the locking mechanism, from SAN hardware health testing: pin the environment, capture known-good output, and treat any variance as a finding. A control file listing *expected* paths makes a **missing** file a variance — which is the silent-detector fix in one line.

Put together:

```
discovery  ──▶  finding  ──▶  golden case  ──▶  locked forever
(Rob's engine)                (Vincent's method)
```

The eval corpus is the seam. Every finding a discovery pass produces becomes a permanent case, so round N automatically re-runs 1..N-1. That is already literally true — the corpus in `evals/execution-boundary/` *is* rounds 1 and 2 of Rob's review, locked.

And they answer each other. Rob's keystone worry is *"can this test fail?"* — assume-breach pointed at your own instruments. Vincent's method is structurally resistant to it: **a total comparison has no assertion logic to be vacuous.** There is nothing to write wrong, because nothing is written.

Where they create genuine tension is the **exact/bounded boundary**. Vincent's infrastructure output is deterministic; Rob's adversarial cases run against agent behaviour, which is not. So the two methods meet precisely at the line between byte-for-byte comparison and schema-level assertion — which makes that boundary the thing to govern most carefully, and *bounded creep* the drift to watch.

Neither piece is sufficient alone. A discovery engine with nothing downstream re-finds the same bugs forever. A locking mechanism with nothing upstream locks in whatever it happened to start with.

## Layout

```
evals/         graded case corpora — every finding becomes a permanent case
gates/         executable checks, by lifecycle stage
scenarios/     rerunnable end-to-end and recovery runs
environments/  environment definitions + desired-state reset
ideas/         the tray — rough thoughts, no ceremony required
docs/          charter, taxonomy, decisions
```

## Contributing

Rough is welcome. A harness that runs one scenario end-to-end teaches more than a plan.

Drop a thought in `ideas/` as a markdown file — no template, no approval. If you know which of the five failure shapes it addresses, say so; if not, that is fine too.

The unsolved problem, if you want the hard one: **making a multi-host or physical-world scenario repeatable without pretending it is a unit test.**

## Status

Early, and deliberately so.

**This repo is the evolutionary foundation, not the architecture.** It exists to get something working, and the shape of the real testing factory will be derived from what we learn running it — not from what we guessed at the start. Expect the layout, the case format, and probably the gate boundaries to be replaced once there is evidence about what they should be.

So: treat nothing here as settled, and do not build elaborate structure on top of it yet. The direction matters more than the definition — we are working out the map by walking it, and the first version's job is to be wrong in useful ways.
