# assay

**The testing factory.** Machine-verifiable gates across specification, build, review, release, and continuous — so that knowing what is true keeps pace with building.

> *assay* — a test to determine what something actually contains, as opposed to what it is labelled as.

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

Documents are what we write for the parts we cannot yet automate. Everything here is aimed at reducing that set.

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

### Substrates — *where* it runs, which is part of the assertion

A result without its substrate is not a result. "`bwrap` works" is not a fact; it is a fact relative to a kernel, a namespace policy, and whether you are in a container.

| Substrate | What is only true here |
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

So: can this test fail? Does it assert what it claims? Is it measuring the substrate or the code?

---

## Layout

```
evals/        graded case corpora — every finding becomes a permanent case
gates/        executable checks, by lifecycle stage
scenarios/    rerunnable end-to-end and recovery runs
substrates/   environment definitions + desired-state reset
ideas/        the tray — rough thoughts, no ceremony required
docs/         charter, taxonomy, decisions
```

## Contributing

Rough is welcome. A harness that runs one scenario end-to-end teaches more than a plan.

Drop a thought in `ideas/` as a markdown file — no template, no approval. If you know which of the five failure shapes it addresses, say so; if not, that is fine too.

The unsolved problem, if you want the hard one: **making a multi-host or physical-world scenario repeatable without pretending it is a unit test.**

## Status

Early, and deliberately so.

**This repo is the evolutionary foundation, not the architecture.** It exists to get something working, and the shape of the real testing factory will be derived from what we learn running it — not from what we guessed at the start. Expect the layout, the case format, and probably the gate boundaries to be replaced once there is evidence about what they should be.

So: treat nothing here as settled, and do not build elaborate structure on top of it yet. The direction matters more than the definition — we are working out the map by walking it, and the first version's job is to be wrong in useful ways.
