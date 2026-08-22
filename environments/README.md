# The environment contract

An assay result without its environment is not a result. This directory
defines what assay needs to know about the machine a corpus ran on, and how
that knowledge arrives.

The rule this exists to enforce: **a result carries the identity of the
conditions it was produced under, and that identity is a digest, not a
name.**

## Why this lives here

assay **consumes** environment identity. It does not produce it. Building
deterministic environments is the infrastructure factory's job — today that
is [crucible](https://github.com/the-metafactory/crucible), with
[vpzed/opentofu-pve-template](https://github.com/vpzed/opentofu-pve-template)
as the reference implementation.

The contract is written down on the consuming side on purpose. An instrument
that depends on one implementation of the thing it measures is not an
instrument. Any factory that satisfies this file — a different hypervisor, a
different hyperscaler, a hand-built box with a shell script — produces
results assay can read.

## What an environment must be

Five properties. A factory that skips any of them is not producing
environments, it is producing machines.

1. **Declared in git.** The definition is a file, reviewable and diffable.
   Not a console click, not a snapshot someone took once.
2. **Built to a digest.** The identity is content-addressed. Never a tag,
   never a name, never "latest" — those move, and an identity that can move
   silently is not an identity.
3. **Never mutated in place.** A change means a new environment with a new
   digest, not the same environment edited.
4. **Destroyed after use.** Ephemeral by mechanism, not by discipline.
5. **Identity recorded, and reaching the result.** The digest lands in the
   result's `captured_on`. This last one is what this file specifies.

## The interchange

A factory that has fingerprinted a machine writes **`/etc/assay/environment.json`**
onto it. assay reads that file at run time. Nothing else is exchanged: no
network call, no shared database, no agent.

```json
{
  "schema": 1,
  "core_digest": "sha256:9f2a...",
  "provider_digest": "sha256:41cd...",
  "provider": "proxmox-ve",
  "definition": "inventory/ubuntu-test.yaml"
}
```

| Field | Required | Meaning |
|---|---|---|
| `schema` | yes | Format version. Currently `1`. assay refuses a version it does not know rather than guessing at the fields. |
| `core_digest` | yes | The **provider-invariant** half of the fingerprint: package set and versions, apt pinning, enabled units, login user, tool file trees. This is `environment_digest` in a result. |
| `provider_digest` | no | The **provider-specific** half: kernel flavour, image identity, mirror URIs, cloud-init datasource. Expected to differ between providers for the same definition. |
| `provider` | no | Which factory backend built this. Context for a human reading a drift report; never compared for drift. |
| `definition` | no | Path, in the factory's repo, of the file that declared this environment. Context, not identity. |

`ASSAY_ENVIRONMENT_FILE` overrides the path, for testing and for factories
that cannot write to `/etc`. Set but empty is treated as unset.

### What a refusal looks like

The refusal promised above is a behaviour, not a disposition, so it is
observable. When a file is present and assay will not read a digest out of
it, assay writes one line to stderr and the run's environment line reads:

```
env@unreadable (schema 2 — this build reads schema 1)
```

rather than the `env@none (unfingerprinted machine)` printed for a machine
that genuinely has no file. Both record `environment_digest: null` — assay
read no digest either way — but only the second is a claim assay has
established. A refusal means assay knows nothing about this machine's
identity, which is not at all the same as knowing it has none.

assay refuses, and says which, for: a `schema` it does not know, a missing or
non-string `core_digest`, malformed JSON, a path that is not a regular file
(a FIFO or device is refused without being read — reading one can block
forever, and nothing on this path may hang a run), a file over 16 KiB, and a
file it cannot open. A UTF-8 BOM is tolerated rather than refused: that is a
byte order mark, not a malformed digest.

No refusal fails the run. A missing or unreadable environment file is the
normal condition on every laptop, and the corpus still has results to report;
what it must never do is report them as if the machine were known.

### Why the digest is split in two

One digest cannot answer both questions being asked of it.

Two rebuilds of the same definition on the same provider should agree on
everything. Two builds of the same definition on *different* providers
cannot — the kernel flavour differs, the mirror differs, the datasource
differs — and a single digest over the whole capture makes that legitimate
difference indistinguishable from a drifted package set.

So `core_digest` is what any provider must reproduce identically, and
`provider_digest` is where the honest differences live on the record. An
environment definition is **proven portable** when its core digest matches
across providers. That is a claim with a comparison attached, which is the
only kind this repo keeps.

### What must not be in the digest

**The software under test is not part of the environment.** If the digest
moves every time the thing being tested moves, then "same environment, two
target versions" becomes inexpressible — and that is the comparison the
whole exercise is built on.

The line is **tooling versus target**. A package manager that decides how
targets get installed is environment; it does not vary with which target is
under test. The target itself is not, and its identity belongs in the
result's own fields — `cortex_commit` and the run receipt — never folded
into `environment_digest`.

A factory that hashes its install root without excluding installed target
packages will violate this silently, and the result will look more pinned
than it is.

## What assay does with it

`EnvironmentStamp` (lib/environment.ts) records the digests for the current
run. `CapturedOnStamp` records them for the run a case's expectation was
established under. `assessDrift` compares the two and the runner reports, per
case, one of:

- **match** — the case's recorded digest equals this run's.
- **drift** — both are recorded and they differ. Information, not a verdict:
  a result captured elsewhere is not automatically wrong, it is
  automatically *different*, and the difference is now on the record.
- **unpinned** — the case recorded no digest. Reported loudest, because it
  is the condition this whole apparatus exists to make visible.

These are the words the code uses too: `DriftAssessment.kind` is
`"match" | "drift" | "unpinned"`. One concept, one name.

**The provider half never makes a case pinned.** `provider_digest` is
compared and any change is reported — the honest differences stay on the
record — but a baseline holding *only* that half is **unpinned**, not
**match**. It could not be otherwise: the provider half is expected to differ
between providers for the identical definition, so it says which backend
built a machine, never which machine. A `match` resting on it alone would be
a claim of sameness resting on the one field defined not to be evidence of
sameness.

**Absence is recorded, never faked.** A run on a laptop with no
`/etc/assay/environment.json` yields `null` — plus a note saying why. A null
that says "nothing was recorded here" is worth more than a field quietly
defaulting to something that looks like data.

## The trust boundary, stated

assay reads the file. It does not verify that the file describes the machine
it is sitting on. A factory that writes the digest and then lets the machine
be mutated will produce a result that lies, and assay cannot catch it.

This is deliberate — verifying it would mean assay re-implementing the
fingerprint, which would make it the second implementation of the thing it is
supposed to be independent of. The mitigation belongs on the factory side:
environments are destroyed after use rather than reset, so there is no long
window in which the file and the machine can drift apart.

It is written down here so that nobody mistakes a recorded digest for a
verified one.
