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
export declare const SIGNAL_INDEX_SOLVENT = 0;
export declare const SIGNAL_INDEX_COMMITMENT = 1;
export declare const SIGNAL_INDEX_LIABILITIES = 2;
export declare const SIGNAL_INDEX_PERIOD = 3;
export declare const N_PUBLIC_SIGNALS = 4;
export declare const SIGNAL_INDEX_V2_SOLVENT = 0;
export declare const SIGNAL_INDEX_V2_RESERVE_COMMITMENT = 1;
export declare const SIGNAL_INDEX_V2_LIAB_ROOT = 2;
export declare const SIGNAL_INDEX_V2_LIAB_TOTAL = 3;
export declare const SIGNAL_INDEX_V2_PERIOD = 4;
export declare const N_PUBLIC_SIGNALS_V2 = 5;
export declare const SIGNAL_INDEX_V3_AGGREGATE_SOLVENT = 0;
export declare const SIGNAL_INDEX_V3_RESERVE_COMMITMENT = 1;
export declare const SIGNAL_INDEX_V3_PRICE_COMMITMENT = 2;
export declare const SIGNAL_INDEX_V3_ASSET_SOLVENT_BASE = 3;
export declare const N_ASSETS_V3 = 4;
export declare const SIGNAL_INDEX_V3_PERIOD: number;
export declare const N_PUBLIC_SIGNALS_V3: number;
/** Number of reserve balance slots in the proof-of-reserves circuit. */
export declare const N_RESERVES = 16;
/** Bit-width of each reserve balance (64-bit unsigned integers). */
export declare const N_BITS = 64;
/** Maximum reserve balance value (2^64 - 1). */
export declare const MAX_RESERVE: bigint;
export declare const CURVE = "bls12381";
