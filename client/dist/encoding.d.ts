/**
 * BLS12-381 byte encoding for the Stellaris contract ABI.
 *
 * This is the SINGLE shared converter required by the cross-file proof-encoding
 * invariant: the bytes produced here MUST be identical to what the on-chain
 * Soroban verifier (contracts/stellaris) consumes. The contract takes:
 *
 *   - G1 points (proof.a, proof.c, vk.alpha, vk.ic[i]) as 96-byte uncompressed
 *     big-endian:  X(48) || Y(48)
 *   - G2 points (proof.b, vk.beta/gamma/delta) as 192-byte uncompressed
 *     big-endian:  X.c1(48) || X.c0(48) || Y.c1(48) || Y.c0(48)
 *   - Public signals (U256) as 32-byte big-endian.
 *
 * snarkjs emits each Fp2 as [c0, c1]. The arkworks / Soroban uncompressed
 * serialization writes the HIGH coefficient (c1) first, so the G2 encoder SWAPS
 * within each Fp2 pair. This was confirmed byte-for-byte against the Rust
 * on-chain pairing path (ark-bls12-381 `serialize_uncompressed` feeding the
 * `G2Affine` the verifier accepts) and the official stellar/soroban-examples
 * groth16_verifier. Do NOT reorder without re-running the byte-equality test.
 *
 * This module has ZERO crypto dependencies: it only does fixed-width big-endian
 * serialization of already-reduced field elements. Curve membership is checked
 * on-chain by the verifier, not here.
 */
import { SnarkJsGroth16Proof } from "./domain.js";
/** Bytes per BLS12-381 base-field element (Fp), uncompressed big-endian. */
export declare const FP_SIZE = 48;
/** Bytes per G1 affine point: X(48) || Y(48). */
export declare const G1_SIZE = 96;
/** Bytes per G2 affine point: X.c1(48) || X.c0(48) || Y.c1(48) || Y.c0(48). */
export declare const G2_SIZE = 192;
/** Bytes per public signal (U256), big-endian. */
export declare const U256_SIZE = 32;
/**
 * Serialize a non-negative decimal string into a fixed-width big-endian buffer.
 * Throws if the value is malformed or overflows `size` bytes.
 */
export declare function decimalToBytes(decimal: string, size: number): Uint8Array;
/** Serialize one Fp field element to 48 big-endian bytes. */
export declare function fpToBytes(decimal: string): Uint8Array;
/** Serialize a G1 affine point [x, y] to 96 uncompressed big-endian bytes: X || Y. */
export declare function g1ToBytes(x: string, y: string): Uint8Array;
/**
 * Serialize a G2 affine point to 192 uncompressed big-endian bytes.
 * Inputs are in snarkjs [c0, c1] order; output writes c1 || c0 per Fp2 (the
 * high coefficient first), matching the on-chain layout.
 */
export declare function g2ToBytes(xC0: string, xC1: string, yC0: string, yC1: string): Uint8Array;
/** Serialize a public signal (decimal U256) to 32 big-endian bytes. */
export declare function signalToBytes(decimal: string): Uint8Array;
/** A Groth16 proof serialized to the contract's byte layout. */
export interface ContractProofBytes {
    /** proof.a — G1, 96 bytes. */
    readonly a: Uint8Array;
    /** proof.b — G2, 192 bytes. */
    readonly b: Uint8Array;
    /** proof.c — G1, 96 bytes. */
    readonly c: Uint8Array;
}
/**
 * Serialize a snarkjs Groth16 proof to the contract's byte layout (G1/G2
 * uncompressed). This is the byte-exact counterpart to `proofToContractArgs`,
 * which keeps the decimal-string shape for inspection/logging.
 */
export declare function proofToBytes(proof: SnarkJsGroth16Proof): ContractProofBytes;
/** Lowercase hex of a byte buffer (no 0x prefix) — for tests / debugging. */
export declare function bytesToHex(bytes: Uint8Array): string;
