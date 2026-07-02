/**
 * Audit artifacts for prover/Stellaris workflows.
 *
 * These records are safe to persist in backend logs or attach to operational run
 * books. They intentionally exclude reserve balances and salts.
 */
import { AttestationReceipt, ContractDeployment, PeriodId, PublicKey, PublicSignals } from "./domain.js";
import { PolicyReport } from "./policy.js";
export type AuditStepStatus = "started" | "accepted" | "rejected" | "failed" | "submitted";
export interface AuditStep {
    readonly at: string;
    readonly name: string;
    readonly status: AuditStepStatus;
    readonly message?: string;
    readonly context?: Record<string, unknown>;
}
export interface AttestationAuditLog {
    readonly schemaVersion: "stellaris.audit.v1";
    readonly workflowId: string;
    readonly issuer: PublicKey;
    readonly periodId: PeriodId;
    readonly deployment: ContractDeployment;
    readonly publicSignals?: PublicSignals;
    readonly policyReport?: PolicyReport;
    readonly receipt?: AttestationReceipt;
    readonly steps: readonly AuditStep[];
}
export interface AuditSink {
    record(step: AuditStep): void | Promise<void>;
}
export declare class InMemoryAuditSink implements AuditSink {
    private readonly entries;
    record(step: AuditStep): void;
    snapshot(): readonly AuditStep[];
}
export declare function makeWorkflowId(issuer: PublicKey, periodId: PeriodId): string;
export declare function redactPublicSignals(signals: PublicSignals): PublicSignals;
export declare function makeAuditStep(input: {
    readonly name: string;
    readonly status: AuditStepStatus;
    readonly message?: string;
    readonly context?: Record<string, unknown>;
}): AuditStep;
export declare function makeAuditLog(input: {
    readonly workflowId: string;
    readonly issuer: PublicKey;
    readonly periodId: PeriodId;
    readonly deployment: ContractDeployment;
    readonly steps: readonly AuditStep[];
    readonly publicSignals?: PublicSignals;
    readonly policyReport?: PolicyReport;
    readonly receipt?: AttestationReceipt;
}): AttestationAuditLog;
