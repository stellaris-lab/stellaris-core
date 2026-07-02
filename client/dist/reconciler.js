/**
 * Deterministic registry reconciliation jobs.
 *
 * This layer turns the registry/indexer primitives into an operational subsystem:
 * each run refreshes issuer state, persists checkpoints, emits redacted audit
 * steps, and classifies partial failures with bounded retry/backoff behavior.
 */
import { InMemoryAuditSink, makeAuditStep } from "./audit.js";
import { StellarisError } from "./errors.js";
export class RegistryReconciler {
    registry;
    targets;
    checkpoint;
    auditSink;
    backoff;
    clock;
    constructor(options) {
        if (options.targets.length === 0) {
            throw StellarisError.configuration("registry reconciler requires at least one target issuer");
        }
        this.registry = options.registry;
        this.targets = options.targets;
        if (options.checkpoint !== undefined) {
            this.checkpoint = options.checkpoint;
        }
        this.auditSink = options.auditSink ?? new InMemoryAuditSink();
        this.backoff = normalizeBackoff(options.backoff);
        this.clock = options.clock ?? systemClock;
    }
    async runOnce() {
        const runId = makeRunId(this.clock.now());
        const startedAt = this.clock.now().toISOString();
        const snapshots = [];
        const failures = [];
        let attempts = 0;
        await this.audit("reconciler.started", "started", { runId, targets: this.targets.length });
        for (const target of this.targets) {
            const outcome = await this.refreshWithRetry(target);
            attempts += outcome.attempts;
            if (outcome.snapshot) {
                snapshots.push(outcome.snapshot);
            }
            failures.push(...outcome.failures);
        }
        const firstSnapshot = snapshots[0];
        if (this.checkpoint !== undefined && firstSnapshot !== undefined) {
            const records = snapshots.flatMap((snapshot) => [...snapshot.attestations]);
            await this.checkpoint.saveRecords(firstSnapshot.deployment, records);
        }
        const requiredFailure = failures.some((failure) => {
            const target = this.targets.find((item) => item.issuer === failure.issuer);
            return target?.required ?? true;
        });
        const status = requiredFailure ? "failed" : "succeeded";
        await this.audit(status === "succeeded" ? "reconciler.completed" : "reconciler.failed", status === "succeeded" ? "accepted" : "failed", {
            runId,
            snapshots: snapshots.length,
            failures: failures.length,
        });
        return {
            runId,
            startedAt,
            finishedAt: this.clock.now().toISOString(),
            status,
            attempts,
            snapshots,
            failures,
        };
    }
    async runMany(count) {
        if (!Number.isInteger(count) || count <= 0) {
            throw StellarisError.validation("reconciler run count must be a positive integer", { count });
        }
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(await this.runOnce());
        }
        return results;
    }
    async refreshWithRetry(target) {
        const failures = [];
        for (let attempt = 1; attempt <= this.backoff.maxAttempts; attempt++) {
            try {
                await this.audit("issuer.refresh.started", "started", { issuer: target.issuer, attempt });
                const snapshot = await this.registry.refreshIssuer(target.issuer);
                await this.audit("issuer.refresh.completed", "accepted", {
                    issuer: target.issuer,
                    attempt,
                    periods: snapshot.periods.length,
                    gaps: snapshot.diagnostics.missingPeriods.length,
                });
                return { attempts: attempt, snapshot, failures };
            }
            catch (cause) {
                const retryable = isRetryableFailure(cause);
                const failure = makeFailure(target.issuer, attempt, cause, retryable);
                failures.push(failure);
                await this.audit("issuer.refresh.failed", "failed", {
                    issuer: target.issuer,
                    attempt,
                    retryable,
                    message: failure.message,
                });
                if (!retryable || attempt === this.backoff.maxAttempts) {
                    return { attempts: attempt, failures };
                }
                await this.clock.sleep(nextDelayMs(this.backoff, attempt));
            }
        }
        return { attempts: this.backoff.maxAttempts, failures };
    }
    async audit(name, status, context) {
        await this.auditSink.record(makeAuditStep({ name, status, context }));
    }
}
export function makeRegistryReconciler(options) {
    return new RegistryReconciler(options);
}
export function normalizeBackoff(input = {}) {
    const maxAttempts = input.maxAttempts ?? 3;
    const baseDelayMs = input.baseDelayMs ?? 250;
    const maxDelayMs = input.maxDelayMs ?? 5_000;
    if (maxAttempts <= 0 || baseDelayMs < 0 || maxDelayMs < baseDelayMs) {
        throw StellarisError.configuration("invalid reconciler backoff policy", { maxAttempts, baseDelayMs, maxDelayMs });
    }
    return { maxAttempts, baseDelayMs, maxDelayMs };
}
export function nextDelayMs(policy, failedAttempt) {
    const exponential = policy.baseDelayMs * 2 ** Math.max(0, failedAttempt - 1);
    return Math.min(policy.maxDelayMs, exponential);
}
export function makeRunId(now) {
    return `stellaris-reconcile-${now.toISOString()}`;
}
function makeFailure(issuer, attempt, cause, retryable) {
    return {
        issuer,
        attempt,
        retryable,
        message: cause instanceof Error ? cause.message : String(cause),
    };
}
function isRetryableFailure(cause) {
    if (cause instanceof StellarisError) {
        return cause.kind === "transport";
    }
    return !(cause instanceof Error);
}
const systemClock = {
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
