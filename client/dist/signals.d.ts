/** Public signal parsing and validation. */
import { FieldElement, PublicSignals, PublicSignalsV2, PublicSignalsV3 } from "./domain.js";
export declare function assertFieldElement(value: string, label: string): void;
export declare function parsePublicSignals(signals: readonly FieldElement[]): PublicSignals;
export declare function encodePublicSignals(signals: PublicSignals): readonly FieldElement[];
/**
 * Parse the v2 public-signal layout, mirroring the on-chain
 * `parse_public_signals_v2` (contracts/stellaris/src/signals.rs):
 *   [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
 *
 * `reserveCommitment` and `liabRoot` are full-width field elements (hashes) kept
 * as decimal strings; `liabTotal` is the SNARK-proven total liabilities.
 */
export declare function parsePublicSignalsV2(signals: readonly FieldElement[]): PublicSignalsV2;
export declare function encodePublicSignalsV2(signals: PublicSignalsV2): readonly FieldElement[];
/**
 * Parse the v3 multi-asset public-signal layout, mirroring the on-chain
 * `parse_public_signals_v3` (contracts/stellaris/src/signals.rs):
 *   [ aggregateSolvent, reserveCommitment, priceCommitment,
 *     assetSolvent[0..N_ASSETS_V3-1], period ]
 *
 * `reserveCommitment`/`priceCommitment` are full-width field elements kept as
 * decimal strings; the aggregate flag and each per-asset flag must be 0 or 1.
 */
export declare function parsePublicSignalsV3(signals: readonly FieldElement[]): PublicSignalsV3;
/**
 * Encode the v3 multi-asset public-signal layout, the inverse of
 * {@link parsePublicSignalsV3}. Produces the exact decimal-string vector the
 * on-chain `parse_public_signals_v3` expects:
 *   [ aggregateSolvent, reserveCommitment, priceCommitment,
 *     assetSolvent[0..N_ASSETS_V3-1], period ]
 *
 * `assetSolvent` must contain exactly `N_ASSETS_V3` flags; a different length is
 * a programming error and is rejected rather than silently padded/truncated.
 */
export declare function encodePublicSignalsV3(signals: PublicSignalsV3): readonly FieldElement[];
