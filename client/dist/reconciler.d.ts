/**
 * Deterministic registry reconciliation jobs.
 *
 * This layer turns the registry/indexer primitives into an operational subsystem:
 * each run refreshes issuer state, persists checkpoints, emits redacted audit
 * steps, and classifies partial failures with bounded retry/backoff behavior.
 */
import { AuditSink } from "./audit.js";
import { PublicKey } from "./domain.js";
import { FileCheckpointRepository } from "./persistence.js";
import { AttestationRegistry, RegistrySnapshot } from "./registry.js";
export type ReconciliationStatus = "succeeded" | "failed";
export interface ReconciliationTarget {
    readonly issuer: PublicKey;
    readonly required?: boolean;
}
export interface ReconciliationFailure {
    readonly issuer: PublicKey;
    readonly attempt: number;
    readonly message: string;
    readonly retryable: boolean;
}
export interface ReconciliationResult {
    readonly runId: string;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly status: ReconciliationStatus;
    readonly attempts: number;
    readonly snapshots: readonly RegistrySnapshot[];
    readonly failures: readonly ReconciliationFailure[];
}
export interface BackoffPolicy {
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
}
export interface ReconcilerClock {
    now(): Date;
    sleep(ms: number): Promise<void>;
}
export interface RegistryReconcilerOptions {
    readonly registry: AttestationRegistry;
    readonly targets: readonly ReconciliationTarget[];
    readonly checkpoint?: FileCheckpointRepository;
    readonly auditSink?: AuditSink;
    readonly backoff?: Partial<BackoffPolicy>;
    readonly clock?: ReconcilerClock;
}
export declare class RegistryReconciler {
    private readonly registry;
    private readonly targets;
    private readonly checkpoint?;
    private readonly auditSink;
    private readonly backoff;
    private readonly clock;
    constructor(options: RegistryReconcilerOptions);
    runOnce(): Promise<ReconciliationResult>;
    runMany(count: number): Promise<readonly ReconciliationResult[]>;
    private refreshWithRetry;
    private audit;
}
export declare function makeRegistryReconciler(options: RegistryReconcilerOptions): RegistryReconciler;
export declare function normalizeBackoff(input?: Partial<BackoffPolicy>): BackoffPolicy;
export declare function nextDelayMs(policy: BackoffPolicy, failedAttempt: number): number;
export declare function makeRunId(now: Date): string;
