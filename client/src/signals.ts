/** Public signal parsing and validation. */

import {
  N_PUBLIC_SIGNALS,
  N_PUBLIC_SIGNALS_V2,
  SIGNAL_INDEX_COMMITMENT,
  SIGNAL_INDEX_LIABILITIES,
  SIGNAL_INDEX_PERIOD,
  SIGNAL_INDEX_SOLVENT,
  SIGNAL_INDEX_V2_LIAB_ROOT,
  SIGNAL_INDEX_V2_LIAB_TOTAL,
  SIGNAL_INDEX_V2_PERIOD,
  SIGNAL_INDEX_V2_RESERVE_COMMITMENT,
  SIGNAL_INDEX_V2_SOLVENT,
  N_ASSETS_V3,
  N_PUBLIC_SIGNALS_V3,
  SIGNAL_INDEX_V3_AGGREGATE_SOLVENT,
  SIGNAL_INDEX_V3_ASSET_SOLVENT_BASE,
  SIGNAL_INDEX_V3_PERIOD,
  SIGNAL_INDEX_V3_PRICE_COMMITMENT,
  SIGNAL_INDEX_V3_RESERVE_COMMITMENT,
} from "./constants.js";
import { FieldElement, PublicSignals, PublicSignalsV2, PublicSignalsV3 } from "./domain.js";
import { StellarisError } from "./errors.js";

const FIELD_DECIMAL = /^(0|[1-9][0-9]*)$/;

export function assertFieldElement(value: string, label: string): void {
  if (!FIELD_DECIMAL.test(value)) {
    throw StellarisError.validation(`${label} must be a decimal field element string`, { value });
  }
}

export function parsePublicSignals(signals: readonly FieldElement[]): PublicSignals {
  if (signals.length !== N_PUBLIC_SIGNALS) {
    throw StellarisError.validation(`expected ${N_PUBLIC_SIGNALS} public signals, got ${signals.length}`);
  }

  for (let i = 0; i < signals.length; i++) {
    const value = signals[i];
    if (value === undefined) {
      throw StellarisError.validation(`publicSignals[${i}] is missing`);
    }
    assertFieldElement(value, `publicSignals[${i}]`);
  }

  const solventRaw = signals[SIGNAL_INDEX_SOLVENT];
  const commitment = signals[SIGNAL_INDEX_COMMITMENT];
  const liabilities = signals[SIGNAL_INDEX_LIABILITIES];
  const period = signals[SIGNAL_INDEX_PERIOD];
  if (
    solventRaw === undefined ||
    commitment === undefined ||
    liabilities === undefined ||
    period === undefined
  ) {
    throw StellarisError.validation("public signals are missing required entries");
  }
  if (solventRaw !== "0" && solventRaw !== "1") {
    throw StellarisError.validation("solvent public signal must be 0 or 1", { solventRaw });
  }

  return {
    solvent: solventRaw === "1",
    commitment,
    liabilities: BigInt(liabilities),
    periodId: BigInt(period),
  };
}

export function encodePublicSignals(signals: PublicSignals): readonly FieldElement[] {
  if (signals.liabilities < 0n) {
    throw StellarisError.validation("liabilities must be non-negative");
  }
  if (signals.periodId < 0n) {
    throw StellarisError.validation("periodId must be non-negative");
  }
  assertFieldElement(signals.commitment, "commitment");

  return [
    signals.solvent ? "1" : "0",
    signals.commitment,
    signals.liabilities.toString(),
    signals.periodId.toString(),
  ];
}

/**
 * Parse the v2 public-signal layout, mirroring the on-chain
 * `parse_public_signals_v2` (contracts/stellaris/src/signals.rs):
 *   [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
 *
 * `reserveCommitment` and `liabRoot` are full-width field elements (hashes) kept
 * as decimal strings; `liabTotal` is the SNARK-proven total liabilities.
 */
export function parsePublicSignalsV2(signals: readonly FieldElement[]): PublicSignalsV2 {
  if (signals.length !== N_PUBLIC_SIGNALS_V2) {
    throw StellarisError.validation(
      `expected ${N_PUBLIC_SIGNALS_V2} v2 public signals, got ${signals.length}`,
    );
  }

  for (let i = 0; i < signals.length; i++) {
    const value = signals[i];
    if (value === undefined) {
      throw StellarisError.validation(`publicSignals[${i}] is missing`);
    }
    assertFieldElement(value, `publicSignals[${i}]`);
  }

  const solventRaw = signals[SIGNAL_INDEX_V2_SOLVENT];
  const reserveCommitment = signals[SIGNAL_INDEX_V2_RESERVE_COMMITMENT];
  const liabRoot = signals[SIGNAL_INDEX_V2_LIAB_ROOT];
  const liabTotal = signals[SIGNAL_INDEX_V2_LIAB_TOTAL];
  const period = signals[SIGNAL_INDEX_V2_PERIOD];
  if (
    solventRaw === undefined ||
    reserveCommitment === undefined ||
    liabRoot === undefined ||
    liabTotal === undefined ||
    period === undefined
  ) {
    throw StellarisError.validation("v2 public signals are missing required entries");
  }
  if (solventRaw !== "0" && solventRaw !== "1") {
    throw StellarisError.validation("solvent public signal must be 0 or 1", { solventRaw });
  }

  return {
    solvent: solventRaw === "1",
    reserveCommitment,
    liabRoot,
    liabTotal: BigInt(liabTotal),
    periodId: BigInt(period),
  };
}

export function encodePublicSignalsV2(signals: PublicSignalsV2): readonly FieldElement[] {
  if (signals.liabTotal < 0n) {
    throw StellarisError.validation("liabTotal must be non-negative");
  }
  if (signals.periodId < 0n) {
    throw StellarisError.validation("periodId must be non-negative");
  }
  assertFieldElement(signals.reserveCommitment, "reserveCommitment");
  assertFieldElement(signals.liabRoot, "liabRoot");

  return [
    signals.solvent ? "1" : "0",
    signals.reserveCommitment,
    signals.liabRoot,
    signals.liabTotal.toString(),
    signals.periodId.toString(),
  ];
}

/**
 * Parse the v3 multi-asset public-signal layout, mirroring the on-chain
 * `parse_public_signals_v3` (contracts/stellaris/src/signals.rs):
 *   [ aggregateSolvent, reserveCommitment, priceCommitment,
 *     assetSolvent[0..N_ASSETS_V3-1], period ]
 *
 * `reserveCommitment`/`priceCommitment` are full-width field elements kept as
 * decimal strings; the aggregate flag and each per-asset flag must be 0 or 1.
 */
export function parsePublicSignalsV3(signals: readonly FieldElement[]): PublicSignalsV3 {
  if (signals.length !== N_PUBLIC_SIGNALS_V3) {
    throw StellarisError.validation(
      `expected ${N_PUBLIC_SIGNALS_V3} v3 public signals, got ${signals.length}`,
    );
  }

  for (let i = 0; i < signals.length; i++) {
    const value = signals[i];
    if (value === undefined) {
      throw StellarisError.validation(`publicSignals[${i}] is missing`);
    }
    assertFieldElement(value, `publicSignals[${i}]`);
  }

  const parseFlag = (value: string, label: string): boolean => {
    if (value === "1") return true;
    if (value === "0") return false;
    throw StellarisError.validation(`${label} must be 0 or 1`, { value });
  };

  const aggregateRaw = signals[SIGNAL_INDEX_V3_AGGREGATE_SOLVENT];
  const reserveCommitment = signals[SIGNAL_INDEX_V3_RESERVE_COMMITMENT];
  const priceCommitment = signals[SIGNAL_INDEX_V3_PRICE_COMMITMENT];
  const period = signals[SIGNAL_INDEX_V3_PERIOD];
  if (
    aggregateRaw === undefined ||
    reserveCommitment === undefined ||
    priceCommitment === undefined ||
    period === undefined
  ) {
    throw StellarisError.validation("v3 public signals are missing required entries");
  }

  const assetSolvent: boolean[] = [];
  for (let a = 0; a < N_ASSETS_V3; a++) {
    const flag = signals[SIGNAL_INDEX_V3_ASSET_SOLVENT_BASE + a];
    if (flag === undefined) {
      throw StellarisError.validation(`assetSolvent[${a}] is missing`);
    }
    assetSolvent.push(parseFlag(flag, `assetSolvent[${a}]`));
  }

  return {
    aggregateSolvent: parseFlag(aggregateRaw, "aggregateSolvent"),
    reserveCommitment,
    priceCommitment,
    assetSolvent,
    periodId: BigInt(period),
  };
}

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
export function encodePublicSignalsV3(signals: PublicSignalsV3): readonly FieldElement[] {
  if (signals.assetSolvent.length !== N_ASSETS_V3) {
    throw StellarisError.validation(
      `assetSolvent must have exactly ${N_ASSETS_V3} entries, got ${signals.assetSolvent.length}`,
    );
  }
  if (signals.periodId < 0n) {
    throw StellarisError.validation("periodId must be non-negative");
  }
  assertFieldElement(signals.reserveCommitment, "reserveCommitment");
  assertFieldElement(signals.priceCommitment, "priceCommitment");

  return [
    signals.aggregateSolvent ? "1" : "0",
    signals.reserveCommitment,
    signals.priceCommitment,
    ...signals.assetSolvent.map((flag) => (flag ? "1" : "0")),
    signals.periodId.toString(),
  ];
}
