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
  ProofBundleV2,
  ProofBundleV3,
  SnarkJsGroth16Proof,
} from "./domain.js";
import {
  ContractProofBytes,
  proofToBytes,
  signalToBytes,
} from "./encoding.js";
import { StellarisError } from "./errors.js";
import { parsePublicSignals, parsePublicSignalsV2, parsePublicSignalsV3 } from "./signals.js";

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

export function assertBundleV2Consistency(bundle: ProofBundleV2): void {
  const parsed = parsePublicSignalsV2(bundle.publicSignals);
  if (
    parsed.reserveCommitment !== bundle.parsed.reserveCommitment ||
    parsed.liabRoot !== bundle.parsed.liabRoot ||
    parsed.liabTotal !== bundle.parsed.liabTotal ||
    parsed.periodId !== bundle.parsed.periodId ||
    parsed.solvent !== bundle.parsed.solvent
  ) {
    throw StellarisError.encoding("v2 bundle parsed values differ from raw public signals");
  }
  proofToBytes(bundle.proof);
}

export function assertBundleV3Consistency(bundle: ProofBundleV3): void {
  const parsed = parsePublicSignalsV3(bundle.publicSignals);
  if (
    parsed.aggregateSolvent !== bundle.parsed.aggregateSolvent ||
    parsed.reserveCommitment !== bundle.parsed.reserveCommitment ||
    parsed.priceCommitment !== bundle.parsed.priceCommitment ||
    parsed.periodId !== bundle.parsed.periodId ||
    parsed.assetSolvent.length !== bundle.parsed.assetSolvent.length ||
    parsed.assetSolvent.some((flag, index) => flag !== bundle.parsed.assetSolvent[index])
  ) {
    throw StellarisError.encoding("v3 bundle parsed values differ from raw public signals");
  }
  proofToBytes(bundle.proof);
}

export function decodeAttestation(raw: unknown): Attestation {
  if (!raw || typeof raw !== "object") {
    throw StellarisError.encoding("attestation response is not an object");
  }
  const value = raw as Record<string, unknown>;
  return {
    commitment: String(value.commitment),
    liabilities: BigInt(String(value.liabilities)),
    solvent: decodeBoolean(value.solvent, "solvent"),
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
    solvent: decodeBoolean(value.solvent, "solvent"),
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
  const assetSolvent = rawFlags.map((flag, index) => decodeBoolean(flag, `assetSolvent[${index}]`));
  return {
    aggregateSolvent: decodeBoolean(value.aggregateSolvent ?? value.aggregate_solvent, "aggregateSolvent"),
    reserveCommitment: String(value.reserveCommitment ?? value.reserve_commitment),
    priceCommitment: String(value.priceCommitment ?? value.price_commitment),
    assetSolvent,
    oracleBound: decodeBoolean(value.oracleBound ?? value.oracle_bound, "oracleBound"),
    custodianBound: decodeBoolean(value.custodianBound ?? value.custodian_bound, "custodianBound"),
    ledgerTs: BigInt(String(value.ledgerTs ?? value.ledger_ts ?? 0)),
    periodId: BigInt(String(value.periodId ?? value.period_id)),
    issuer: String(value.issuer),
  };
}
function decodeBoolean(value: unknown, label: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  throw StellarisError.encoding(`${label} must be a boolean-like value`, { value });
}
