/**
 * Encoding boundary for contract arguments.
 *
 * Keep all low-level proof/public-signal encoding in one module. When Stellar SDK
 * exposes first-class BLS12-381 XDR helpers, only this file should change.
 */
import { Attestation, AttestationV2, AttestationV3, ProofBundle, ProofBundleV2, ProofBundleV3, SnarkJsGroth16Proof } from "./domain.js";
import { ContractProofBytes } from "./encoding.js";
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
export declare function proofToContractArgs(proof: SnarkJsGroth16Proof): ContractProofArgs;
export declare function bundleToContractArgs(bundle: ProofBundle): ContractAttestArgs;
/**
 * Serialize a proof bundle to the byte-exact `attest` arguments the on-chain
 * verifier consumes. This is the production encoding path: G1 points -> 96-byte
 * uncompressed buffers, G2 -> 192-byte (with the c1||c0 Fp2 ordering), and each
 * public signal -> a 32-byte big-endian U256 buffer. A transport only needs to
 * wrap these in ScVal (ScBytes / ScU256) — no field math at the transport layer.
 */
export declare function bundleToContractBytes(bundle: ProofBundle): ContractAttestBytes;
export declare function assertBundleV2Consistency(bundle: ProofBundleV2): void;
export declare function assertBundleV3Consistency(bundle: ProofBundleV3): void;
export declare function decodeAttestation(raw: unknown): Attestation;
/**
 * Decode a v2 attestation (solvency with SNARK-proven liabilities). `liabRoot`
 * is a full-width field element (a hash) kept as a string; `liabTotal` is the
 * proven total liabilities.
 */
export declare function decodeAttestationV2(raw: unknown): AttestationV2;
/**
 * Decode a v3 multi-asset attestation. `assetSolvent` is the per-asset flag
 * vector (Soroban returns it as an array of bools); `reserveCommitment` and
 * `priceCommitment` are full-width field elements kept as strings.
 */
export declare function decodeAttestationV3(raw: unknown): AttestationV3;
