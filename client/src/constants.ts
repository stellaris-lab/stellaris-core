/**
 * constants.ts — Public signal order, circuit parameters, and contract metadata.
 *
 * These must match:
 *   - `circuits/PUBLIC_SIGNALS.md`   (generated from snarkjs)
 *   - `contracts/stellaris/src/types.rs` (SIG_* constants)
 *
 * If the circuit compilation changes the signal order, update ONLY
 * `circuits/PUBLIC_SIGNALS.md`, then synchronize this file.
 */

// ---------------------------------------------------------------------------
// Public signal indices (lock-step with circuits/PUBLIC_SIGNALS.md)
// Expected order from snarkjs: [ solvent, commitment, liabilities, period ]
// ---------------------------------------------------------------------------

export const SIGNAL_INDEX_SOLVENT = 0;
export const SIGNAL_INDEX_COMMITMENT = 1;
export const SIGNAL_INDEX_LIABILITIES = 2;
export const SIGNAL_INDEX_PERIOD = 3;
export const N_PUBLIC_SIGNALS = 4;

// ---------------------------------------------------------------------------
// v2 public signal indices (solvency with SNARK-proven liabilities).
// Expected order from snarkjs:
//   [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
// Lock-step with contracts/stellaris/src/types.rs (SIG2_* constants).
// ---------------------------------------------------------------------------

export const SIGNAL_INDEX_V2_SOLVENT = 0;
export const SIGNAL_INDEX_V2_RESERVE_COMMITMENT = 1;
export const SIGNAL_INDEX_V2_LIAB_ROOT = 2;
export const SIGNAL_INDEX_V2_LIAB_TOTAL = 3;
export const SIGNAL_INDEX_V2_PERIOD = 4;
export const N_PUBLIC_SIGNALS_V2 = 5;

// ---------------------------------------------------------------------------
// v3 public signal indices (multi-asset solvency with oracle-priced aggregate).
// Expected order from snarkjs:
//   [ aggregateSolvent, reserveCommitment, priceCommitment,
//     assetSolvent[0..N_ASSETS_V3-1], period ]
// Lock-step with contracts/stellaris/src/types.rs (SIG3_* constants) and
// circuits/PUBLIC_SIGNALS.md.
// ---------------------------------------------------------------------------

export const SIGNAL_INDEX_V3_AGGREGATE_SOLVENT = 0;
export const SIGNAL_INDEX_V3_RESERVE_COMMITMENT = 1;
export const SIGNAL_INDEX_V3_PRICE_COMMITMENT = 2;
export const SIGNAL_INDEX_V3_ASSET_SOLVENT_BASE = 3; // assetSolvent[a] at base + a
export const N_ASSETS_V3 = 4;
export const SIGNAL_INDEX_V3_PERIOD = SIGNAL_INDEX_V3_ASSET_SOLVENT_BASE + N_ASSETS_V3; // 7
export const N_PUBLIC_SIGNALS_V3 = SIGNAL_INDEX_V3_PERIOD + 1; // 8

// ---------------------------------------------------------------------------
// Circuit parameters
// ---------------------------------------------------------------------------

/** Number of reserve balance slots in the proof-of-reserves circuit. */
export const N_RESERVES = 16;

/** Bit-width of each reserve balance (64-bit unsigned integers). */
export const N_BITS = 64;

/** Maximum reserve balance value (2^64 - 1). */
export const MAX_RESERVE = (1n << BigInt(N_BITS)) - 1n;

// ---------------------------------------------------------------------------
// Curve identifier matching the compiled circuit and Soroban verifier.
// BLS12-381 per the official Stellar groth16_verifier example.
// ---------------------------------------------------------------------------

export const CURVE = "bls12381";
