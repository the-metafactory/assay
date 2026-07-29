## The shape

assay pairs every claim about a system with an executable comparison that
can fail — the pairing itself is checked, not assumed. Full charter:
`README.md`. Domain vocabulary (case, corpus, environment vs substrate vs
requires, gate, case status, attestation, the five failure shapes):
`CONTEXT.md`.

- **Gates** — *when* something is checked: Specification, Build, Review,
  Release, Continuous (README, "The shape").
- **Environments** — *where* it runs, part of the assertion itself: a
  result without its environment is not a result.
- **Classes** — *what kind of question*: `unit` / `contract` / `integration`
  / `scenario` / `adversarial` / `eval` / `capability`.

## Layout

```
evals/         graded case corpora — every finding becomes a permanent case
gates/         executable checks, by lifecycle stage
scenarios/     rerunnable end-to-end and recovery runs
environments/  environment definitions + desired-state reset
ideas/         the tray — rough thoughts, no ceremony required
docs/          charter, taxonomy, decisions
```

Only `evals/execution-boundary/` has content today. `gates/`, `scenarios/`,
and `environments/` are empty directories — the charter names the shape
before the shape is built (README, "Status": "Early, and deliberately so").

## The one corpus that exists

`evals/execution-boundary/` — every finding from the NorthWoods Sentinel
Labs (NWS) adversarial review of `the-metafactory/cortex`, rounds 1 and 2,
as permanent, runnable cases. Run it with:

```bash
bun run evals/execution-boundary/runner.ts               # all cases
bun run evals/execution-boundary/runner.ts --round 2      # one round
bun run evals/execution-boundary/runner.ts --id r2-f4,r2-f6
```

Most cases need a sibling `~/Developer/cortex` checkout (or
`ASSAY_CORTEX_REPO_PATH`) to import or spawn cortex's real guard code
against — no cortex checkout found means every case needing one **skips
cleanly**, which is the `requires-cortex-checkout` contract, not an error.
See `evals/execution-boundary/README.md` for the full case format and check
contract.

## Who this is for

Not only cortex. cortex is the first system this practice was proven
against, and the corpus is evidence the practice works — not the product.
The bar for anything added here: could someone outside this project pick it
up and apply it to their own system on day one?
