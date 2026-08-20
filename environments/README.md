# environments/ — definitions and identities

An **environment** here is the machine a run executed on (`CONTEXT.md`,
"Environment") — and this directory holds what makes one *citable*: its
declared definition and its recorded identity. A result without its
environment is not a result; this is where the environment half of that
sentence lives.

## The contract

Every environment definition in this directory satisfies five properties.
They come from measured failures, not preference (see
`docs/design-infrastructure-factory.md`, §2):

1. **Declared in git.** The definition (or a pinned pointer to the repo that
   holds it) is committed. Nothing about the environment exists only on a
   machine.
2. **Built to a digest.** A canonical fingerprint of the built environment is
   captured, and `environment_digest = sha256(fingerprint)` is recorded. A
   digest can't quietly move; a tag can.
3. **Never mutated in place.** Change means changing the definition and
   rebuilding. Patching a live environment forfeits its identity.
4. **Destroyed after use.** Test environments are ephemeral. Reset is
   destroy + re-provision — a snapshot of a drifted machine is not a
   known-good.
5. **Identity reaches the result.** The digest is recorded in a case's
   `captured_on` at lock time and compared on every replay
   (match / drift / unpinned). An environment whose identity never reaches a
   result is decoration.

## Layout

```
environments/
  <name>/
    definition/       the source (or a pinned pointer: repo URL + commit SHA)
    fingerprint.txt   canonical fingerprint text, committed at lock time
    DIGEST            sha256 of fingerprint.txt
    injection.md      the recorded proof the comparator can fail (required)
```

`injection.md` is not optional ceremony: a fingerprint that has never been
observed to differ is a detector nobody has watched fire. The file records
the injected fault (e.g. one pinned package version changed), the rebuild,
and the observed non-empty diff — the same rule the corpus applies to every
other detector (design-testing-factory.md, DD-3).

## The honest-null rule applies here too

A run on a machine with no fingerprint records `environment_digest: null`
with a note — never a plausible guess. An inferred identity is worse than an
honest unknown, because it reads as evidence.

## Status

Empty by design today, like `gates/` and `scenarios/` before it — the
contract precedes the contents. The first definitions arrive with the
infrastructure factory (`docs/design-infrastructure-factory.md`, Phase 1–2).
The reference implementation of a conforming factory is
[vpzed/opentofu-pve-template](https://github.com/vpzed/opentofu-pve-template).
