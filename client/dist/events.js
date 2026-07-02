/**
 * Typed registry/indexer events.
 *
 * Backend consumers should subscribe to stable events instead of reaching into
 * reconciler internals. This mirrors mature SDK event surfaces: typed payloads,
 * bounded replay, and composable sinks.
 */
export class InMemoryRegistryEventLog {
    events = [];
    emit(event) {
        this.events.push(event);
    }
    replay(handler, filter) {
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
    snapshot() {
        return [...this.events];
    }
    clear() {
        this.events.length = 0;
    }
}
export class RegistryEventBus {
    handlers = new Set();
    replayLog;
    constructor(input = {}) {
        if (input.replayLog !== undefined) {
            this.replayLog = input.replayLog;
        }
    }
    subscribe(handler) {
        this.handlers.add(handler);
        return {
            unsubscribe: () => {
                this.handlers.delete(handler);
            },
        };
    }
    async emit(event) {
        this.replayLog?.emit(event);
        await Promise.all([...this.handlers].map((handler) => handler(event)));
    }
}
export function makeRegistryEvent(input) {
    const at = input.at ?? new Date().toISOString();
    const id = `${input.runId}:${input.kind}:${at}`;
    return { ...input, id, at };
}
export function snapshotToRefreshEvent(runId, snapshot, attempt) {
    return makeRegistryEvent({
        kind: "issuer.refresh.succeeded",
        runId,
        issuer: snapshot.issuer,
        attempt,
        periodCount: snapshot.periods.length,
        diagnostics: snapshot.diagnostics,
    });
}
