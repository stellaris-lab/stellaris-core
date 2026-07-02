/**
 * Typed registry/indexer events.
 *
 * Backend consumers should subscribe to stable events instead of reaching into
 * reconciler internals. This mirrors mature SDK event surfaces: typed payloads,
 * bounded replay, and composable sinks.
 */
import { PublicKey } from "./domain.js";
import { RegistryDiagnostics, RegistrySnapshot } from "./registry.js";
import { ReconciliationFailure, ReconciliationResult } from "./reconciler.js";
export type RegistryEventKind = "reconciler.started" | "issuer.refresh.started" | "issuer.refresh.succeeded" | "issuer.refresh.failed" | "checkpoint.written" | "reconciler.completed";
export type RegistryEvent = ReconcilerStartedEvent | IssuerRefreshStartedEvent | IssuerRefreshSucceededEvent | IssuerRefreshFailedEvent | CheckpointWrittenEvent | ReconcilerCompletedEvent;
export interface RegistryEventBase<Kind extends RegistryEventKind> {
    readonly kind: Kind;
    readonly id: string;
    readonly runId: string;
    readonly at: string;
}
export interface ReconcilerStartedEvent extends RegistryEventBase<"reconciler.started"> {
    readonly targetCount: number;
}
export interface IssuerRefreshStartedEvent extends RegistryEventBase<"issuer.refresh.started"> {
    readonly issuer: PublicKey;
    readonly attempt: number;
}
export interface IssuerRefreshSucceededEvent extends RegistryEventBase<"issuer.refresh.succeeded"> {
    readonly issuer: PublicKey;
    readonly attempt: number;
    readonly periodCount: number;
    readonly diagnostics: RegistryDiagnostics;
}
export interface IssuerRefreshFailedEvent extends RegistryEventBase<"issuer.refresh.failed"> {
    readonly issuer: PublicKey;
    readonly failure: ReconciliationFailure;
}
export interface CheckpointWrittenEvent extends RegistryEventBase<"checkpoint.written"> {
    readonly issuerCount: number;
    readonly recordCount: number;
}
export interface ReconcilerCompletedEvent extends RegistryEventBase<"reconciler.completed"> {
    readonly status: ReconciliationResult["status"];
    readonly attempts: number;
    readonly snapshots: number;
    readonly failures: number;
}
export interface RegistryEventSink {
    emit(event: RegistryEvent): void | Promise<void>;
}
export interface RegistryEventSubscription {
    unsubscribe(): void;
}
export type RegistryEventHandler = (event: RegistryEvent) => void | Promise<void>;
/** Distributive Omit so each union member keeps its own discriminated fields. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export declare class InMemoryRegistryEventLog implements RegistryEventSink {
    private readonly events;
    emit(event: RegistryEvent): void;
    replay(handler: RegistryEventHandler, filter?: Partial<{
        readonly kind: RegistryEventKind;
        readonly runId: string;
    }>): void;
    snapshot(): readonly RegistryEvent[];
    clear(): void;
}
export declare class RegistryEventBus implements RegistryEventSink {
    private readonly handlers;
    private readonly replayLog?;
    constructor(input?: {
        readonly replayLog?: InMemoryRegistryEventLog;
    });
    subscribe(handler: RegistryEventHandler): RegistryEventSubscription;
    emit(event: RegistryEvent): Promise<void>;
}
export declare function makeRegistryEvent(input: DistributiveOmit<RegistryEvent, "id" | "at"> & {
    readonly at?: string;
}): RegistryEvent;
export declare function snapshotToRefreshEvent(runId: string, snapshot: RegistrySnapshot, attempt: number): IssuerRefreshSucceededEvent;
export {};
