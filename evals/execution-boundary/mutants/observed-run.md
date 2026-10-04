# mutate.ts: raw table output (F9 artifact)

Two consecutive full runs of `mutate.ts`. Every table line is reproduced verbatim, header separator included. The two runs had byte-identical tables (sha256 of the table lines: `e7a14baf4c5a323f…` both times). Run conditions are listed in `README.md` under "Observed record".

| entry | check | guard under test | injected defect | expected | observed | mutant ran (probe reason) | verdict |
|---|---|---|---|---|---|---|---|
| r1-f1/control | r1-f1 | real cortex (unchanged) | — | pass | pass | — | CONTROL OK |
| r1-f4/control | r1-f4 | real cortex (unchanged) | — | pass | pass | — | CONTROL OK |
| r1-f6/control | r1-f6 | real cortex (unchanged) | — | pass | pass | — | CONTROL OK |
| r2-f3/control | r2-f3 | real cortex (unchanged) | — | pass | pass | — | CONTROL OK |
| r1-f1/path-allow-all | r1-f1 | path-guard.hook.ts→allow-all | path-guard grants everything (Read containment removed); bash-guard real | fail, naming Read=allow | fail | path-guard.hook.ts: "known-bad fixture: allow-all" | CAUGHT |
| r1-f1/bash-allow-all | r1-f1 | bash-guard.hook.ts→allow-all | bash-guard grants everything (Bash containment removed); path-guard real | fail, naming Bash cat=allow | fail | bash-guard.hook.ts: "known-bad fixture: allow-all" | CAUGHT |
| r1-f1/both-deny-all | r1-f1 | path-guard.hook.ts→deny-all + bash-guard.hook.ts→deny-all | both guards deny everything, including legitimate in-scope work | fail (DD-3 corollary: firing on the correct state is a failure) | pass | path-guard.hook.ts: "known-bad fixture: deny-all"; bash-guard.hook.ts: "known-bad fixture: deny-all" | ACCEPTED-KNOWN-BAD |
| r1-f4/bash-allow-all | r1-f4 | bash-guard.hook.ts→allow-all | guard-off bash-guard grants out-of-scope reads | fail, naming cat=allow | fail | bash-guard.hook.ts: "known-bad fixture: allow-all" | CAUGHT |
| r1-f4/bash-deny-all | r1-f4 | bash-guard.hook.ts→deny-all | guard-off bash-guard denies in-scope uncataloged commands (G-300 regression) | fail, naming sort=deny | fail | bash-guard.hook.ts: "known-bad fixture: deny-all" | CAUGHT |
| r1-f6/path-allow-all | r1-f6 | path-guard.hook.ts→allow-all | read-only dir is writable (Write granted) | fail, naming Write=allow | fail | path-guard.hook.ts: "known-bad fixture: allow-all" | CAUGHT |
| r1-f6/path-deny-all | r1-f6 | path-guard.hook.ts→deny-all | read-only dir is unreadable (Read denied) | fail, naming Read=deny | fail | path-guard.hook.ts: "known-bad fixture: deny-all" | CAUGHT |
| r2-f3/bash-deny-all | r2-f3 | bash-guard.hook.ts→deny-all | bash-guard denies the repro command (looks like a fix, or a broken guard) | fail, naming got deny | fail | bash-guard.hook.ts: "known-bad fixture: deny-all" | CAUGHT |
| r2-f3/bash-contradictory | r2-f3 | bash-guard.hook.ts→contradictory | bash-guard emits deny then allow and exits 1 (no trustworthy verdict) | not a clean pass (fail, naming got unknown) | pass | bash-guard.hook.ts: raw stdout = both "known-bad fixture: contradictory" lines, exit 1 | ACCEPTED-KNOWN-BAD |
