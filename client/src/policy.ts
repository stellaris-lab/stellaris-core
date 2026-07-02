/**
 * Policy layer for issuer snapshots.
 *
 * Mature protocol SDKs separate policy from mechanics: proving can be valid even
 * when an issuer-level policy rejects the snapshot. This lets integrators enforce
 * stricter business rules before expensive proving or transaction submission.
 */

import { NormalizedReserveSnapshot, totalReserves } from "./domain.js";

export interface PolicyFinding {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
}

export interface SnapshotPolicy {
  readonly minReserveRatioBps?: bigint;
  readonly maxAccounts?: number;
  readonly requireMetadata?: boolean;
  readonly requireExternalReportUri?: boolean;
  readonly allowZeroBalanceAccounts?: boolean;
}

export interface PolicyReport {
  readonly accepted: boolean;
  readonly reserveRatioBps: bigint | null;
  readonly findings: readonly PolicyFinding[];
}

export const DEFAULT_SNAPSHOT_POLICY: Required<SnapshotPolicy> = {
  minReserveRatioBps: 10_000n,
  maxAccounts: 16,
  requireMetadata: false,
  requireExternalReportUri: false,
  allowZeroBalanceAccounts: true,
};

export function evaluateSnapshotPolicy(
  snapshot: NormalizedReserveSnapshot,
  policy: SnapshotPolicy = DEFAULT_SNAPSHOT_POLICY,
): PolicyReport {
  const effective = { ...DEFAULT_SNAPSHOT_POLICY, ...policy };
  const findings: PolicyFinding[] = [];
  const reserves = totalReserves(snapshot);
  const ratio = snapshot.liabilities === 0n ? null : (reserves * 10_000n) / snapshot.liabilities;

  if (snapshot.accounts.length > effective.maxAccounts) {
    findings.push({
      code: "too_many_accounts",
      severity: "error",
      message: `snapshot has ${snapshot.accounts.length} accounts; max is ${effective.maxAccounts}`,
    });
  }

  if (ratio !== null && ratio < effective.minReserveRatioBps) {
    findings.push({
      code: "insufficient_reserve_ratio",
      severity: "error",
      message: `reserve ratio ${ratio} bps below required ${effective.minReserveRatioBps} bps`,
    });
  }

  if (!effective.allowZeroBalanceAccounts) {
    const zero = snapshot.accounts.find((account) => account.balance === 0n);
    if (zero) {
      findings.push({
        code: "zero_balance_account",
        severity: "warning",
        message: `account ${zero.label} has zero balance`,
      });
    }
  }

  if (effective.requireMetadata && !snapshot.metadata) {
    findings.push({ code: "metadata_missing", severity: "error", message: "snapshot metadata is required" });
  }

  if (effective.requireExternalReportUri && !snapshot.metadata?.externalReportUri) {
    findings.push({
      code: "external_report_missing",
      severity: "error",
      message: "external report URI is required by policy",
    });
  }

  return {
    accepted: findings.every((finding) => finding.severity !== "error"),
    reserveRatioBps: ratio,
    findings,
  };
}
