// Tests for lib/re-establish.ts — the print-only helper that turns a live
// environment stamp into paste-ready `captured_on` blocks.
//
// Mostly refusal paths, deliberately (same reasoning as
// environment.test.ts): the one job this module must never fail at is
// printing a block containing a value nothing captured. Each refusal test
// is the observed-red for that guard — the fault injected, the refusal
// observed — so the guard is trusted because it has been seen firing, not
// because it reads plausibly.
//
// Run: bun test

import { describe, expect, test } from "bun:test";
import type { EnvironmentStamp } from "./environment";
import { buildReEstablishment, type ReEstablishInput } from "./re-establish";
import type { SubstrateDetection } from "./substrate";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const RECEIPT = "https://example.invalid/evidence/run-receipt.md";

/** A stamp as captured on a factory-built VM: everything pinnable, pinned. */
function factoryStamp(over: Partial<EnvironmentStamp> = {}): EnvironmentStamp {
  return {
    captured_at: "2026-09-03T01:52:26.980Z",
    os: "linux",
    arch: "x64",
    kernel_release: "7.0.0-28-generic",
    bun_version: "1.3.14",
    cortex_commit: "01f43bb9029e9f0000000000000000000000dead",
    cortex_dirty: false,
    environment_digest: "sha256:" + "e3".repeat(32),
    environment_provider_digest: "sha256:" + "94".repeat(32),
    environment_file: "read",
    environment_file_refusal: null,
    ...over,
  };
}

const NO_SUBSTRATE: SubstrateDetection = {
  substrate: null,
  note: "no reliable substrate signal found in the environment.",
};

function input(over: Partial<ReEstablishInput> = {}): ReEstablishInput {
  return {
    stamp: factoryStamp(),
    substrate: NO_SUBSTRATE,
    receipt: RECEIPT,
    caseIds: ["r1-f1", "r2-f6"],
    ...over,
  };
}

// ---------------------------------------------------------------------------
// refusals — the point of the module
// ---------------------------------------------------------------------------

describe("buildReEstablishment — refusals", () => {
  test("refuses with no receipt: a note must cite the run it answers to", () => {
    const r = buildReEstablishment(input({ receipt: null }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/--receipt/);
  });

  test("refuses a blank receipt the same as a missing one", () => {
    const r = buildReEstablishment(input({ receipt: "   " }));
    expect(r.ok).toBe(false);
  });

  test("refuses with no cortex checkout: nothing here ran against cortex", () => {
    const r = buildReEstablishment(
      input({ stamp: factoryStamp({ cortex_commit: null, cortex_dirty: null }) }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no cortex checkout/);
  });

  test("refuses a dirty cortex checkout: the SHA would not pin the tree read", () => {
    const r = buildReEstablishment(input({ stamp: factoryStamp({ cortex_dirty: true }) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/uncommitted changes/);
  });

  test("refuses when cortex cleanliness is unknown: unknown-clean is not clean", () => {
    const r = buildReEstablishment(input({ stamp: factoryStamp({ cortex_dirty: null }) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/could not be determined/);
  });

  test("refuses on an unfingerprinted machine (no environment file) — a laptop", () => {
    const r = buildReEstablishment(
      input({
        stamp: factoryStamp({
          environment_file: "absent",
          environment_digest: null,
          environment_provider_digest: null,
        }),
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no factory-published environment file/);
  });

  test("refuses a refused environment file DISTINCTLY from an absent one", () => {
    const r = buildReEstablishment(
      input({
        stamp: factoryStamp({
          environment_file: "refused",
          environment_file_refusal: "schema 2 — this build reads schema 1",
          environment_digest: null,
          environment_provider_digest: null,
        }),
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/schema 2/);
      expect(r.reason).not.toMatch(/unfingerprinted|never fingerprinted/);
    }
  });
});

// ---------------------------------------------------------------------------
// the happy path — every printed value is a captured one
// ---------------------------------------------------------------------------

describe("buildReEstablishment — printing", () => {
  test("prints one parseable block per case, field-for-field from the stamp", () => {
    const r = buildReEstablishment(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.text).toContain("── r1-f1 ──");
    expect(r.text).toContain("── r2-f6 ──");

    const json = r.text.slice(r.text.indexOf("── r1-f1 ──") + "── r1-f1 ──\n".length);
    const block = JSON.parse(json.slice(0, json.indexOf("\n\n──") + 1)) as Record<string, unknown>;

    // Exactly the CapturedOnStamp shape — no extra fields smuggled in.
    expect(Object.keys(block).sort()).toEqual(
      [
        "arch",
        "bun_version",
        "cortex_commit",
        "date",
        "environment_digest",
        "environment_provider_digest",
        "kernel_release",
        "note",
        "os",
        "substrate",
      ].sort(),
    );

    const s = factoryStamp();
    expect(block.date).toBe("2026-09-03"); // from captured_at, not the wall clock
    expect(block.os).toBe(s.os);
    expect(block.arch).toBe(s.arch);
    expect(block.kernel_release).toBe(s.kernel_release);
    expect(block.bun_version).toBe(s.bun_version);
    expect(block.cortex_commit).toBe(s.cortex_commit);
    expect(block.environment_digest).toBe(s.environment_digest);
    expect(block.environment_provider_digest).toBe(s.environment_provider_digest);
  });

  test("an undetected substrate prints as null, never a guessed harness", () => {
    const r = buildReEstablishment(input({ caseIds: ["r1-f1"] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toContain('"substrate": null');
    expect(r.text).not.toContain('"substrate": "claude-code"');
  });

  test("a detected substrate is printed as detected", () => {
    const r = buildReEstablishment(
      input({
        substrate: { substrate: "claude-code", note: "inferred from CLAUDECODE=1" },
        caseIds: ["r1-f1"],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toContain('"substrate": "claude-code"');
  });

  test("the note cites the receipt and says the helper only prints", () => {
    const r = buildReEstablishment(input({ caseIds: ["r1-f1"] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toContain(RECEIPT);
    expect(r.text).toMatch(/only\s*prints/);
    expect(r.text).toContain("never writes case files");
  });
});
