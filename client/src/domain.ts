/**
 * Domain model for the Stellaris proof-of-reserves SDK.
 *
 * This file intentionally has no Stellar SDK or snarkjs imports. Mature SDKs keep
 * domain primitives independent from transport/proving so they can be reused by
 * CLIs, backend services, browser apps, tests, and indexers.
 */

import { MAX_RESERVE, N_RESERVES } from "./constants.js";
import { StellarisError } from "./errors.js";

export type DecimalString = string;
export type PublicKey = string;
export type ContractId = string;
export type UnixTimestamp = bigint;
export type PeriodId = bigint;
export type FieldElement = DecimalString;

export interface ReserveAccount {
  readonly label: string;
  readonly balance: bigint;
  readonly asset?: string;
  readonly sourceRef?: string;
}

export interface LiabilityStatement {
  readonly total: bigint;
  readonly asset?: string;
  readonly sourceRef?: string;
}

export interface ReserveSnapshot {
  readonly periodId: PeriodId;
  readonly accounts: readonly ReserveAccount[];
  readonly liabilities: LiabilityStatement;
  readonly salt: bigint;
  readonly metadata?: SnapshotMetadata;
}

export interface SnapshotMetadata {
  readonly issuerName?: string;
  readonly ledger?: bigint;
  readonly generatedAt?: UnixTimestamp;
  readonly externalReportUri?: string;
  readonly notes?: readonly string[];
}

export interface NormalizedReserveSnapshot {
  readonly periodId: PeriodId;
  readonly balances: readonly bigint[];
  readonly liabilities: bigint;
  readonly salt: bigint;
  readonly accounts: readonly ReserveAccount[];
  readonly metadata?: SnapshotMetadata;
}

export interface PublicSignals {
  readonly solvent: boolean;
  readonly commitment: FieldElement;
  readonly liabilities: bigint;
  readonly periodId: PeriodId;
}

export interface ProofBundle {
  readonly proof: SnarkJsGroth16Proof;
  readonly publicSignals: readonly FieldElement[];
  readonly parsed: PublicSignals;
}

/** v2 public signals: [solvent, reserveCommitment, liabRoot, liabTotal, period]. */
export interface PublicSignalsV2 {
  readonly solvent: boolean;
  readonly reserveCommitment: FieldElement;
  readonly liabRoot: FieldElement;
  readonly liabTotal: bigint;
  readonly periodId: PeriodId;
}

export interface ProofBundleV2 {
  readonly proof: SnarkJsGroth16Proof;
  readonly publicSignals: readonly FieldElement[];
  readonly parsed: PublicSignalsV2;
}

/**
 * v3 public signals (multi-asset): [aggregateSolvent, reserveCommitment,
 * priceCommitment, assetSolvent[0..n-1], period]. `assetSolvent` is the
 * per-asset flag vector; `aggregateSolvent` is the oracle-priced aggregate.
 */
export interface PublicSignalsV3 {
  readonly aggregateSolvent: boolean;
  readonly reserveCommitment: FieldElement;
  readonly priceCommitment: FieldElement;
  readonly assetSolvent: readonly boolean[];
  readonly periodId: PeriodId;
}

export interface ProofBundleV3 {
  readonly proof: SnarkJsGroth16Proof;
  readonly publicSignals: readonly FieldElement[];
  readonly parsed: PublicSignalsV3;
}

/** A G2 point pair as emitted by snarkjs (two field-element coordinates). */
export type Groth16G2Pair = readonly [FieldElement, FieldElement];

export interface SnarkJsGroth16Proof {
  readonly pi_a: readonly [FieldElement, FieldElement, FieldElement?];
  readonly pi_b: readonly [Groth16G2Pair, Groth16G2Pair, Groth16G2Pair?];
  readonly pi_c: readonly [FieldElement, FieldElement, FieldElement?];
  readonly protocol?: string;
  readonly curve?: string;
}

export interface Attestation {
  readonly commitment: FieldElement;
  readonly liabilities: bigint;
  readonly solvent: boolean;
  readonly ledgerTs: UnixTimestamp;
  readonly periodId: PeriodId;
  readonly issuer: PublicKey;
}

export interface AttestationReceipt {
  readonly attestation: Attestation;
  readonly transactionHash?: string;
  readonly ledger?: bigint;
  readonly networkPassphrase: string;
  readonly contractId: ContractId;
}

/**
 * v2 attestation: solvency with a SNARK-proven liability total. Unlike v1, the
 * liability figure (`liabTotal`) is not a trusted scalar — it is the constrained
 * total of a Merkle-sum liability tree, committed to by `liabRoot`.
 */
export interface AttestationV2 {
  readonly reserveCommitment: FieldElement;
  readonly liabRoot: FieldElement; // Merkle-sum root hash (full-width field element)
  readonly liabTotal: bigint; // PROVEN total liabilities, not declared
  readonly solvent: boolean;
  readonly ledgerTs: UnixTimestamp;
  readonly periodId: PeriodId;
  readonly issuer: PublicKey;
}

export interface AttestationReceiptV2 {
  readonly attestation: AttestationV2;
  readonly transactionHash?: string;
  readonly ledger?: bigint;
  readonly networkPassphrase: string;
  readonly contractId: ContractId;
}

/**
 * v3 multi-asset attestation: oracle-priced aggregate solvency plus per-asset
 * flags. `aggregateSolvent` is the priced cross-asset solvency; `assetSolvent`
 * is the per-asset breakdown (an asset may be underwater while the aggregate is
 * solvent). `priceCommitment` binds the price vector used (trust boundary: the
 * prices' authenticity is a C3 signed-feed concern).
 */
export interface AttestationV3 {
  readonly aggregateSolvent: boolean;
  readonly reserveCommitment: FieldElement;
  readonly priceCommitment: FieldElement;
  readonly assetSolvent: readonly boolean[];
  /**
   * C3 provenance: true iff a designated-oracle price commitment was published
   * for this period AND the attested priceCommitment matched it. When false the
   * prices are issuer-chosen; a consumer requiring oracle-bound pricing MUST
   * check this flag.
   */
  readonly oracleBound: boolean;
  /**
   * C2 provenance: true iff a designated custodian's BLS12-381 signature over the
   * reserveCommitment was presented and verified on-chain (via `attestV3Signed`).
   * When false the reserves are not custodian-attested; a consumer requiring a
   * named-custodian signature MUST check this flag.
   */
  readonly custodianBound: boolean;
  readonly ledgerTs: UnixTimestamp;
  readonly periodId: PeriodId;
  readonly issuer: PublicKey;
}

export interface AttestationReceiptV3 {
  readonly attestation: AttestationV3;
  readonly transactionHash?: string;
  readonly ledger?: bigint;
  readonly networkPassphrase: string;
  readonly contractId: ContractId;
}

export interface VerificationKeyDocument {
  readonly protocol?: string;
  readonly curve?: string;
  readonly nPublic?: number;
  readonly vk_alpha_1?: unknown;
  readonly vk_beta_2?: unknown;
  readonly vk_gamma_2?: unknown;
  readonly vk_delta_2?: unknown;
  readonly IC?: unknown[];
  readonly [key: string]: unknown;
}

export interface ProvingArtifacts {
  readonly wasmUrl: string;
  readonly zkeyUrl: string;
  readonly verificationKey?: VerificationKeyDocument;
}

export interface ContractDeployment {
  readonly contractId: ContractId;
  readonly networkPassphrase: string;
  readonly rpcUrl: string;
}

export function normalizeSnapshot(snapshot: ReserveSnapshot): NormalizedReserveSnapshot {
  if (snapshot.accounts.length === 0) {
    throw StellarisError.validation("reserve snapshot must include at least one account");
  }
  if (snapshot.accounts.length > N_RESERVES) {
    throw StellarisError.validation(`reserve snapshot has ${snapshot.accounts.length} accounts; max is ${N_RESERVES}`);
  }
  if (snapshot.periodId < 0n) {
    throw StellarisError.validation("periodId must be non-negative");
  }
  if (snapshot.salt < 0n) {
    throw StellarisError.validation("salt must be non-negative");
  }
  if (snapshot.liabilities.total < 0n) {
    throw StellarisError.validation("liabilities must be non-negative");
  }

  const balances = snapshot.accounts.map((account, index) => {
    if (!account.label || account.label.trim().length === 0) {
      throw StellarisError.validation(`reserve account ${index} is missing a label`);
    }
    if (account.balance < 0n || account.balance > MAX_RESERVE) {
      throw StellarisError.validation(`reserve account ${account.label} balance is outside uint64 range`);
    }
    return account.balance;
  });

  return {
    periodId: snapshot.periodId,
    balances,
    liabilities: snapshot.liabilities.total,
    salt: snapshot.salt,
    accounts: snapshot.accounts,
    ...(snapshot.metadata === undefined ? {} : { metadata: snapshot.metadata }),
  };
}

export function totalReserves(snapshot: Pick<NormalizedReserveSnapshot, "balances">): bigint {
  return snapshot.balances.reduce((sum, balance) => sum + balance, 0n);
}

export function isSolvent(snapshot: Pick<NormalizedReserveSnapshot, "balances" | "liabilities">): boolean {
  return totalReserves(snapshot) >= snapshot.liabilities;
}

export function toReserveInput(snapshot: NormalizedReserveSnapshot): {
  balances: bigint[];
  salt: bigint;
  liabilities: bigint;
  periodId: bigint;
} {
  return {
    balances: [...snapshot.balances],
    salt: snapshot.salt,
    liabilities: snapshot.liabilities,
    periodId: snapshot.periodId,
  };
}
