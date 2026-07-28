# Blueprinting: known-good output as the comparison

*Vincent Zontini's method, from the community thread. Written up by Luna; the idea and the working precedent are Vincent's.*

## The method, in his words

An early version of SAN hardware health testing: a script logged into every component, ran all the health commands, and saved the output. That output was compared against known-good output. **Any variance was a check failure**, and the variance notified a storage admin.

The "blueprint" was a directory of known-good output files, plus a control file listing `system_name, file_name, file_hash` that the script took as input.

> "Dirt simple but it worked."
>
> "A test suite doesn't need to be complex to be effective."

## Why this is more than a nice pattern

It is the answer to the charter's own stated hard problem.

The README says *the substrate is part of the assertion* — "this sandbox primitive works" is only true relative to a kernel and a namespace policy — and frames that as difficult. **Blueprinting dissolves it rather than solving it.** You do not reason about the substrate; you pin it and record which pin you used. Every result carries its image ID.

Three more of the five failure shapes fall out for free:

- **The test that cannot fail** — there is no assertion logic to be vacuous. The comparison is total, so there is nothing to write wrong.
- **The aggregate green** — no aggregation step exists to swallow a red. Any variance is a finding.
- **The silent detector** — this is the subtle one. A control file that *lists the expected paths* turns a **missing** file into a variance. A checker that only validates what it happens to find stays quiet when something disappears. That distinction is the entire failure shape, and the control file is the fix.
- **Never verify through the path you acted through** — the diff reads the filesystem directly rather than asking the thing that made the change whether it worked. Exactly the check that would have caught the wrong-channel post.

## Where the method needs bending, honestly

Infrastructure output is deterministic. LLM output is not. Timestamps, session IDs, temp paths, token counts, and prose all vary run to run. So split assertions into two classes and keep the boundary loud:

- **Exact class** — filesystem shape, permissions, hashes, generated config, generated code, tool-call sequences. Byte-for-byte; variance is a finding. **Keep this class as large as possible.**
- **Bounded class** — model prose. Assert schema and structure, never bytes.

The failure mode to guard against is **bounded creep**: cases drifting from exact into bounded because one was flaky once. Moving a case across that boundary should require a commit that explains why.

## Naming

`blueprint` is already a repo in the ecosystem. Keep "blueprinting" as the name of the *practice*, but do not name a directory or module that here — call the artifacts **golden cases**.

## First bricks, deliberately dirt simple

1. A pinned image — Bun + Claude Code at fixed versions, auto-update disabled, `$HOME` as the sole mutable surface. Image ID recorded in every result.
2. A `golden/` directory of known-good outputs plus a control manifest: path, mode, type, hash-or-canonical-content. Vincent's SAN control file, essentially verbatim.
3. Reset → run → diff, on top of desired-state reset.
4. Variance triage: accepting a variance means updating the golden **in a commit that says why**. That is the "why did this change?" trail for later.
5. Re-express the existing eval cases as golden cases rather than maintaining a second format.

The direct port of the SAN example is a **fleet health sweep**: run one read-only command set across every agent stack, save the output, diff against per-stack goldens. No framework required — a script, a directory, and a manifest.

## Open question for Vincent

In the SAN work, was there ever output you could not make deterministic — and how did you keep it from contaminating the rest?

That boundary is the whole design risk here. Infrastructure has far less non-determinism than agent output, so the exact/bounded split may need to be drawn differently for us than it was for you.
