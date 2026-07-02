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

export class InMemoryAuditSink implements AuditSink {
  private readonly entries: AuditStep[] = [];

  record(step: AuditStep): void {
    this.entries.push(step);
  }

  snapshot(): readonly AuditStep[] {
    return [...this.entries];
  }
}

export function makeWorkflowId(issuer: PublicKey, periodId: PeriodId): string {
  return `stellaris:${issuer}:${periodId}:${Date.now()}`;
}

export function redactPublicSignals(signals: PublicSignals): PublicSignals {
  return {
    solvent: signals.solvent,
    commitment: signals.commitment,
    liabilities: signals.liabilities,
    periodId: signals.periodId,
  };
}

export function makeAuditStep(input: {
  readonly name: string;
  readonly status: AuditStepStatus;
  readonly message?: string;
  readonly context?: Record<string, unknown>;
}): AuditStep {
  return {
    at: new Date().toISOString(),
    name: input.name,
    status: input.status,
    ...(input.message === undefined ? {} : { message: input.message }),
    ...(input.context === undefined ? {} : { context: input.context }),
  };
}

export function makeAuditLog(input: {
  readonly workflowId: string;
  readonly issuer: PublicKey;
  readonly periodId: PeriodId;
  readonly deployment: ContractDeployment;
  readonly steps: readonly AuditStep[];
  readonly publicSignals?: PublicSignals;
  readonly policyReport?: PolicyReport;
  readonly receipt?: AttestationReceipt;
}): AttestationAuditLog {
  return {
    schemaVersion: "stellaris.audit.v1",
    workflowId: input.workflowId,
    issuer: input.issuer,
    periodId: input.periodId,
    deployment: input.deployment,
    steps: [...input.steps],
    ...(input.publicSignals === undefined ? {} : { publicSignals: redactPublicSignals(input.publicSignals) }),
    ...(input.policyReport === undefined ? {} : { policyReport: input.policyReport }),
    ...(input.receipt === undefined ? {} : { receipt: input.receipt }),
  };
}
