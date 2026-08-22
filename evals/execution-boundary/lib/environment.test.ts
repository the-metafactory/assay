// Tests for lib/environment.ts — the module that answers "what machine was
// this result produced on, and what was the case's expectation established
// against".
//
// WHY THIS FILE EXISTS. Every case in this corpus is a finding that became a
// permanent test, and this module has its own finding to answer for: when
// `environment_digest` was first added, a case file written before the field
// existed reached `assessDrift` with the field ABSENT, `undefined !== null`,
// and the run crashed. That was caught by running it. An independent review
// (PR #27) then found the same crash class one level up — `assessDrift`
// hardened every FIELD of the stamp and not the stamp itself — plus four
// more defects of the same family: a present-but-unreadable environment file
// rendering as the positive claim "unfingerprinted machine", an unbounded
// `readFileSync` that hung forever on a FIFO, and the provider half of the
// digest counting as a pin. None of those were caught by running it, because
// nothing ran this module except the happy path.
//
// So the thing under test here is mostly NOT the happy path. It is the
// refusal matrix, the absent/refused distinction, and the boundary between
// "recorded" and "merely present".
//
// Run: bun test

import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assessDrift,
  captureEnvironmentStamp,
  environmentFilePath,
  formatEnvironmentStamp,
  readEnvironmentFile,
  type CapturedOnStamp,
  type EnvironmentStamp,
} from "./environment";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const DIR = mkdtempSync(join(tmpdir(), "assay-env-test-"));
let n = 0;

/** Writes a file with the given raw bytes and returns its path. */
function file(contents: string): string {
  const p = join(DIR, `f${n++}.json`);
  writeFileSync(p, contents);
  return p;
}

/** A path that definitely does not exist. */
function missing(): string {
  return join(DIR, `absent-${n++}.json`);
}

/** A stamp for a machine no factory fingerprinted — i.e. every laptop. */
function stamp(over: Partial<EnvironmentStamp> = {}): EnvironmentStamp {
  return {
    captured_at: "2026-08-23T00:00:00.000Z",
    os: "linux",
    arch: "x64",
    kernel_release: "6.8.0",
    bun_version: "1.3.2",
    cortex_commit: "a".repeat(40),
    cortex_dirty: false,
    environment_digest: null,
    environment_provider_digest: null,
    environment_file: "absent",
    environment_file_refusal: null,
    ...over,
  };
}

/** A baseline that records nothing — the shape all 12 backfilled cases have. */
function baseline(over: Partial<CapturedOnStamp> = {}): CapturedOnStamp {
  return {
    date: null,
    os: null,
    arch: null,
    kernel_release: null,
    bun_version: null,
    cortex_commit: null,
    environment_digest: null,
    environment_provider_digest: null,
    substrate: null,
    note: "test fixture",
    ...over,
  };
}

const ENV_VAR = process.env.ASSAY_ENVIRONMENT_FILE;
afterEach(() => {
  if (ENV_VAR === undefined) delete process.env.ASSAY_ENVIRONMENT_FILE;
  else process.env.ASSAY_ENVIRONMENT_FILE = ENV_VAR;
});

// ---------------------------------------------------------------------------
// readEnvironmentFile — the refusal matrix
// ---------------------------------------------------------------------------

describe("readEnvironmentFile", () => {
  test("reads a conforming schema-1 file", () => {
    const r = readEnvironmentFile(
      file(
        JSON.stringify({
          schema: 1,
          core_digest: "sha256:9f2a3b1c8d4e5f60",
          provider_digest: "sha256:41cd0000",
          provider: "proxmox-ve",
          definition: "inventory/ubuntu-test.yaml",
        }),
      ),
    );
    expect(r.status).toBe("read");
    expect(r.environment_digest).toBe("sha256:9f2a3b1c8d4e5f60");
    expect(r.environment_provider_digest).toBe("sha256:41cd0000");
  });

  test("a missing provider_digest is null, not a refusal — the field is optional", () => {
    const r = readEnvironmentFile(file(JSON.stringify({ schema: 1, core_digest: "sha256:aa" })));
    expect(r.status).toBe("read");
    expect(r.environment_provider_digest).toBeNull();
  });

  test("an empty provider_digest is null, not an empty string", () => {
    const r = readEnvironmentFile(
      file(JSON.stringify({ schema: 1, core_digest: "sha256:aa", provider_digest: "" })),
    );
    expect(r.status).toBe("read");
    expect(r.environment_provider_digest).toBeNull();
  });

  // THE distinction this module got wrong. Absence is a fact assay
  // established; refusal is assay declining to establish anything.
  test("no file is ABSENT, not refused — the overwhelmingly common case", () => {
    const r = readEnvironmentFile(missing());
    expect(r.status).toBe("absent");
    expect(r.environment_digest).toBeNull();
  });

  test("a path under a non-directory is absent, not refused", () => {
    const notADir = file("{}");
    const r = readEnvironmentFile(join(notADir, "environment.json"));
    expect(r.status).toBe("absent");
  });

  // Everything below is REFUSED: a file exists and assay would not read a
  // digest out of it. Each must report a distinct, sayable reason.
  const refusals: [name: string, path: () => string, reason: RegExp][] = [
    [
      "a schema from the future",
      () => file(JSON.stringify({ schema: 2, core_digest: "sha256:aa" })),
      /schema 2 — this build reads schema 1/,
    ],
    [
      "a schema of the wrong type",
      () => file(JSON.stringify({ schema: "1", core_digest: "sha256:aa" })),
      /schema "1" — this build reads schema 1/,
    ],
    [
      "no schema field at all",
      () => file(JSON.stringify({ core_digest: "sha256:aa" })),
      /no schema field/,
    ],
    ["malformed JSON", () => file("{not json"), /not valid JSON/],
    ["a JSON array", () => file("[]"), /not a JSON object/],
    ["a bare JSON scalar", () => file('"nope"'), /not a JSON object/],
    [
      "a missing core_digest",
      () => file(JSON.stringify({ schema: 1 })),
      /no usable core_digest/,
    ],
    [
      "a non-string core_digest",
      () => file(JSON.stringify({ schema: 1, core_digest: 42 })),
      /no usable core_digest/,
    ],
    [
      "an empty core_digest",
      () => file(JSON.stringify({ schema: 1, core_digest: "" })),
      /no usable core_digest/,
    ],
    ["an empty file", () => file(""), /empty file/],
    [
      "a file over the size cap",
      () => file(JSON.stringify({ schema: 1, core_digest: "sha256:" + "a".repeat(200_000) })),
      /bytes, over the 16384-byte cap/,
    ],
    [
      "a directory",
      () => {
        const p = join(DIR, `dir${n++}`);
        mkdirSync(p);
        return p;
      },
      /not a regular file/,
    ],
  ];

  for (const [name, path, reason] of refusals) {
    test(`refuses ${name}`, () => {
      const r = readEnvironmentFile(path());
      expect(r.status).toBe("refused");
      expect(r.environment_digest).toBeNull();
      expect(r.environment_provider_digest).toBeNull();
      if (r.status === "refused") expect(r.reason).toMatch(reason);
    });
  }

  // The one that actually hung the run. Reading a FIFO blocks until a writer
  // opens the other end, and "until a writer opens the other end" can be
  // never — this test finishes at all only because the open is O_NONBLOCK and
  // the fstat refuses before any read happens.
  test("refuses a FIFO instead of blocking forever on it", () => {
    const p = join(DIR, `fifo${n++}`);
    execFileSync("mkfifo", [p]);
    const started = Date.now();
    const r = readEnvironmentFile(p);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(r.status).toBe("refused");
    if (r.status === "refused") expect(r.reason).toMatch(/not a regular file/);
  });

  test("refuses an unreadable file rather than reporting it absent", () => {
    const p = file(JSON.stringify({ schema: 1, core_digest: "sha256:aa" }));
    chmodSync(p, 0o000);
    const r = readEnvironmentFile(p);
    // A test run as root can read it anyway; assert only what is true of both.
    expect(r.status === "refused" || r.status === "read").toBe(true);
    if (r.status === "refused") expect(r.reason).toMatch(/cannot open it \(EACCES\)/);
  });

  test("follows a symlink to a real file — a symlink is not itself suspicious", () => {
    const target = file(JSON.stringify({ schema: 1, core_digest: "sha256:linked" }));
    const link = join(DIR, `link${n++}.json`);
    symlinkSync(target, link);
    const r = readEnvironmentFile(link);
    expect(r.status).toBe("read");
    expect(r.environment_digest).toBe("sha256:linked");
  });

  test("a UTF-8 BOM does not make a valid file unreadable", () => {
    const r = readEnvironmentFile(
      file("﻿" + JSON.stringify({ schema: 1, core_digest: "sha256:beef" })),
    );
    expect(r.status).toBe("read");
    expect(r.environment_digest).toBe("sha256:beef");
  });
});

// ---------------------------------------------------------------------------
// environmentFilePath
// ---------------------------------------------------------------------------

describe("environmentFilePath", () => {
  test("defaults to the contract's path", () => {
    delete process.env.ASSAY_ENVIRONMENT_FILE;
    expect(environmentFilePath()).toBe("/etc/assay/environment.json");
  });

  test("honours an override", () => {
    process.env.ASSAY_ENVIRONMENT_FILE = "/tmp/somewhere.json";
    expect(environmentFilePath()).toBe("/tmp/somewhere.json");
  });

  // `??` would hand "" to openSync, which is not a path anybody meant.
  test("falls back when the override is set but empty", () => {
    process.env.ASSAY_ENVIRONMENT_FILE = "";
    expect(environmentFilePath()).toBe("/etc/assay/environment.json");
  });
});

// ---------------------------------------------------------------------------
// captureEnvironmentStamp / formatEnvironmentStamp
// ---------------------------------------------------------------------------

describe("captureEnvironmentStamp", () => {
  test("records the file status alongside the digests", () => {
    process.env.ASSAY_ENVIRONMENT_FILE = file(
      JSON.stringify({ schema: 1, core_digest: "sha256:9f2a3b1c8d4e" }),
    );
    const s = captureEnvironmentStamp();
    expect(s.environment_file).toBe("read");
    expect(s.environment_digest).toBe("sha256:9f2a3b1c8d4e");
    expect(s.environment_file_refusal).toBeNull();
  });

  test("a refusal is recorded on the stamp, with its reason", () => {
    process.env.ASSAY_ENVIRONMENT_FILE = file(JSON.stringify({ schema: 2, core_digest: "x" }));
    const s = captureEnvironmentStamp();
    expect(s.environment_file).toBe("refused");
    expect(s.environment_digest).toBeNull();
    expect(s.environment_file_refusal).toMatch(/schema 2/);
  });

  test("the digest stays null on refusal — a wrong identity is worse than none", () => {
    process.env.ASSAY_ENVIRONMENT_FILE = file(
      JSON.stringify({ schema: 99, core_digest: "sha256:looks-real" }),
    );
    expect(captureEnvironmentStamp().environment_digest).toBeNull();
  });
});

describe("formatEnvironmentStamp", () => {
  test("renders a read digest short and greppable", () => {
    const line = formatEnvironmentStamp(stamp({ environment_digest: "sha256:9f2a3b1c8d4e5f60", environment_file: "read" }));
    expect(line).toContain("env@9f2a3b1c8d4e");
  });

  test("renders genuine absence as an unfingerprinted machine", () => {
    expect(formatEnvironmentStamp(stamp())).toContain("env@none (unfingerprinted machine)");
  });

  // THE finding. "unfingerprinted machine" asserts assay looked and
  // established there is no factory identity here. On a refusal assay
  // established no such thing, and must not say so.
  test("renders a refusal as unreadable, never as an unfingerprinted machine", () => {
    const line = formatEnvironmentStamp(
      stamp({
        environment_file: "refused",
        environment_file_refusal: "schema 2 — this build reads schema 1",
      }),
    );
    expect(line).toContain("env@unreadable (schema 2 — this build reads schema 1)");
    expect(line).not.toContain("unfingerprinted");
  });

  test("names the cortex checkout, and flags a dirty tree", () => {
    expect(formatEnvironmentStamp(stamp())).toContain(`cortex@${"a".repeat(12)}`);
    expect(formatEnvironmentStamp(stamp({ cortex_dirty: true }))).toContain("-dirty");
    expect(formatEnvironmentStamp(stamp({ cortex_commit: null }))).toContain(
      "cortex@none (no checkout found)",
    );
  });
});

// ---------------------------------------------------------------------------
// shortDigest — exercised through the renderings that use it
// ---------------------------------------------------------------------------

describe("shortDigest (via formatEnvironmentStamp)", () => {
  const short = (d: string) => {
    const m = formatEnvironmentStamp(
      stamp({ environment_digest: d, environment_file: "read" }),
    ).match(/env@(\S*)/);
    return m?.[1] ?? "";
  };

  test("drops the algorithm prefix and keeps 12 hex", () => {
    expect(short("sha256:0123456789abcdef0123")).toBe("0123456789ab");
  });

  test("handles a bare hex digest with no prefix", () => {
    expect(short("0123456789abcdef")).toBe("0123456789ab");
  });

  test("does not pad a digest shorter than 12 chars", () => {
    expect(short("sha256:beef")).toBe("beef");
  });

  test("splits on the FIRST colon only", () => {
    expect(short("multihash:sha256:aabbccddeeff00")).toBe("sha256:aabbc");
  });
});

// ---------------------------------------------------------------------------
// assessDrift
// ---------------------------------------------------------------------------

describe("assessDrift — unpinned", () => {
  // All 12 backfilled cases in this corpus land here, and must keep landing
  // here. If this ever reports `match`, the corpus has started claiming a
  // pin it does not have.
  test("a baseline recording nothing is unpinned", () => {
    const a = assessDrift(baseline(), stamp(), null);
    expect(a.kind).toBe("unpinned");
    if (a.kind === "unpinned") expect(a.reason).toMatch(/unpinned baseline/);
  });

  test("a date alone does not pin anything — a clock reading is not an identity", () => {
    const a = assessDrift(baseline({ date: "2026-07-27" }), stamp(), null);
    expect(a.kind).toBe("unpinned");
    if (a.kind === "unpinned") expect(a.reason).toContain("2026-07-27");
  });

  test("a bun version alone does not pin anything", () => {
    expect(assessDrift(baseline({ bun_version: "1.3.2" }), stamp(), null).kind).toBe("unpinned");
  });

  // THE finding: the provider half is, by this module's own docstring, "a
  // fact about the provider, not evidence of drift". A baseline holding only
  // that half had pinned nothing, yet reported `match` — a positive claim of
  // sameness resting on a field that is not evidence of sameness.
  test("the provider half alone is unpinned, even when it equals this run's", () => {
    const a = assessDrift(
      baseline({ environment_provider_digest: "sha256:41cd" }),
      stamp({ environment_provider_digest: "sha256:41cd" }),
      null,
    );
    expect(a.kind).toBe("unpinned");
    if (a.kind === "unpinned") expect(a.reason).toMatch(/provider half/);
  });

  test("the provider half alone is unpinned when it differs, too", () => {
    expect(
      assessDrift(
        baseline({ environment_provider_digest: "sha256:41cd" }),
        stamp({ environment_provider_digest: "sha256:9999" }),
        null,
      ).kind,
    ).toBe("unpinned");
  });

  // S1: runner.ts casts case JSON straight to CaseRecord without validating,
  // so a case file with no captured_on reaches here as undefined. That threw
  // a TypeError and killed the whole run — the same crash class this module
  // was written to fix, one level up.
  test("a missing captured_on block is unpinned, not a crash", () => {
    for (const bad of [undefined, null, "nope", 42]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = assessDrift(bad as any, stamp(), null);
      expect(a.kind).toBe("unpinned");
      if (a.kind === "unpinned") expect(a.reason).toMatch(/no captured_on block at all/);
    }
  });

  // S2: the producer guards `.length === 0` on both digests; a hand-written
  // case file is not so guarded. An empty string is a field left blank, not a
  // recording, and counting it would let a case escape this branch on nothing.
  test("an empty-string digest is a blank field, not a recording", () => {
    expect(assessDrift(baseline({ environment_digest: "" }), stamp(), null).kind).toBe("unpinned");
  });

  test("empty strings in the descriptive fields do not pin either", () => {
    const a = assessDrift(
      baseline({ os: "", arch: "", kernel_release: "", cortex_commit: "" }),
      stamp(),
      null,
    );
    expect(a.kind).toBe("unpinned");
  });
});

describe("assessDrift — match", () => {
  test("a recorded digest equal to this run's matches", () => {
    expect(
      assessDrift(
        baseline({ environment_digest: "sha256:aa" }),
        stamp({ environment_digest: "sha256:aa" }),
        null,
      ).kind,
    ).toBe("match");
  });

  test("only fields present on both sides are compared", () => {
    // os matches; everything else on the baseline is null and so is not a
    // claim that could disagree.
    expect(assessDrift(baseline({ os: "linux" }), stamp(), null).kind).toBe("match");
  });

  test("a substrate alone is enough to pin, and can match", () => {
    expect(assessDrift(baseline({ substrate: "claude-code" }), stamp(), "claude-code").kind).toBe(
      "match",
    );
  });

  test("date and bun_version are never compared for drift", () => {
    // Both disagree with the current run; neither may produce a difference.
    const a = assessDrift(
      baseline({ os: "linux", date: "1999-01-01", bun_version: "0.0.1" }),
      stamp(),
      null,
    );
    expect(a.kind).toBe("match");
  });

  // Still compared, still reported — the fix removed it from the PIN count,
  // not from the comparison.
  test("a matching provider half alongside a real pin still matches", () => {
    expect(
      assessDrift(
        baseline({ environment_digest: "sha256:aa", environment_provider_digest: "sha256:41cd" }),
        stamp({ environment_digest: "sha256:aa", environment_provider_digest: "sha256:41cd" }),
        null,
      ).kind,
    ).toBe("match");
  });
});

describe("assessDrift — drift", () => {
  test("reports a changed os", () => {
    const a = assessDrift(baseline({ os: "darwin" }), stamp(), null);
    expect(a.kind).toBe("drift");
    if (a.kind === "drift") expect(a.differences).toEqual(["os: darwin -> linux"]);
  });

  test("reports a changed cortex_commit in short form", () => {
    const a = assessDrift(baseline({ cortex_commit: "b".repeat(40) }), stamp(), null);
    if (a.kind === "drift") {
      expect(a.differences[0]).toBe(`cortex_commit: ${"b".repeat(12)} -> ${"a".repeat(12)}`);
    } else {
      throw new Error(`expected drift, got ${a.kind}`);
    }
  });

  test("says so plainly when this run has no cortex checkout", () => {
    const a = assessDrift(
      baseline({ cortex_commit: "b".repeat(40) }),
      stamp({ cortex_commit: null }),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toContain("-> none");
  });

  test("a digest that moved is reported ahead of substrate", () => {
    const a = assessDrift(
      baseline({ environment_digest: "sha256:aaaaaaaaaaaaaa", substrate: "claude-code" }),
      stamp({ environment_digest: "sha256:bbbbbbbbbbbbbb" }),
      "openai-codex",
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toContain("environment_digest: aaaaaaaaaaaa -> bbbbbbbbbbbb");
    expect(a.differences[1]).toContain("substrate: claude-code -> openai-codex");
  });

  test("a case pinned to a digest, run on a machine with none, says which", () => {
    const a = assessDrift(baseline({ environment_digest: "sha256:aa" }), stamp(), null);
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toContain("unfingerprinted machine");
  });

  // THE ROUND-2 FINDING (F1). The absent case above was covered and the
  // refused case was not, in both the code and this file — so the drift
  // renderer kept printing "none (this run is on an unfingerprinted machine)"
  // for a machine that DOES carry a factory file, months after
  // `formatEnvironmentStamp` was taught the difference. One run, two
  // incompatible claims: a header reading `env@unreadable (...)` over per-case
  // lines asserting the machine has no identity.
  //
  // ../../../environments/README.md forbids exactly that assertion — "a
  // refusal means assay knows nothing about this machine's identity, which is
  // not at all the same as knowing it has none." Latent while every baseline
  // in the corpus is null; certain the first time a case is established on a
  // factory VM, which is the scenario this whole branch exists for.
  const REFUSED = {
    environment_file: "refused",
    environment_file_refusal: "schema 2 — this build reads schema 1",
  } as const;

  test("a refused file is reported unreadable, never as an absence", () => {
    const a = assessDrift(baseline({ environment_digest: "sha256:aa" }), stamp(REFUSED), null);
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toBe(
      "environment_digest: aa -> unreadable (schema 2 — this build reads schema 1)",
    );
    // The negative half is the finding: absence must not be claimed on the
    // strength of a null that only means "assay did not look".
    expect(a.differences[0]).not.toContain("unfingerprinted");
    expect(a.differences[0]).not.toContain("none");
  });

  test("the provider half gets the same treatment — it is unread for the same reason", () => {
    const a = assessDrift(
      baseline({ environment_provider_digest: "sha256:41cd", os: "darwin" }),
      stamp(REFUSED),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    const line = a.differences.find((d) => d.startsWith("environment_provider_digest"));
    expect(line).toBe(
      "environment_provider_digest (provider half): 41cd -> unreadable (schema 2 — this build reads schema 1)",
    );
  });

  test("the drift line agrees with the environment line about the same run", () => {
    const s = stamp(REFUSED);
    const a = assessDrift(baseline({ environment_digest: "sha256:aa" }), s, null);
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    // Both renderers describe one machine; a reader must never have to pick
    // which of two lines in the same report to believe.
    expect(formatEnvironmentStamp(s)).toContain("unreadable");
    expect(a.differences[0]).toContain("unreadable");
  });

  test("a refusal with no reason recorded still does not claim an absence", () => {
    const a = assessDrift(
      baseline({ environment_digest: "sha256:aa" }),
      stamp({ environment_file: "refused", environment_file_refusal: null }),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toBe("environment_digest: aa -> unreadable (refused)");
  });

  // The producer guards `.length === 0` on both digests, so this stamp should
  // be unreachable — but the captured side gets the same hardening
  // (`normalizeCapturedOn` collapses `""`), and a renderer that would emit
  // `-> ` for it is one refactor away from being reachable.
  test("an empty-string digest on this run renders as an absence, not as nothing", () => {
    const a = assessDrift(
      baseline({ environment_digest: "sha256:aa" }),
      stamp({ environment_digest: "" }),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toBe(
      "environment_digest: aa -> none (this run is on an unfingerprinted machine)",
    );
  });

  // The third state, guarded so the fix above cannot overshoot into it: the
  // file was READ and the factory simply published no provider half, which
  // the contract allows (`provider_digest` is optional). That is a real
  // absence on the record and "none" is the honest word for it.
  test("a read file with no provider half is none, not unreadable", () => {
    const a = assessDrift(
      baseline({ environment_digest: "sha256:aa", environment_provider_digest: "sha256:41cd" }),
      stamp({
        environment_digest: "sha256:aa",
        environment_provider_digest: null,
        environment_file: "read",
      }),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences[0]).toBe("environment_provider_digest (provider half): 41cd -> none");
  });

  // The provider half keeps its drift comparison — the same treatment date
  // and bun_version do NOT get, because unlike those it is an identity, just
  // not one that pins a machine.
  test("a provider half that moved is reported, labelled as the provider half", () => {
    const a = assessDrift(
      baseline({ environment_digest: "sha256:aa", environment_provider_digest: "sha256:41cd" }),
      stamp({ environment_digest: "sha256:aa", environment_provider_digest: "sha256:9999" }),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences).toEqual([
      "environment_provider_digest (provider half): 41cd -> 9999",
    ]);
  });

  test("reports every field that moved, not just the first", () => {
    const a = assessDrift(
      baseline({ os: "darwin", arch: "arm64", kernel_release: "25.6.0" }),
      stamp(),
      null,
    );
    if (a.kind !== "drift") throw new Error(`expected drift, got ${a.kind}`);
    expect(a.differences).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// the corpus's own invariant
// ---------------------------------------------------------------------------

describe("normalizeCapturedOn completeness (via assessDrift)", () => {
  // A field added to CapturedOnStamp but forgotten in normalizeCapturedOn is
  // exactly the bug that crashed this module the first time: absent in the
  // JSON, `undefined` in the code, `undefined !== null`, compared anyway.
  // This asserts the collapse holds for every nullable field, by feeding a
  // baseline where each is ABSENT rather than explicitly null.
  const fields = [
    "date",
    "os",
    "arch",
    "kernel_release",
    "bun_version",
    "cortex_commit",
    "environment_digest",
    "environment_provider_digest",
    "substrate",
  ] as const;

  for (const f of fields) {
    test(`an absent \`${f}\` is treated as null, not as a recorded value`, () => {
      const partial: Record<string, unknown> = { note: "absent-field fixture" };
      for (const other of fields) if (other !== f) partial[other] = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = assessDrift(partial as any, stamp(), null);
      expect(a.kind).toBe("unpinned");
    });
  }

  test("a captured_on that is entirely empty is unpinned, not a crash", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(assessDrift({} as any, stamp(), null).kind).toBe("unpinned");
  });
});
