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

export type RegistryEventKind =
  | "reconciler.started"
  | "issuer.refresh.started"
  | "issuer.refresh.succeeded"
  | "issuer.refresh.failed"
  | "checkpoint.written"
  | "reconciler.completed";

export type RegistryEvent =
  | ReconcilerStartedEvent
  | IssuerRefreshStartedEvent
  | IssuerRefreshSucceededEvent
  | IssuerRefreshFailedEvent
  | CheckpointWrittenEvent
  | ReconcilerCompletedEvent;

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

export class InMemoryRegistryEventLog implements RegistryEventSink {
  private readonly events: RegistryEvent[] = [];

  emit(event: RegistryEvent): void {
    this.events.push(event);
  }

  replay(handler: RegistryEventHandler, filter?: Partial<{ readonly kind: RegistryEventKind; readonly runId: string }>): void {
    for (const event of this.events) {
      if (filter?.kind !== undefined && event.kind !== filter.kind) {
        continue;
      }
      if (filter?.runId !== undefined && event.runId !== filter.runId) {
        continue;
      }
      void handler(event);
    }
  }

  snapshot(): readonly RegistryEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}

export class RegistryEventBus implements RegistryEventSink {
  private readonly handlers = new Set<RegistryEventHandler>();
  private readonly replayLog?: InMemoryRegistryEventLog;

  constructor(input: { readonly replayLog?: InMemoryRegistryEventLog } = {}) {
    if (input.replayLog !== undefined) {
      this.replayLog = input.replayLog;
    }
  }

  subscribe(handler: RegistryEventHandler): RegistryEventSubscription {
    this.handlers.add(handler);
    return {
      unsubscribe: () => {
        this.handlers.delete(handler);
      },
    };
  }

  async emit(event: RegistryEvent): Promise<void> {
    this.replayLog?.emit(event);
    await Promise.all([...this.handlers].map((handler) => handler(event)));
  }
}

export function makeRegistryEvent(input: DistributiveOmit<RegistryEvent, "id" | "at"> & { readonly at?: string }): RegistryEvent {
  const at = input.at ?? new Date().toISOString();
  const id = `${input.runId}:${input.kind}:${at}`;
  return { ...input, id, at } as RegistryEvent;
}

export function snapshotToRefreshEvent(runId: string, snapshot: RegistrySnapshot, attempt: number): IssuerRefreshSucceededEvent {
  return makeRegistryEvent({
    kind: "issuer.refresh.succeeded",
    runId,
    issuer: snapshot.issuer,
    attempt,
    periodCount: snapshot.periods.length,
    diagnostics: snapshot.diagnostics,
  }) as IssuerRefreshSucceededEvent;
}
