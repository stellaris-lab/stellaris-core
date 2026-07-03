import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertBundleV3Consistency,
  decodeAttestation,
  decodeAttestationV3,
} from "../dist/codec.js";
import { StellarisError } from "../dist/errors.js";
import type { SnarkJsGroth16Proof } from "../dist/domain.js";

const proof: SnarkJsGroth16Proof = {
  pi_a: ["1", "2", "1"],
  pi_b: [["3", "4"], ["5", "6"], ["1", "0"]],
  pi_c: ["7", "8", "1"],
};

test("decodeAttestation parses boolean-like false values strictly", () => {
  const decoded = decodeAttestation({
    commitment: "9",
    liabilities: "10",
    solvent: "false",
    period_id: "1",
    issuer: "GISSUER",
  });

  assert.equal(decoded.solvent, false);
});

test("decodeAttestation rejects ambiguous boolean values", () => {
  assert.throws(
    () =>
      decodeAttestation({
        commitment: "9",
        liabilities: "10",
        solvent: "nope",
        period_id: "1",
        issuer: "GISSUER",
      }),
    StellarisError,
  );
});

test("decodeAttestationV3 parses provenance flags strictly", () => {
  const decoded = decodeAttestationV3({
    aggregate_solvent: "1",
    reserve_commitment: "11",
    price_commitment: "12",
    asset_solvent: ["true", "false", 1, 0],
    oracle_bound: "0",
    custodian_bound: "1",
    ledger_ts: "123",
    period_id: "9",
    issuer: "GISSUER",
  });

  assert.deepEqual(decoded.assetSolvent, [true, false, true, false]);
  assert.equal(decoded.oracleBound, false);
  assert.equal(decoded.custodianBound, true);
});

test("assertBundleV3Consistency rejects parsed/public-signal drift", () => {
  assert.throws(
    () =>
      assertBundleV3Consistency({
        proof,
        publicSignals: ["1", "11", "12", "1", "1", "1", "1", "9"],
        parsed: {
          aggregateSolvent: true,
          reserveCommitment: "11",
          priceCommitment: "12",
          assetSolvent: [true, true, true, false],
          periodId: BigInt(9),
        },
      }),
    StellarisError,
  );
});
