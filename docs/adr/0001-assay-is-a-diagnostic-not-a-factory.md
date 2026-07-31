# ADR-0001 — assay is a diagnostic instrument, not a factory

**Status:** Accepted (2026-07-31)
**Deciders:** Andreas (principal), Luna
**Supersedes:** the framing this repo launched with

---

## Context

This repo was created, charted, specified, and announced to the community as **"the testing factory."** That framing was wrong, and the error is worth recording because it was made three times in one week in different words.

`vision/factory-of-factories.md` already defines the term:

> A **factory** is a member-operated production capability: an operator, their agents, and their installed stack, able to turn models into outcomes — a website factory that ships production sites, a document factory, an assessment factory. Factories produce products.

Two things follow that the launch framing violated. A factory is **member-operated** — an instance somebody runs, not an artifact somebody distributes; so a repo is never a factory. And a factory **produces products**, whereas this repo produces a report.

The definition existed in vision prose but not as a **boundary term** in `compass/ecosystem/CONTEXT-MAP.md` — which defines sixteen terms, none of them `factory`, `bundle`, or `blueprint`. A concept with no boundary term has nothing for another repo to reconcile against, which is precisely how the misuse survived review.

The same document also sets the test we would currently fail:

> Adding the Nth factory must require no new machinery — only a new capability declaration.

Our corpus is cortex-specific. Nothing here yet makes a *second* project's verification cheaper than the first. That is the definition of not-yet-a-factory.

## Alternatives considered

**Claim factory anyway.** Defensible under "an assessment factory", which the vision doc names explicitly. Rejected: it fails the Nth-factory test today, and the same document warns that *"meta layers are only worth anything when the base layer ships"* — metaclass frameworks built for their own elegance became architecture astronautics. Claiming the word before earning it is that failure.

**Reframe as standards.** Honest and achievable. Rejected because `compass-core` already *is* that — "reusable governance engine for Claude Code projects — SOPs, validators, governance skill." If assay is standards, it should be a compass module rather than a repo, and the thing it produces would be rules rather than an outcome.

**Aim straight at a full factory, ship later.** Truest to the word. Rejected: it makes v1 depend on environment and reset work that does not exist, delaying everything behind hardware we do not have, for a claim we could make honestly later.

## Decision

**assay is a diagnostic instrument.** Install it, point it at a project, and it reports what that project can currently *prove* about itself — and where it cannot. It is the instrument a verification factory would use; it is not the factory.

The name was always the definition: an assay determines what something actually contains, as opposed to what it is labelled as.

Four decisions follow from it:

**D1 — The product is a report, and remediation is part of it.** A finding without a remedy is a complaint. But remediation is where overclaiming lives, so every remedy ships with **the measure that will move if it worked** — subjecting our own advice to the same rule as everything else. Mechanical and judgement remediations are marked distinctly. Nothing is ever auto-applied: writing to a project we have not seen, on a heuristic, is the declared-boundary failure with a write path. The engagement model is *find → recommend → re-verify on request*, adopted deliberately from NWS's.

**D2 — Infer what is inferable; the claim manifest is a by-product, not a prerequisite.** Four of five v1 measures are computable from what a project already has. Requiring a claim manifest up front is conceptually purer and empirically fatal — nobody has one, and the tool would be abandoned before showing value.

**D3 — Only the instrument is installed.** The instrument is portable; a corpus is subject-specific. Installing twelve cortex security findings onto a stranger's machine is noise. The corpus stays in-repo as published evidence — readable, citable, runnable here — which is how someone checks the practice works before adopting it. Corpora become separately installable when a second one exists; building that extension point now would be a plugin system for one plugin.

**D4 — v1 is static, repo-only.** No credentials, no running target, no network. Where a measure cannot be fully answered statically it degrades honestly rather than being dropped — *"N guards, none carrying an injection proof"* is still the finding.

## Consequences

**Good.** The claim now matches the artifact, and the bar for earning "factory" is explicit and measurable: when a second project's verification is cheaper than ours was. First-run cost is zero, so the tool can be tried before it is trusted. And the v1 scope no longer blocks on environment work that does not exist.

**Costly.** The community launch used the wrong noun and needs correcting in public. The charter and spec were written around the old framing and need reconciling.

**Notably, this demotes DD-1** in `docs/design-testing-factory.md`. Adopting Inspect serves the *corpus*, which D3 makes evidence rather than product — so it is no longer the next move. That decision stands but drops down the order.

**Accepted limitation.** D4 means the two failure shapes that most motivated this work — the silent detector and the healthy trace — are **runtime** shapes a static instrument cannot observe directly. It can only report the absence of proof about them. Live measures arrive with the trace work (DD-6).

**Follow-up owed elsewhere.** `factory`, `bundle`, and `blueprint` are promoted to CONTEXT-MAP boundary terms, with vision retaining the concept. Until that lands, assay's `CONTEXT.md` entry is assay's reading rather than settled authority — and the gap that caused this error stays open for the next person.
