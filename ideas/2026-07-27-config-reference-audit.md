# Idea: audit config references against live reality

**Shape:** cross-layer contract / the declared boundary
**Cost:** about fifteen lines
**Provenance:** caught nothing, because it did not exist yet

## The failure it would have prevented

A Discord channel alias in a local config pointed at a channel ID that had moved.
A post went to the wrong (public) channel. Worse: the *verification* read through
the same alias, so it showed the message where the alias pointed and confirmed the
wrong answer.

Two layers apart: a channel got recreated in one system, a config in another kept
pointing at the old ID, and nothing existed to notice.

## The check

For every named reference in config, resolve it against live reality and compare.
Any mismatch fails. It took fifteen lines to audit twenty-one aliases and found the
one that was wrong.

## Why it generalises

The same shape applies wherever config names something that lives elsewhere:
channel IDs, bus subjects, repo URLs, mount paths, service names, model IDs.
The reference is valid-looking forever after the target moves.

## Open question

Where does this run? It needs live credentials to resolve against reality, so
build-time CI may be the wrong gate — this might belong in `continuous`.
