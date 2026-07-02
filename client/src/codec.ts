/**
 * Encoding boundary for contract arguments.
 *
 * Keep all low-level proof/public-signal encoding in one module. When Stellar SDK
 * exposes first-class BLS12-381 XDR helpers, only this file should change.
 */

import {
  Attestation,
  AttestationV2,
  AttestationV3,
  ProofBundle,
  SnarkJsGroth16Proof,
} from "./domain.js";
import {
  ContractProofBytes,
  proofToBytes,
  signalToBytes,
} from "./encoding.js";
import { StellarisError } from "./errors.js";
import { parsePublicSignals } from "./signals.js";

export interface ContractProofArgs {
  readonly a: readonly [string, string];
  readonly b: readonly [readonly [string, string], readonly [string, string]];
  readonly c: readonly [string, string];
}

export interface ContractAttestArgs {
  readonly proof: ContractProofArgs;
  readonly publicSignals: readonly string[];
}

/**
 * Byte-exact `attest` arguments ready for ScVal wrapping by a transport.
 * `proof` holds the G1/G2 uncompressed buffers; `publicSignals` are 32-byte
 * big-endian U256 buffers in circuit declaration order. This is the single
 * shared on-chain encoding — see `encoding.ts`.
 */
export interface ContractAttestBytes {
  readonly proof: ContractProofBytes;
  readonly publicSignals: readonly Uint8Array[];
}

export function proofToContractArgs(proof: SnarkJsGroth16Proof): ContractProofArgs {
  if (!Array.isArray(proof.pi_a) || !Array.isArray(proof.pi_b) || !Array.isArray(proof.pi_c)) {
    throw StellarisError.encoding("invalid snarkjs proof shape");
  }
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][0], proof.pi_b[0][1]],
      [proof.pi_b[1][0], proof.pi_b[1][1]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

export function bundleToContractArgs(bundle: ProofBundle): ContractAttestArgs {
  const parsed = parsePublicSignals(bundle.publicSignals);
  if (parsed.commitment !== bundle.parsed.commitment) {
    throw StellarisError.encoding("bundle parsed commitment differs from raw public signals");
  }
  return {
    proof: proofToContractArgs(bundle.proof),
    publicSignals: [...bundle.publicSignals],
  };
}

/**
 * Serialize a proof bundle to the byte-exact `attest` arguments the on-chain
 * verifier consumes. This is the production encoding path: G1 points -> 96-byte
 * uncompressed buffers, G2 -> 192-byte (with the c1||c0 Fp2 ordering), and each
 * public signal -> a 32-byte big-endian U256 buffer. A transport only needs to
 * wrap these in ScVal (ScBytes / ScU256) — no field math at the transport layer.
 */
export function bundleToContractBytes(bundle: ProofBundle): ContractAttestBytes {
  const parsed = parsePublicSignals(bundle.publicSignals);
  if (parsed.commitment !== bundle.parsed.commitment) {
    throw StellarisError.encoding("bundle parsed commitment differs from raw public signals");
  }
  return {
    proof: proofToBytes(bundle.proof),
    publicSignals: bundle.publicSignals.map((s) => signalToBytes(s)),
  };
}

export function decodeAttestation(raw: unknown): Attestation {
  if (!raw || typeof raw !== "object") {
    throw StellarisError.encoding("attestation response is not an object");
  }
  const value = raw as Record<string, unknown>;
  return {
    commitment: String(value.commitment),
    liabilities: BigInt(String(value.liabilities)),
    solvent: Boolean(value.solvent),
    ledgerTs: BigInt(String(value.ledgerTs ?? value.ledger_ts ?? 0)),
    periodId: BigInt(String(value.periodId ?? value.period_id)),
    issuer: String(value.issuer),
  };
}

/**
 * Decode a v2 attestation (solvency with SNARK-proven liabilities). `liabRoot`
 * is a full-width field element (a hash) kept as a string; `liabTotal` is the
 * proven total liabilities.
 */
export function decodeAttestationV2(raw: unknown): AttestationV2 {
  if (!raw || typeof raw !== "object") {
    throw StellarisError.encoding("v2 attestation response is not an object");
  }
  const value = raw as Record<string, unknown>;
  return {
    reserveCommitment: String(value.reserveCommitment ?? value.reserve_commitment),
    liabRoot: String(value.liabRoot ?? value.liab_root),
    liabTotal: BigInt(String(value.liabTotal ?? value.liab_total)),
    solvent: Boolean(value.solvent),
    ledgerTs: BigInt(String(value.ledgerTs ?? value.ledger_ts ?? 0)),
    periodId: BigInt(String(value.periodId ?? value.period_id)),
    issuer: String(value.issuer),
  };
}

/**
 * Decode a v3 multi-asset attestation. `assetSolvent` is the per-asset flag
 * vector (Soroban returns it as an array of bools); `reserveCommitment` and
 * `priceCommitment` are full-width field elements kept as strings.
 */
export function decodeAttestationV3(raw: unknown): AttestationV3 {
  if (!raw || typeof raw !== "object") {
    throw StellarisError.encoding("v3 attestation response is not an object");
  }
  const value = raw as Record<string, unknown>;
  const rawFlags = value.assetSolvent ?? value.asset_solvent ?? [];
  if (!Array.isArray(rawFlags)) {
    throw StellarisError.encoding("v3 assetSolvent is not an array");
  }
  const assetSolvent = rawFlags.map((f) =>
    Boolean(typeof f === "string" ? f === "1" || f === "true" : f),
  );
  return {
    aggregateSolvent: Boolean(value.aggregateSolvent ?? value.aggregate_solvent),
    reserveCommitment: String(value.reserveCommitment ?? value.reserve_commitment),
    priceCommitment: String(value.priceCommitment ?? value.price_commitment),
    assetSolvent,
    oracleBound: Boolean(value.oracleBound ?? value.oracle_bound),
    custodianBound: Boolean(value.custodianBound ?? value.custodian_bound),
    ledgerTs: BigInt(String(value.ledgerTs ?? value.ledger_ts ?? 0)),
    periodId: BigInt(String(value.periodId ?? value.period_id)),
    issuer: String(value.issuer),
  };
}
