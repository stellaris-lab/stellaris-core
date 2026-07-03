/**
 * High-level Stellaris contract client.
 *
 * This module composes codec + transport + domain types. It does not contain
 * UI or demo mocks. Integrators can supply a real SorobanTransport backed by
 * @stellar/stellar-sdk, a server signer, or a test harness.
 */
import { Attestation, AttestationReceipt, AttestationV2, AttestationReceiptV2, AttestationV3, AttestationReceiptV3, ContractDeployment, FieldElement, ProofBundle, ProofBundleV2, ProofBundleV3, PublicKey, VerificationKeyDocument } from "./domain.js";
import { TransactionSigner, SorobanTransport, TransactionPlan } from "./transport.js";
export declare enum ContractErrorCode {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ProofInvalid = 4,
    NotSolvent = 5,
    PeriodAlreadyAttested = 6,
    BadPublicSignals = 7,
    BadProofEncoding = 8,
    BadLiabilityRoot = 9,
    WrongVerifierVersion = 10,
    OracleMismatch = 11,
    OracleNotConfigured = 12,
    CustodianNotConfigured = 13,
    CustodianSigInvalid = 14
}
export declare class ContractError extends Error {
    readonly code: ContractErrorCode;
    constructor(code: number);
}
export interface StellarisClientOptions {
    readonly deployment: ContractDeployment;
    readonly transport?: SorobanTransport;
}
export interface InitParams {
    readonly admin: PublicKey;
    readonly verificationKey: VerificationKeyDocument;
    readonly signer: TransactionSigner;
}
export interface AttestParams {
    readonly issuer: PublicKey;
    readonly bundle: ProofBundle;
    readonly signer: TransactionSigner;
}
export interface AttestV2Params {
    readonly issuer: PublicKey;
    readonly bundle: ProofBundleV2;
    readonly signer: TransactionSigner;
}
export interface AttestV3Params {
    readonly issuer: PublicKey;
    readonly bundle: ProofBundleV3;
    readonly signer: TransactionSigner;
}
export declare class StellarisClient {
    readonly deployment: ContractDeployment;
    private readonly transport;
    constructor(options: StellarisClientOptions);
    init(params: InitParams): Promise<void>;
    initV2(params: InitParams): Promise<void>;
    initV3(params: InitParams): Promise<void>;
    attest(params: AttestParams): Promise<AttestationReceipt>;
    getAttestation(issuer: PublicKey, periodId: bigint): Promise<Attestation | null>;
    /**
     * v2 attest: solvency with a SNARK-proven liability total. The proof bundle's
     * public signals carry the circuit-computed `liabRoot`/`liabTotal`; the
     * contract codec serializes the raw snarkjs proof via the shared encoder.
     */
    attestV2(params: AttestV2Params): Promise<AttestationReceiptV2>;
    getAttestationV2(issuer: PublicKey, periodId: bigint): Promise<AttestationV2 | null>;
    /**
     * v3 attest: multi-asset solvency with an oracle-priced aggregate. The proof
     * bundle's public signals carry the per-asset solvency flags + the aggregate
     * flag + the reserve/price commitments; the contract requires the AGGREGATE to
     * be solvent and stores the per-asset breakdown for transparency.
     */
    attestV3(params: AttestV3Params): Promise<AttestationReceiptV3>;
    getAttestationV3(issuer: PublicKey, periodId: bigint): Promise<AttestationV3 | null>;
    listPeriods(issuer: PublicKey): Promise<readonly bigint[]>;
    getVerificationKey(): Promise<VerificationKeyDocument | null>;
    getVerificationKeyV2(): Promise<VerificationKeyDocument | null>;
    getVerificationKeyV3(): Promise<VerificationKeyDocument | null>;
    getAdmin(): Promise<PublicKey | null>;
    /**
     * Designate the price-oracle authority (admin-gated on-chain). `admin` must be
     * the contract admin and must sign.
     */
    setOracle(params: {
        readonly admin: PublicKey;
        readonly oracle: PublicKey;
        readonly signer: TransactionSigner;
    }): Promise<void>;
    /**
     * Publish the authoritative price commitment for a period (oracle-gated
     * on-chain). `oracle` must be the designated oracle and must sign. A later
     * `attestV3` for the same period must present a matching `priceCommitment` or
     * be rejected with `OracleMismatch`.
     */
    publishOracleCommitment(params: {
        readonly oracle: PublicKey;
        readonly periodId: bigint;
        readonly commitment: FieldElement;
        readonly signer: TransactionSigner;
    }): Promise<void>;
    getOracle(): Promise<PublicKey | null>;
    getOracleCommitment(periodId: bigint): Promise<FieldElement | null>;
    /**
     * Designate the custodian BLS12-381 public key (G2), admin-gated on-chain.
     * `pk` is the serialized G2 point (the transport/codec encodes it); `admin`
     * must be the contract admin and must sign.
     */
    setCustodian(params: {
        readonly admin: PublicKey;
        readonly custodianPublicKey: unknown;
        readonly signer: TransactionSigner;
    }): Promise<void>;
    /**
     * Attest multi-asset solvency WITH a custodian BLS signature over the
     * reserveCommitment. Like `attestV3` but additionally requires (and the
     * contract verifies on-chain) a real BLS12-381 signature from the designated
     * custodian; on success the attestation is stamped `custodianBound=true`.
     * `custodianSig` is the serialized G1 signature point.
     */
    attestV3Signed(params: {
        readonly issuer: PublicKey;
        readonly bundle: ProofBundleV3;
        readonly custodianSig: unknown;
        readonly signer: TransactionSigner;
    }): Promise<AttestationReceiptV3>;
    getCustodian(): Promise<string | null>;
    plan(operation: TransactionPlan["operation"], args: readonly unknown[]): TransactionPlan;
    private assertSigner;
}
export declare function createStellarisClient(options: StellarisClientOptions): StellarisClient;
