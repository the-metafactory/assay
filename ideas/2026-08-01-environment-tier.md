# The environment tier — a sketch, for JC and Vincent to decide

*Luna, at Andreas's request. **This is a tray note, not a spec.** It carries what we already know so nobody re-derives it, and then gets out of the way. The design decisions below belong to Jens-Christian and Vincent, who between them have the hardware, the CI experience, and the infrastructure background none of the rest of us do.*

---

## Why this is the next thing

Everything in assay currently reports on a project *statically* — reading a checkout, computing what can be proven from what's already there. That is deliberate and it works, but it has a ceiling: **the two failure shapes that motivated this whole effort are runtime shapes.** A silent detector and a healthy trace over stale input only appear against something running.

And there's a blunter reason. All 12 cases in the corpus report an **unpinned baseline** — we cannot say what they were captured against. A reviewer found that, not a test. Until an environment has a recorded identity, results are not comparable to each other, which makes the corpus a set of anecdotes.

Vincent put the sequencing best: the agent's world has to be deterministic and green *before* testing the assistant means anything. A green assistant test on an unverified environment is an aggregate green.

## What `test-rig` already worked out — inherited, not lost

`test-rig` is being retired, but it got a lot right and it would be wasteful to rediscover it. Preserved here:

**A six-step loop, stopping at first failure:**
`provision → install harness → install core → install package manager → install target → smoke test`

**Four tiers, by isolation and speed:**

| Tier | Was | Purpose |
|---|---|---|
| 0 | scratch `$HOME` on the host | fastest iteration, lowest isolation |
| 1 | devcontainer | the default, CI-ready |
| 2 | Linux VM (OrbStack) | interactive Linux debugging |
| 3 | macOS VM (Tart) | pre-release macOS validation |

**A CLI shape worth keeping:** `run --tier <t> --target <x>`, plus `shell <session>`, `ports`, `list`. Sessions that can be kept alive after a green run for interactive poking — that detail is why the thing was usable at all.

**Why it went dormant:** the chain it tested was `Claude Code → PAI → arc → grove`. cortex replaced grove; soma replaced PAI. The design didn't fail — its target moved twice. Worth remembering when picking what this one points at.

## Four things we have measured, offered as constraints

Not opinions — these came from runs, and two of them cost real time to learn.

**1. Containers cannot test the sandbox.** `bwrap` fails inside a container **even as root**. So whichever tier is meant to answer "does the Linux execution sandbox work" cannot be a container. This is the single question that's been blocked longest, and it's the one most likely to be quietly designed out.

**2. macOS only runs on Apple hardware.** No cloud fixes this. Whatever gets built will have a hole shaped like a laptop, and that is worth naming up front rather than discovering at tier 3.

**3. A digest can't quietly move; a tag can.** *(Rob's phrasing.)* Whatever identifies an environment has to be content-addressed, or the pin is decorative — and we already shipped 12 cases proving that failure is easy to make.

**4. Reset by recreation beats rollback.** You can snapshot a drifted machine, and then your known-good isn't. Snapshots are a fine speed optimisation; they're a poor thing to attest against.

## The one hard requirement from assay's side

Everything else is yours. This one is load-bearing:

> **The environment's identity must be recordable, and must reach the result.**

An image digest, a manifest hash, whatever form it takes — captured at the moment a case is locked, and again when it's replayed. That single property is what converts "we have environments" into "our results are comparable", and it's the fix for all 12 unpinned baselines.

Everything else — hypervisor, orchestration, whether containers nest inside VMs, snapshot policy, which tiers exist at all — is design, and it's yours.

## Open questions, genuinely open

**For JC** — you know CI and you have the cloud:
- Do your VMs support nested virtualisation? It decides whether containers-in-VM is available, and whether the sandbox tier needs its own hypervisor.
- Are the DGX Sparks usable as **ARM Linux** targets? Everything we've captured so far was on Apple Silicon and nothing recorded it — an ARM Linux tier would close part of that gap without anyone buying hardware.
- Self-hosted runners against GitHub, or something else? Vincent has been looking at Forgejo; that's a bigger commitment and may be the right one, but it's a call for someone who's operated both.

**For Vincent** — you have the homelab and the infrastructure background:
- Does the tier model above survive contact with reality, or did test-rig get the split wrong?
- How does desired-state reset actually work in practice — re-provision, or something cheaper that still gives a trustworthy baseline?
- Your SAN blueprinting approach turned known-good output into a control file. Does the same idea apply to the environment itself — is an environment just another golden case?

**For both:**
- What's the smallest thing that would have let us answer the `bwrap` question a week ago? That's the honest measure of whether this is working.

## Deliberately not decided here

Tooling. Terraform, Packer, Ansible, Multipass, Proxmox, plain shell — all of it is yours to pick. The properties that matter are *declared in git, built to a digest, never mutated in place, destroyed after use, identity recorded*. Anything giving those is fine, and the smallest thing that gives them is probably right.

Vincent's own line is the best guidance anyone's offered on this: **dirt simple but it worked.** A rig nobody can operate is worth less than a script everybody understands.
