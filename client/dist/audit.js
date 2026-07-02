/**
 * Audit artifacts for prover/Stellaris workflows.
 *
 * These records are safe to persist in backend logs or attach to operational run
 * books. They intentionally exclude reserve balances and salts.
 */
export class InMemoryAuditSink {
    entries = [];
    record(step) {
        this.entries.push(step);
    }
    snapshot() {
        return [...this.entries];
    }
}
export function makeWorkflowId(issuer, periodId) {
    return `stellaris:${issuer}:${periodId}:${Date.now()}`;
}
export function redactPublicSignals(signals) {
    return {
        solvent: signals.solvent,
        commitment: signals.commitment,
        liabilities: signals.liabilities,
        periodId: signals.periodId,
    };
}
export function makeAuditStep(input) {
    return {
        at: new Date().toISOString(),
        name: input.name,
        status: input.status,
        ...(input.message === undefined ? {} : { message: input.message }),
        ...(input.context === undefined ? {} : { context: input.context }),
    };
}
export function makeAuditLog(input) {
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
