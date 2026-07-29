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
