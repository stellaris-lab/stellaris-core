/** Transport abstractions for Soroban RPC and generated bindings. */

import { ContractDeployment, PublicKey } from "./domain.js";
import { StellarisError, wrapUnknown } from "./errors.js";
import { ContractOperation, assertOperationArgs, getOperationSpec, isReadOperation } from "./operations.js";

export interface TransactionSigner {
  readonly publicKey: PublicKey;
  sign(transactionXdr: string, networkPassphrase: string): Promise<string>;
}

export interface TransactionPlan<Name extends ContractOperation = ContractOperation> {
  readonly operation: Name;
  readonly contractId: string;
  readonly args: readonly unknown[];
  readonly deployment: ContractDeployment;
  readonly idempotencyKey?: string;
  readonly timeoutMs?: number;
}

export interface TransactionResult<T> {
  readonly value: T;
  readonly transactionHash?: string;
  readonly ledger?: bigint;
  readonly envelopeXdr?: string;
  readonly diagnosticEvents?: readonly unknown[];
}

export interface SorobanTransport {
  invoke<T>(plan: TransactionPlan, signer?: TransactionSigner): Promise<TransactionResult<T>>;
  simulate<T>(plan: TransactionPlan): Promise<T>;
}

export interface ContractInvocationRequest {
  readonly contractId: string;
  readonly operation: ContractOperation;
  readonly args: readonly unknown[];
  readonly deployment: ContractDeployment;
  readonly signerPublicKey?: PublicKey;
  readonly idempotencyKey?: string;
  readonly timeoutMs?: number;
}

export interface ContractInvocationResponse<T = unknown> {
  readonly value: T;
  readonly transactionHash?: string;
  readonly ledger?: bigint | number | string;
  readonly envelopeXdr?: string;
  readonly diagnosticEvents?: readonly unknown[];
}

export interface ContractInvoker {
  invoke<T>(request: ContractInvocationRequest, signer?: TransactionSigner): Promise<ContractInvocationResponse<T>>;
  simulate<T>(request: ContractInvocationRequest): Promise<T>;
}

export interface RetryingTransportOptions {
  readonly invoker: ContractInvoker;
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly retryable?: (error: unknown, attempt: number, plan: TransactionPlan) => boolean;
}

export class BindingSorobanTransport implements SorobanTransport {
  private readonly invoker: ContractInvoker;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly retryable: (error: unknown, attempt: number, plan: TransactionPlan) => boolean;

  constructor(options: RetryingTransportOptions) {
    this.invoker = options.invoker;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 250;
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw StellarisError.configuration("maxAttempts must be a positive integer");
    }
    if (!Number.isFinite(this.baseDelayMs) || this.baseDelayMs < 0) {
      throw StellarisError.configuration("baseDelayMs must be a non-negative finite number");
    }
    this.retryable = options.retryable ?? defaultRetryable;
  }

  async invoke<T>(plan: TransactionPlan, signer?: TransactionSigner): Promise<TransactionResult<T>> {
    this.validatePlan(plan, "write");
    const request = this.toRequest(plan, signer?.publicKey);
    const action = () => this.invoker.invoke<T>(request, signer);
    const response = plan.idempotencyKey === undefined ? await action() : await this.withRetry(plan, action);
    return normalizeTransactionResult(response);
  }

  async simulate<T>(plan: TransactionPlan): Promise<T> {
    this.validatePlan(plan, "read");
    const request = this.toRequest(plan);
    return this.withRetry(plan, () => this.invoker.simulate<T>(request));
  }

  private validatePlan(plan: TransactionPlan, mode: "read" | "write"): void {
    assertOperationArgs(plan.operation, plan.args);
    const spec = getOperationSpec(plan.operation);
    if (mode === "read" && !isReadOperation(plan.operation)) {
      throw StellarisError.transport(`cannot simulate mutating operation ${plan.operation}`);
    }
    if (mode === "write" && spec.mutability !== "write") {
      throw StellarisError.transport(`cannot invoke read-only operation ${plan.operation}`);
    }
  }

  private toRequest(plan: TransactionPlan, signerPublicKey?: PublicKey): ContractInvocationRequest {
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

  private async withRetry<T>(plan: TransactionPlan, action: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await action();
      } catch (error) {
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

export class UnconfiguredSorobanTransport implements SorobanTransport {
  async invoke<T>(plan: TransactionPlan, _signer?: TransactionSigner): Promise<TransactionResult<T>> {
    throw StellarisError.transport(`no Soroban transport configured for ${plan.operation}`, {
      context: { operation: plan.operation, contractId: plan.contractId },
    });
  }

  async simulate<T>(plan: TransactionPlan): Promise<T> {
    throw StellarisError.transport(`no Soroban transport configured for ${plan.operation}`, {
      context: { operation: plan.operation, contractId: plan.contractId },
    });
  }
}

export function normalizeTransactionResult<T>(response: ContractInvocationResponse<T>): TransactionResult<T> {
  return {
    value: response.value,
    ...(response.transactionHash === undefined ? {} : { transactionHash: response.transactionHash }),
    ...(response.ledger === undefined ? {} : { ledger: BigInt(String(response.ledger)) }),
    ...(response.envelopeXdr === undefined ? {} : { envelopeXdr: response.envelopeXdr }),
    ...(response.diagnosticEvents === undefined ? {} : { diagnosticEvents: response.diagnosticEvents }),
  };
}

export function defaultRetryable(error: unknown, _attempt: number, _plan: TransactionPlan): boolean {
  if (error instanceof StellarisError) {
    return error.kind === "transport";
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("timeout") || message.includes("rate") || message.includes("temporar");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
