/** Transport abstractions for Soroban RPC and generated bindings. */
import { StellarisError, wrapUnknown } from "./errors.js";
import { assertOperationArgs, getOperationSpec, isReadOperation } from "./operations.js";
export class BindingSorobanTransport {
    invoker;
    maxAttempts;
    baseDelayMs;
    retryable;
    constructor(options) {
        this.invoker = options.invoker;
        this.maxAttempts = options.maxAttempts ?? 3;
        this.baseDelayMs = options.baseDelayMs ?? 250;
        this.retryable = options.retryable ?? defaultRetryable;
    }
    async invoke(plan, signer) {
        this.validatePlan(plan, "write");
        const request = this.toRequest(plan, signer?.publicKey);
        const response = await this.withRetry(plan, () => this.invoker.invoke(request, signer));
        return normalizeTransactionResult(response);
    }
    async simulate(plan) {
        this.validatePlan(plan, "read");
        const request = this.toRequest(plan);
        return this.withRetry(plan, () => this.invoker.simulate(request));
    }
    validatePlan(plan, mode) {
        assertOperationArgs(plan.operation, plan.args);
        const spec = getOperationSpec(plan.operation);
        if (mode === "read" && !isReadOperation(plan.operation)) {
            throw StellarisError.transport(`cannot simulate mutating operation ${plan.operation}`);
        }
        if (mode === "write" && spec.mutability !== "write") {
            throw StellarisError.transport(`cannot invoke read-only operation ${plan.operation}`);
        }
    }
    toRequest(plan, signerPublicKey) {
        return {
            contractId: plan.contractId,
            operation: plan.operation,
            args: plan.args,
            deployment: plan.deployment,
            ...(signerPublicKey === undefined ? {} : { signerPublicKey }),
            ...(plan.idempotencyKey === undefined ? {} : { idempotencyKey: plan.idempotencyKey }),
            ...(plan.timeoutMs === undefined ? {} : { timeoutMs: plan.timeoutMs }),
        };
    }
    async withRetry(plan, action) {
        let lastError;
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                return await action();
            }
            catch (error) {
                lastError = error;
                if (attempt >= this.maxAttempts || !this.retryable(error, attempt, plan)) {
                    throw wrapUnknown("transport", `transport failed for ${plan.operation}`, error);
                }
                await delay(this.baseDelayMs * 2 ** (attempt - 1));
            }
        }
        throw wrapUnknown("transport", `transport failed for ${plan.operation}`, lastError);
    }
}
export class UnconfiguredSorobanTransport {
    async invoke(plan, _signer) {
        throw StellarisError.transport(`no Soroban transport configured for ${plan.operation}`, {
            context: { operation: plan.operation, contractId: plan.contractId },
        });
    }
    async simulate(plan) {
        throw StellarisError.transport(`no Soroban transport configured for ${plan.operation}`, {
            context: { operation: plan.operation, contractId: plan.contractId },
        });
    }
}
export function normalizeTransactionResult(response) {
    return {
        value: response.value,
        ...(response.transactionHash === undefined ? {} : { transactionHash: response.transactionHash }),
        ...(response.ledger === undefined ? {} : { ledger: BigInt(String(response.ledger)) }),
        ...(response.envelopeXdr === undefined ? {} : { envelopeXdr: response.envelopeXdr }),
        ...(response.diagnosticEvents === undefined ? {} : { diagnosticEvents: response.diagnosticEvents }),
    };
}
export function defaultRetryable(error, _attempt, _plan) {
    if (error instanceof StellarisError) {
        return error.kind === "transport";
    }
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes("timeout") || message.includes("rate") || message.includes("temporar");
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
