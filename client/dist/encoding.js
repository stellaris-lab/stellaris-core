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
import { StellarisError } from "./errors.js";
/** Bytes per BLS12-381 base-field element (Fp), uncompressed big-endian. */
export const FP_SIZE = 48;
/** Bytes per G1 affine point: X(48) || Y(48). */
export const G1_SIZE = 96;
/** Bytes per G2 affine point: X.c1(48) || X.c0(48) || Y.c1(48) || Y.c0(48). */
export const G2_SIZE = 192;
/** Bytes per public signal (U256), big-endian. */
export const U256_SIZE = 32;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
/**
 * Serialize a non-negative decimal string into a fixed-width big-endian buffer.
 * Throws if the value is malformed or overflows `size` bytes.
 */
export function decimalToBytes(decimal, size) {
    if (!DECIMAL.test(decimal)) {
        throw StellarisError.encoding("field element must be a non-negative decimal string", {
            value: decimal,
        });
    }
    let value = BigInt(decimal);
    const out = new Uint8Array(size);
    for (let i = size - 1; i >= 0; i--) {
        out[i] = Number(value & 0xffn);
        value >>= 8n;
    }
    if (value !== 0n) {
        throw StellarisError.encoding(`value exceeds ${size} bytes (serialization overflow)`, {
            value: decimal,
        });
    }
    return out;
}
/** Serialize one Fp field element to 48 big-endian bytes. */
export function fpToBytes(decimal) {
    return decimalToBytes(decimal, FP_SIZE);
}
/** Serialize a G1 affine point [x, y] to 96 uncompressed big-endian bytes: X || Y. */
export function g1ToBytes(x, y) {
    const out = new Uint8Array(G1_SIZE);
    out.set(fpToBytes(x), 0);
    out.set(fpToBytes(y), FP_SIZE);
    return out;
}
/**
 * Serialize a G2 affine point to 192 uncompressed big-endian bytes.
 * Inputs are in snarkjs [c0, c1] order; output writes c1 || c0 per Fp2 (the
 * high coefficient first), matching the on-chain layout.
 */
export function g2ToBytes(xC0, xC1, yC0, yC1) {
    const out = new Uint8Array(G2_SIZE);
    out.set(fpToBytes(xC1), 0);
    out.set(fpToBytes(xC0), FP_SIZE);
    out.set(fpToBytes(yC1), FP_SIZE * 2);
    out.set(fpToBytes(yC0), FP_SIZE * 3);
    return out;
}
/** Serialize a public signal (decimal U256) to 32 big-endian bytes. */
export function signalToBytes(decimal) {
    return decimalToBytes(decimal, U256_SIZE);
}
/**
 * Serialize a snarkjs Groth16 proof to the contract's byte layout (G1/G2
 * uncompressed). This is the byte-exact counterpart to `proofToContractArgs`,
 * which keeps the decimal-string shape for inspection/logging.
 */
export function proofToBytes(proof) {
    if (!Array.isArray(proof.pi_a) || !Array.isArray(proof.pi_b) || !Array.isArray(proof.pi_c)) {
        throw StellarisError.encoding("invalid snarkjs proof shape");
    }
    const a0 = proof.pi_a[0];
    const a1 = proof.pi_a[1];
    const c0 = proof.pi_c[0];
    const c1 = proof.pi_c[1];
    const bx = proof.pi_b[0];
    const by = proof.pi_b[1];
    if (a0 === undefined || a1 === undefined || c0 === undefined || c1 === undefined) {
        throw StellarisError.encoding("proof pi_a / pi_c missing coordinates");
    }
    if (!Array.isArray(bx) || !Array.isArray(by) || bx.length < 2 || by.length < 2) {
        throw StellarisError.encoding("proof pi_b must be [[x.c0,x.c1],[y.c0,y.c1]]");
    }
    return {
        a: g1ToBytes(a0, a1),
        b: g2ToBytes(bx[0], bx[1], by[0], by[1]),
        c: g1ToBytes(c0, c1),
    };
}
/** Lowercase hex of a byte buffer (no 0x prefix) — for tests / debugging. */
export function bytesToHex(bytes) {
    let s = "";
    for (const b of bytes) {
        s += b.toString(16).padStart(2, "0");
    }
    return s;
}
