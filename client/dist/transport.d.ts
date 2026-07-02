/** Transport abstractions for Soroban RPC and generated bindings. */
import { ContractDeployment, PublicKey } from "./domain.js";
import { ContractOperation } from "./operations.js";
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
export declare class BindingSorobanTransport implements SorobanTransport {
    private readonly invoker;
    private readonly maxAttempts;
    private readonly baseDelayMs;
    private readonly retryable;
    constructor(options: RetryingTransportOptions);
    invoke<T>(plan: TransactionPlan, signer?: TransactionSigner): Promise<TransactionResult<T>>;
    simulate<T>(plan: TransactionPlan): Promise<T>;
    private validatePlan;
    private toRequest;
    private withRetry;
}
export declare class UnconfiguredSorobanTransport implements SorobanTransport {
    invoke<T>(plan: TransactionPlan, _signer?: TransactionSigner): Promise<TransactionResult<T>>;
    simulate<T>(plan: TransactionPlan): Promise<T>;
}
export declare function normalizeTransactionResult<T>(response: ContractInvocationResponse<T>): TransactionResult<T>;
export declare function defaultRetryable(error: unknown, _attempt: number, _plan: TransactionPlan): boolean;
