#!/usr/bin/env bun
// Runner for the execution-boundary eval corpus (assay's "every finding
// becomes a permanent case" rule, made real).
//
// Discovers every cases/*.json case, loads its matching checks/<id>.check.ts
// if one exists, and runs it. A case with no check module SKIPS cleanly
// (declaring what was not verified, per assay practice #6) rather than
// being silently omitted.
//
// A check's `pass` means "reality still matches what this case documents" —
// for a status:"fixed" case that means the fix holds; for a status:"open"
// case it means the vulnerability still reproduces as described. `fail`
// means reality has DIVERGED from the case (which can be good news — a
// silent fix nobody updated the case for — or bad news — a regression; the
// detail text says which). `skip` means the substrate this case needs isn't
// available here (no cortex checkout, or a live claude session).
//
// Usage: bun run evals/execution-boundary/runner.ts [--round 1|2] [--id r1-f1,...]

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseRecord, CheckFn, CheckOutcome } from "./lib/types";

const HERE = import.meta.dir;
const CASES_DIR = join(HERE, "cases");
const CHECKS_DIR = join(HERE, "checks");

interface Args {
  round: number | null;
  ids: string[] | null;
}

function parseArgs(argv: string[]): Args {
  let round: number | null = null;
  let ids: string[] | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--round") round = Number(argv[++i]);
    if (argv[i] === "--id") ids = (argv[++i] ?? "").split(",").filter(Boolean);
  }
  return { round, ids };
}

function loadCases(): CaseRecord[] {
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"));
  const cases = files.map((f) => JSON.parse(readFileSync(join(CASES_DIR, f), "utf8")) as CaseRecord);
  cases.sort((a, b) => (a.round - b.round) || a.id.localeCompare(b.id));
  return cases;
}

interface RunOutcome {
  id: string;
  round: number;
  status: CaseRecord["status"];
  outcome: CheckOutcome;
  detail: string;
}

async function runCase(c: CaseRecord): Promise<RunOutcome> {
  if (!c.verification.check) {
    return {
      id: c.id,
      round: c.round,
      status: c.status,
      outcome: "skip",
      detail: `no automated verification — ${c.verification.note}`,
    };
  }

  const checkPath = join(HERE, c.verification.check);
  let checkFn: CheckFn;
  try {
    const mod = (await import(checkPath)) as { default: CheckFn };
    checkFn = mod.default;
  } catch (err) {
    return {
      id: c.id,
      round: c.round,
      status: c.status,
      outcome: "fail",
      detail: `could not load check module ${c.verification.check}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const result = await checkFn();
    return { id: c.id, round: c.round, status: c.status, outcome: result.outcome, detail: result.detail };
  } catch (err) {
    return {
      id: c.id,
      round: c.round,
      status: c.status,
      outcome: "fail",
      detail: `check threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    };
  }
}

function badge(outcome: CheckOutcome): string {
  if (outcome === "pass") return "PASS";
  if (outcome === "fail") return "FAIL";
  return "SKIP";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let cases = loadCases();
  if (args.round) cases = cases.filter((c) => c.round === args.round);
  if (args.ids) cases = cases.filter((c) => args.ids?.includes(c.id));

  console.log(`execution-boundary corpus — ${cases.length} case(s)\n`);

  const results: RunOutcome[] = [];
  for (const c of cases) {
    // eslint-disable-next-line no-await-in-loop
    const r = await runCase(c);
    results.push(r);
    console.log(`[${badge(r.outcome)}] ${r.id}  (round ${r.round}, documented status: ${r.status})`);
    console.log(`       ${r.detail}\n`);
  }

  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.outcome]++;

  const byStatus = new Map<string, number>();
  for (const c of cases) byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);

  console.log("─".repeat(72));

  // TWO INDEPENDENT SIGNALS, deliberately never merged into one number.
  //
  // `PASS` means only "this case behaved as documented" — and for an `open`
  // finding, behaving as documented means the vulnerability STILL REPRODUCES.
  // So a run where every case passes can encode a pile of live, unfixed
  // findings. A single green rollup over that is exactly the aggregate-green
  // failure this repo was founded to name (README, "the five failure
  // shapes"), so the open count is surfaced as loudly as the pass count
  // instead of folded into a breakdown line nobody reads.
  console.log(
    `CORPUS INTEGRITY  ${counts.pass}/${results.length} behaved as documented` +
      `   (fail=${counts.fail} skip=${counts.skip})`,
  );

  const open = cases.filter((c) => c.status === "open");
  if (open.length > 0) {
    console.log(
      `SECURITY POSTURE  ⚠️  ${open.length} finding(s) STILL OPEN — ` + open.map((c) => c.id).join(", "),
    );
    console.log("                  those cases PASS *because* the vulnerability still reproduces.");
  } else {
    console.log("SECURITY POSTURE  no findings documented as open");
  }

  console.log(
    "By documented status: " +
      [...byStatus.entries()].map(([status, n]) => `${status}=${n}`).join("  "),
  );

  if (counts.fail > 0) {
    console.log("\nOne or more cases diverged from what they document — see FAIL detail above.");
    console.log(
      "NOTE: a FAIL on an `open` case may be GOOD NEWS — it can mean the finding got fixed. " +
        "Verify, then flip that case's status to `fixed`.",
    );
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("runner crashed:", err);
  process.exit(2);
});
