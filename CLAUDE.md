<!-- Generated from metafactory ecosystem template. Customize sections marked with {PLACEHOLDER}. -->

# assay -- A practice for knowing what is true about a system, at the pace software is now built

A practice for knowing what is true about a system, at the pace software is now built

## Domain Context

Before doing work in this repo, load the domain language:

- **`./CONTEXT.md`** — this repo's bounded-context glossary, if present. One canonical term per concept, with the aliases to avoid. If you find yourself using a term loosely, check it here first. Every ecosystem repo is expected to grow a `CONTEXT.md` (authored via the `grill-with-docs` skill).
- **`compass/ecosystem/CONTEXT-MAP.md`** — the ecosystem context map: the bounded contexts (soma, cortex, myelin, signal, …) and how their boundary terms reconcile.

When `CONTEXT.md` and your instinct disagree, `CONTEXT.md` wins. When a term crosses a repo boundary, the `CONTEXT-MAP.md` is authoritative.

<!--
  Wire-contract grounding — optional per-repo slot (`wire_grounding`).

  Repos that touch the wire (subject grammar, envelope, identity, transport,
  discovery, admission — the M2–M6 protocol contracts of the Myelin layer model)
  populate this slot with a trigger→RFC routing table so wire-touching work is
  routed to the governing myelin RFC on demand rather than always-loaded. The
  slot renders empty for repos with no wire surface.

  How to populate (per-repo, NOT here): add to the repo's `agents-md.yaml`
      sections:
        - position: "after:domain-context"
          file: docs/agents-md/wire-grounding.md
  and author the trigger→RFC table in that section file. The template owns the
  slot; the repo owns the table content. See compass/standards/domain-grounding.md.
-->

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


## Naming

- **metafactory** -- always lowercase, one word. Not "Metafactory", not "Meta Factory". The GitHub org is `the-metafactory`, the repo name may be hyphenated (technical constraint), and the domains are `meta-factory.ai/.dev/.io` (DNS constraint). But the brand name is always `metafactory`.

## Critical Rules

- NEVER describe code you haven't read. Use Read/Glob/Grep to verify before making claims.
- An **"X doesn't exist" claim is an assertion — verify it before acting on it.** Grep is case- and separator-blind: a `response_routing` search silently misses `responseRouting`/`ResponseRouting`. Before concluding a symbol/field/string is absent, prefer **LSP symbol search** (`workspaceSymbol`/`findReferences`), or grep case-insensitively (`-i`) and across snake/camel/Pascal variants. Case-blind greps have caused both a missed-migration cluster and a redundant rebuild of already-shipped code.
- NEVER fabricate file names, class names, or architecture. If unsure, read the source.
- Fix ALL errors found during type checks, tests, or linting -- even if pre-existing or introduced by another developer. Never dismiss errors as "not from our changes." If you see it, fix it.
- **Wrap the substrate — user-facing flows are tool-commands-only.** No onboarding or operational step a person follows should require a raw substrate command (raw `nsc`/`nats-server`, `wrangler`/D1, SQL, low-level `git` plumbing, etc.). If a step needs the substrate, wrap it behind a first-class verb of the tool. A raw substrate command surfacing in an SOP or onboarding step is a **finding, not a step** — a tool exposes its own domain language and never leaks the layer it is built on.
- Before fixing a bug or implementing a feature, ALWAYS check open PRs (`gh pr list`) and issues (`gh issue list`) first. Someone may already be working on it, or there may be a PR ready to merge that addresses it. Don't duplicate work -- review what exists before racing to write code.
- Before merging a PR, verify the branch is up to date with the base branch. If other PRs have merged since the branch was created, rebase or merge base into the branch first. Squash merges on stale branches silently overwrite changes that landed in the interim -- this has caused data loss (PR #120 overwrote real page implementations with stubs).
- Control plane vs data plane: review-style output (PR review, design note, code analysis, decision record) goes to **GitHub** as a full PR/issue comment via `gh pr comment` / `gh issue comment` (or `gh pr review` for formal approvals). Then post a **one-liner in the matching Discord entity thread** (`{repo}/pr/{N}` or `{repo}/issue/{N}`) — verdict, counts, deep link to the GitHub comment. Discord = control plane; GitHub = data plane. See [docs/design-control-vs-data-plane.md](https://github.com/the-metafactory/compass/blob/main/docs/design-control-vs-data-plane.md) for exceptions and rationale.
- **Dual-announce for community-announced repos.** Post **when you land a PR** (on merge) — and on release — keeping development interactive/visible; you need not cut a version release on every PR. Before posting, check whether the repo is **community-announced**. The authoritative, single-source list is the set of repos flagged `community_announce: true` in [`compass/ecosystem/repos.yaml`](https://github.com/the-metafactory/compass/blob/main/ecosystem/repos.yaml) (1:1-linked to meta-factory product repos that are public or shortly becoming public; the list is dynamic — repos join it as they go public, so read the registry, never a hardcoded name list). Post to **the repo's OWN channel** — `#<repo>` (e.g. `#signal` for signal, `#cortex` for cortex, `#myelin`, `#arc`, `#soma`), **never** a fixed channel. Then:
  - **Community-announced repo →** post to that repo's `#<repo>` channel on **BOTH** Discord servers — two `discord` CLI calls:
    - `discord post --channel <repo> "<announcement>"` (the **grove** server, default)
    - `discord post --guild <community-guild-id> --channel <repo> "<announcement>"` (or `--server <community-profile>`) for the **metafactory-community** server
  - **Not community-announced →** post to the **grove** server's `#<repo>` channel only.
  - **No PII or secrets in the community post** — the metafactory-community server is public-facing. The community copy carries the public-safe announcement only; keep internal IDs, principal-private detail, and unreleased specifics out of it.
- **Confidentiality — treat this repo as exposed unless you've confirmed otherwise.** Before every commit, push, or PR (titles included — a leaked term in a PR title is still a leak), self-check: no client or engagement names, phrases, or acronyms/codes derived from them; no real people's identities, emails, or seed data anywhere — including seeds/migrations/fixtures — use placeholders; no live platform IDs (Discord/Slack channel or guild snowflakes, webhook URLs, tokens); deployment-specific config lives in `~/.config/<tool>/` on the machine running the stack, never committed to this repo. Every shippable path (`agents.d/`, `personas/`, `arc-manifest*.yaml`, and anywhere `arc` ships verbatim) carries only `.example`/`<REPLACE_ME>`/zeroed placeholders. Never use a real organization as a doc or code example. See [`compass/standards/data-classification.md`](https://github.com/the-metafactory/compass/blob/main/standards/data-classification.md) for the full class taxonomy and placeholder mapping.

- **The goal, restated so it can't drift:** every claim this repo or its
  cases make about a system is paired with an executable comparison that can
  fail — and the pairing itself is checked. A claim without a paired,
  re-runnable comparison is folklore. It may be true. You cannot tell, and
  it decays. (README, "The goal".) Before adding anything here, ask what the
  paired comparison is, not just what the claim is.
- **Never fabricate an attestation.** An inferred `captured_on` field (a
  guessed OS, a plausible-looking commit, an assumed substrate) is *worse*
  than an honest `null` with a `note` explaining what isn't known — a
  plausible guess reads as data and defeats the entire point of pinning a
  baseline. See `CONTEXT.md`, "Attestation", and the existing `r1-*`/`r2-*`
  cases for the worked example of backfilling honestly rather than
  retroactively.
- **An `open` case passing means the vulnerability still reproduces — never
  read a corpus rollup as health.** `CORPUS INTEGRITY N/N` is not a security
  score; a fully green run can describe a pile of live, unfixed findings.
  Read `SECURITY POSTURE` (the open-case count) as loudly as the pass count,
  and never collapse the two into one number. This is the **aggregate
  green** failure shape (`CONTEXT.md`) applied to this repo's own output —
  do not let it happen to the instrument that watches for it.
- **Signed contributor notes in `ideas/` are not to be edited — add an
  editor's note instead.** A dropped idea carries its author's name and
  voice; correcting terminology or fact after the fact means adding a dated
  editor's note above or below the original text, never rewriting it. See
  `ideas/2026-07-28-blueprinting-golden-cases.md` for the precedent (a
  2026-07-29 editor's note correcting a since-renamed term, with the
  original left exactly as Vincent/Luna wrote it).
- **Public repo: no secrets, real paths, hostnames, usernames, or client
  names.** This repo is meant to be picked up by someone outside this
  project (README, "Who this is for") — anything that only makes sense with
  private context loaded, or that leaks who runs the system it was proven
  against, does not belong here. Findings and repros are recorded verbatim,
  but verbatim never means pasting a real machine name, a real username, or
  a live path outside `os.tmpdir()`-style scratch locations.
- **assay locks in known-good; it does not find unknown-bad** (README, "What
  this is for — and what it is not"). Don't let a passing corpus, or a
  well-covered case, read as "this system cannot be broken." The
  `adversarial` cases here are regression against yesterday's findings, not
  discovery of tomorrow's bypass — that is a different engine, upstream of
  this one.


## GitHub Labels (ecosystem standard)

All metafactory ecosystem repos use a shared label set. Do not create ad-hoc labels.

| Label | Description | Color | Purpose |
|-------|-------------|-------|---------|
| `bug` | Something isn't working | `#d73a4a` | Defect tracking |
| `documentation` | Improvements or additions to documentation | `#0075ca` | Docs work |
| `feature` | Feature specification | `#1D76DB` | Feature work |
| `infrastructure` | Cross-cutting infrastructure work | `#5319E7` | Infra/tooling |
| `now` | Currently being worked | `#0E8A16` | Priority: active |
| `next` | Next up after current work | `#FBCA04` | Priority: queued |
| `future` | Planned but not yet scheduled | `#C5DEF5` | Priority: backlog |
| `handover` | NZ/EU timezone bridge -- work session summary | `#F9D0C4` | Async handoffs |



Every issue must have at least one type label (`bug`, `feature`, `infrastructure`, `documentation`) and one priority label (`now`, `next`, `future`) if open.

## GitHub Issue Tracking
When working on a GitHub issue in this repo, keep the issue updated as you work. This is default agent behavior, not optional.

**On starting work:**
- Comment on the issue: what you're working on.
- Example: `gh issue comment 1 --body "Starting: implement initial project structure"`

**During work:**
- Link every PR to its issue with `Closes #N` in the PR body (or `gh pr create` with an issue reference).
- If the issue body has a flat checkbox list, tick items as you complete them.

**On completing work:**
- Comment with a summary: what was done, what changed, any follow-up needed.
- Merging the PR auto-closes the issue via `Closes #N`. For iteration umbrellas, the sub-issue rollup updates automatically.
- If the issue is not PR-closable (e.g. a tracking or umbrella issue), close it manually once every child is done.

### Iteration umbrellas (sub-issues, not flat checkboxes)

Iterations with more than ~3 slices use GitHub's native **sub-issues**:

```
Iteration umbrella issue (parent)
  ├── sub-issue: slice A feature issue → closed by its PR
  ├── sub-issue: slice B feature issue → closed by its PR
  └── sub-issue: slice C feature issue → closed by its PR
```

- The umbrella links the `iterations/iteration-{n}.md` file in its body. Slice issues are added as sub-issues, not as markdown bullets.
- Each slice is a real issue (assignable, commentable, PR-linkable). Its PR closes it.
- The parent aggregates progress automatically — no manual ticking of nested checkboxes.
- Update both the repo iteration file and the umbrella when slices are added, split, or reprioritised.

**Tooling:** `gh extension install yahsan2/gh-sub-issue` gives `gh sub-issue add <parent> <child>`. Otherwise use the "Sub-issues" section on any issue page or the REST API (`POST /repos/{owner}/{repo}/issues/{n}/sub_issues`).

**Why:** GitHub is the shared collaboration surface. Team members and agents all read it. If you do work but don't update the issue, it looks like nothing happened.

## Standard Operating Procedures

This repo follows ecosystem SOPs defined in [compass](https://github.com/the-metafactory/compass). **Before starting work, identify which SOPs apply and Read them. Output the pre-flight line from each loaded SOP.**

| SOP | Activate when | File |
|-----|--------------|------|
| **Dev pipeline** | Creating branches, making PRs, starting any feature/fix work | `compass/sops/dev-pipeline.md` |
| **Versioning** | After merging PRs, before deploying, any version bump | `compass/sops/versioning.md` |
| **Deployment** | Deploying to dev or production after a release | `compass/sops/deployment.md` |
| **Worktree discipline** | Starting feature work (always — even solo) | `compass/sops/worktree-discipline.md` |
| **Design process** | Creating specs, design docs, or research docs | `compass/sops/design-process.md` |
| **Retrospective** | Post-work review, extracting process patterns | `compass/sops/retrospective-and-process-mining.md` |
| **New repo** | Bootstrapping a new repository in the ecosystem | `compass/metafactory/sops/new-repo.md` |
| **PR review** | Reviewing a PR, before approving or merging | `compass/sops/pr-review.md` |
| **Federation wire protocol** | Writing/reviewing any `federated.*` / cross-principal bus code (subjects, source, originator, deriveNatsSubject, selectLink, peers[], review consumer) | `compass/sops/federation-wire-protocol.md` |
| **Autonomous work** | Driving delegated work unattended (principal asleep/away) — slice loop, review, gate, merge | `compass/sops/autonomous-work.md` |
| **In-session dev loop** | Driving feedback (a walker/tester report) or work to shipped *in-session* — main session diagnoses + verifies + narrates live to the channel; ephemeral sub-agents build + review | `compass/sops/in-session-dev-loop.md` |
| **Security incident response** | Detecting, containing, or investigating a security finding | `compass/metafactory/sops/security-incident-response.md` |

### Examples

**Starting a feature:**
```
Task: "Add a dashboard panel"
→ Activate: dev-pipeline + worktree
→ Read both SOPs
→ Output: "SOP: dev-pipeline | Branch: feat/g-300-panel | Prefix: feat:"
→ Output: "SOP: worktree | Worktree: ../assay-panel | Branch: feat/g-300-panel | Main: untouched"
```

**After merging a PR:**
```
Task: "Merge PR #42"
→ After merge, activate: versioning
→ Read SOP
→ Output: "SOP: versioning | Current: v0.2.0 | Bump: patch → v0.2.1"
```


## Blueprint-Driven Development

All ecosystem repos track features in `blueprint.yaml`. Before starting feature work, check the dependency graph:

```bash
# What's ready to work on? (dependencies satisfied)
blueprint ready

# Claim a feature
blueprint update {REPO_SHORT}:{ID} --status in-progress

# After PR merges
blueprint update {REPO_SHORT}:{ID} --status done
blueprint lint   # Validate graph integrity
```

**Statuses:** Only `planned`, `in-progress`, and `done` are settable. `ready`, `blocked`, and `next` are computed from the dependency graph.

**Cross-repo dependencies:** Use `{repo}:{ID}` format (e.g., `grove:G-200`, `arc:A-100`). A feature is `blocked` if any dependency in another repo isn't `done`.

## Versioning & Releases

See `compass/sops/versioning.md` for the full procedure. Key repo-specific details:

- Version source of truth: `arc-manifest.yaml`
- Release title format: `"assay vX.Y.Z -- Short Description"`
- Deploy command: `arc upgrade assay`
- **Version consistency:** if this repo carries a version in both `arc-manifest.yaml` and `package.json`, the two MUST match — `--version` derives from the manifest, a bump updates both, and CI's `check-version-consistency` gate enforces equality.


## Multi-Agent Worktree Discipline

See `compass/sops/worktree-discipline.md` for the full procedure. Key repo-specific details:

- Worktree directory pattern: `../assay-{slug}`
- Example: `git worktree add ../assay-feature -b feat/{branch-name} main`

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.
