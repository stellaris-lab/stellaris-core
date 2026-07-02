/**
 * Attestation registry/indexing layer.
 *
 * Protocol SDKs usually expose a state-oriented subsystem in addition to direct
 * RPC calls. This module reconciles contract state into a local store, detects
 * period gaps/replays, and gives backend services a stable query surface without
 * introducing frontend/demo code.
 */
import { StellarisError } from "./errors.js";
export class InMemoryAttestationStore {
    records = new Map();
    put(record) {
        this.records.set(keyOf(record.attestation.issuer, record.attestation.periodId), record);
    }
    get(issuer, periodId) {
        return this.records.get(keyOf(issuer, periodId)) ?? null;
    }
    list(issuer) {
        return [...this.records.values()]
            .filter((record) => record.attestation.issuer === issuer)
            .sort((a, b) => comparePeriod(a.attestation.periodId, b.attestation.periodId));
    }
    clear(issuer) {
        if (issuer === undefined) {
            this.records.clear();
            return;
        }
        for (const key of [...this.records.keys()]) {
            if (key.startsWith(`${issuer}:`)) {
                this.records.delete(key);
            }
        }
    }
}
export class AttestationRegistry {
    client;
    store;
    constructor(input) {
        this.client = input.client;
        this.store = input.store ?? new InMemoryAttestationStore();
    }
    async put(record) {
        validateIndexedAttestation(record, this.client.deployment);
        await this.store.put(record);
    }
    async get(issuer, periodId) {
        const cached = await this.store.get(issuer, periodId);
        if (cached) {
            return cached;
        }
        const attestation = await this.client.getAttestation(issuer, periodId);
        if (!attestation) {
            return null;
        }
        const record = indexAttestation(attestation, this.client.deployment, "contract");
        await this.store.put(record);
        return record;
    }
    async refreshIssuer(issuer, options = {}) {
        const periods = dedupeAndSort(await this.client.listPeriods(issuer));
        const source = options.source ?? "contract";
        for (const periodId of periods) {
            const attestation = await this.client.getAttestation(issuer, periodId);
            if (!attestation) {
                if (options.failOnMissingAttestation ?? true) {
                    throw StellarisError.contract("contract listed period without attestation", {
                        issuer,
                        periodId: periodId.toString(),
                    });
                }
                continue;
            }
            await this.store.put(indexAttestation(attestation, this.client.deployment, source));
        }
        return this.snapshot(issuer);
    }
    async snapshot(issuer) {
        const attestations = await this.store.list(issuer);
        const periods = attestations.map((record) => record.attestation.periodId);
        return {
            issuer,
            deployment: this.client.deployment,
            indexedAt: new Date().toISOString(),
            periods,
            attestations,
            diagnostics: analyzeRegistry(attestations),
        };
    }
}
export function indexAttestation(attestation, deployment, source = "manual") {
    return {
        attestation,
        deployment,
        source,
        indexedAt: new Date().toISOString(),
    };
}
export function analyzeRegistry(records) {
    const periods = records.map((record) => record.attestation.periodId).sort(comparePeriod);
    const duplicatePeriods = findDuplicatePeriods(periods);
    const missingPeriods = findPeriodGaps(dedupeAndSort(periods));
    const nonSolventPeriods = records
        .filter((record) => !record.attestation.solvent)
        .map((record) => record.attestation.periodId)
        .sort(comparePeriod);
    return {
        duplicatePeriods,
        missingPeriods,
        nonSolventPeriods,
        newestPeriod: periods.length === 0 ? null : periods[periods.length - 1] ?? null,
        oldestPeriod: periods.length === 0 ? null : periods[0] ?? null,
    };
}
export function findPeriodGaps(periods) {
    const sorted = dedupeAndSort(periods);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
        const previous = sorted[i - 1];
        const current = sorted[i];
        if (previous === undefined || current === undefined || current <= previous + 1n) {
            continue;
        }
        const missing = [];
        for (let period = previous + 1n; period < current; period++) {
            missing.push(period);
        }
        gaps.push({ after: previous, before: current, missing });
    }
    return gaps;
}
export function findDuplicatePeriods(periods) {
    const seen = new Set();
    const duplicated = new Set();
    for (const period of periods) {
        const key = period.toString();
        if (seen.has(key)) {
            duplicated.add(key);
        }
        seen.add(key);
    }
    return [...duplicated].map((period) => BigInt(period)).sort(comparePeriod);
}
export function dedupeAndSort(periods) {
    return [...new Set(periods.map((period) => period.toString()))]
        .map((period) => BigInt(period))
        .sort(comparePeriod);
}
export function comparePeriod(a, b) {
    return a === b ? 0 : a < b ? -1 : 1;
}
function validateIndexedAttestation(record, deployment) {
    if (record.deployment.contractId !== deployment.contractId) {
        throw StellarisError.validation("indexed attestation belongs to a different contract", {
            expected: deployment.contractId,
            actual: record.deployment.contractId,
        });
    }
    if (record.deployment.networkPassphrase !== deployment.networkPassphrase) {
        throw StellarisError.validation("indexed attestation belongs to a different network", {
            expected: deployment.networkPassphrase,
            actual: record.deployment.networkPassphrase,
        });
    }
}
function keyOf(issuer, periodId) {
    return `${issuer}:${periodId}`;
}
