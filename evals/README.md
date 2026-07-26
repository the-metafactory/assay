# Evals

Graded case corpora. The primitive borrowed from LLM labs, because agent behaviour
is a distribution rather than a verdict, and we are now building black boxes.

**The rule: every finding becomes a permanent case.** Round N automatically re-runs
rounds 1..N-1. A finding fixed without a case is a finding that can return.

A case carries:
- the **repro verbatim** — never paraphrased
- the **substrate** it was observed on (a result without its substrate is not a result)
- what **correct** looks like, stated so it can be refuted
- provenance: who found it, when, in what round

## Corpora

- `execution-boundary/` — agent execution-boundary findings (cortex, NWS rounds 1–2)
