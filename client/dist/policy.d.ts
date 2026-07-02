/**
 * Policy layer for issuer snapshots.
 *
 * Mature protocol SDKs separate policy from mechanics: proving can be valid even
 * when an issuer-level policy rejects the snapshot. This lets integrators enforce
 * stricter business rules before expensive proving or transaction submission.
 */
import { NormalizedReserveSnapshot } from "./domain.js";
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
export declare const DEFAULT_SNAPSHOT_POLICY: Required<SnapshotPolicy>;
export declare function evaluateSnapshotPolicy(snapshot: NormalizedReserveSnapshot, policy?: SnapshotPolicy): PolicyReport;
