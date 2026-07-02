/**
 * signals.test.ts — public-signal parse/encode conformance.
 *
 * These tests consume protocol-spec/test-vectors/public-signals.json so the TS
 * SDK and future Rust/JS SDKs are forced to agree on the same canonical vectors.
 */

import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  N_PUBLIC_SIGNALS,
  N_PUBLIC_SIGNALS_V2,
  N_PUBLIC_SIGNALS_V3,
} from "../dist/constants.js";
import { StellarisError } from "../dist/errors.js";
import {
  assertFieldElement,
  encodePublicSignals,
  encodePublicSignalsV2,
  encodePublicSignalsV3,
  parsePublicSignals,
  parsePublicSignalsV2,
  parsePublicSignalsV3,
} from "../dist/signals.js";

type Version = "v1" | "v2" | "v3";

interface SignalVector {
  readonly name: string;
  readonly version: Version;
  readonly signals: readonly string[];
  readonly parsed?: Record<string, unknown>;
}

interface VectorFile {
  readonly vectors: readonly SignalVector[];
  readonly invalidVectors: readonly SignalVector[];
}

const here = dirname(fileURLToPath(import.meta.url));
const vectorPath = resolve(here, "../../protocol-spec/test-vectors/public-signals.json");
const fixture = JSON.parse(readFileSync(vectorPath, "utf8")) as VectorFile;

function parse(version: Version, signals: readonly string[]) {
  switch (version) {
    case "v1":
      return parsePublicSignals(signals);
    case "v2":
      return parsePublicSignalsV2(signals);
    case "v3":
      return parsePublicSignalsV3(signals);
  }
}

function encode(version: Version, parsed: ReturnType<typeof parse>) {
  switch (version) {
    case "v1":
      return encodePublicSignals(parsed as ReturnType<typeof parsePublicSignals>);
    case "v2":
      return encodePublicSignalsV2(parsed as ReturnType<typeof parsePublicSignalsV2>);
    case "v3":
      return encodePublicSignalsV3(parsed as ReturnType<typeof parsePublicSignalsV3>);
  }
}

function decimalString(value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function normalizeParsed(parsed: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(decimalString) : decimalString(value),
    ]),
  );
}

test("protocol-spec counts match SDK constants", () => {
  const counts = new Map(
    fixture.vectors.map((vector) => [vector.version, vector.signals.length]),
  );
  assert.equal(counts.get("v1"), N_PUBLIC_SIGNALS);
  assert.equal(counts.get("v2"), N_PUBLIC_SIGNALS_V2);
  assert.equal(counts.get("v3"), N_PUBLIC_SIGNALS_V3);
});

for (const vector of fixture.vectors) {
  test(`${vector.name}: parses and encodes canonical ${vector.version} vector`, () => {
    const parsed = parse(vector.version, vector.signals);
    assert.deepEqual(normalizeParsed(parsed), vector.parsed);
    assert.deepEqual(encode(vector.version, parsed), vector.signals);
  });
}

for (const vector of fixture.invalidVectors) {
  test(`${vector.name}: rejects invalid ${vector.version} vector`, () => {
    assert.throws(() => parse(vector.version, vector.signals), StellarisError);
  });
}

test("v3: encode rejects a wrong-length assetSolvent vector", () => {
  assert.throws(
    () =>
      encodePublicSignalsV3({
        aggregateSolvent: true,
        reserveCommitment:
          "28184704509896798694171806401809735674629341338708097298840167762771603184872",
        priceCommitment:
          "38920107329329417419205137842949329405942847694151540866319542913651737474578",
        assetSolvent: [true, true],
        periodId: 1n,
      }),
    StellarisError,
  );
});

test("assertFieldElement accepts canonical decimals and rejects junk", () => {
  assert.doesNotThrow(() => assertFieldElement("0", "x"));
  assert.doesNotThrow(() => assertFieldElement("12345", "x"));
  assert.throws(() => assertFieldElement("01", "x"), StellarisError);
  assert.throws(() => assertFieldElement("-1", "x"), StellarisError);
  assert.throws(() => assertFieldElement("0x1f", "x"), StellarisError);
  assert.throws(() => assertFieldElement("", "x"), StellarisError);
});
