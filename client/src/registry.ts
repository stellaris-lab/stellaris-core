/**
 * Attestation registry/indexing layer.
 *
 * Protocol SDKs usually expose a state-oriented subsystem in addition to direct
 * RPC calls. This module reconciles contract state into a local store, detects
 * period gaps/replays, and gives backend services a stable query surface without
 * introducing frontend/demo code.
 */

import { Attestation, ContractDeployment, PeriodId, PublicKey } from "./domain.js";
import { StellarisError } from "./errors.js";
import { StellarisClient } from "./stellar.js";

export interface IndexedAttestation {
  readonly attestation: Attestation;
  readonly deployment: ContractDeployment;
  readonly indexedAt: string;
  readonly source: "contract" | "receipt" | "manual";
}

export interface RegistrySnapshot {
  readonly issuer: PublicKey;
  readonly deployment: ContractDeployment;
  readonly indexedAt: string;
  readonly periods: readonly PeriodId[];
  readonly attestations: readonly IndexedAttestation[];
  readonly diagnostics: RegistryDiagnostics;
}

export interface RegistryDiagnostics {
  readonly duplicatePeriods: readonly PeriodId[];
  readonly missingPeriods: readonly PeriodGap[];
  readonly nonSolventPeriods: readonly PeriodId[];
  readonly newestPeriod: PeriodId | null;
  readonly oldestPeriod: PeriodId | null;
}

export interface PeriodGap {
  readonly after: PeriodId;
  readonly before: PeriodId;
  readonly missing: readonly PeriodId[];
}

export interface AttestationStore {
  put(record: IndexedAttestation): Promise<void> | void;
  get(issuer: PublicKey, periodId: PeriodId): Promise<IndexedAttestation | null> | IndexedAttestation | null;
  list(issuer: PublicKey): Promise<readonly IndexedAttestation[]> | readonly IndexedAttestation[];
  clear?(issuer?: PublicKey): Promise<void> | void;
}

export interface RegistryRefreshOptions {
  readonly source?: IndexedAttestation["source"];
  readonly failOnMissingAttestation?: boolean;
}

export class InMemoryAttestationStore implements AttestationStore {
  private readonly records = new Map<string, IndexedAttestation>();

  put(record: IndexedAttestation): void {
    this.records.set(keyOf(record.attestation.issuer, record.attestation.periodId), record);
  }

  get(issuer: PublicKey, periodId: PeriodId): IndexedAttestation | null {
    return this.records.get(keyOf(issuer, periodId)) ?? null;
  }

  list(issuer: PublicKey): readonly IndexedAttestation[] {
    return [...this.records.values()]
      .filter((record) => record.attestation.issuer === issuer)
      .sort((a, b) => comparePeriod(a.attestation.periodId, b.attestation.periodId));
  }

  clear(issuer?: PublicKey): void {
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
  private readonly client: StellarisClient;
  private readonly store: AttestationStore;

  constructor(input: { readonly client: StellarisClient; readonly store?: AttestationStore }) {
    this.client = input.client;
    this.store = input.store ?? new InMemoryAttestationStore();
  }

  async put(record: IndexedAttestation): Promise<void> {
    validateIndexedAttestation(record, this.client.deployment);
    await this.store.put(record);
  }

  async get(issuer: PublicKey, periodId: PeriodId): Promise<IndexedAttestation | null> {
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

  async refreshIssuer(issuer: PublicKey, options: RegistryRefreshOptions = {}): Promise<RegistrySnapshot> {
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

  async snapshot(issuer: PublicKey): Promise<RegistrySnapshot> {
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

export function indexAttestation(
  attestation: Attestation,
  deployment: ContractDeployment,
  source: IndexedAttestation["source"] = "manual",
): IndexedAttestation {
  return {
    attestation,
    deployment,
    source,
    indexedAt: new Date().toISOString(),
  };
}

export function analyzeRegistry(records: readonly IndexedAttestation[]): RegistryDiagnostics {
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

export function findPeriodGaps(periods: readonly PeriodId[]): readonly PeriodGap[] {
  const sorted = dedupeAndSort(periods);
  const gaps: PeriodGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous === undefined || current === undefined || current <= previous + 1n) {
      continue;
    }
    const missing: PeriodId[] = [];
    for (let period = previous + 1n; period < current; period++) {
      missing.push(period);
    }
    gaps.push({ after: previous, before: current, missing });
  }
  return gaps;
}

export function findDuplicatePeriods(periods: readonly PeriodId[]): readonly PeriodId[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const period of periods) {
    const key = period.toString();
    if (seen.has(key)) {
      duplicated.add(key);
    }
    seen.add(key);
  }
  return [...duplicated].map((period) => BigInt(period)).sort(comparePeriod);
}

export function dedupeAndSort(periods: readonly PeriodId[]): readonly PeriodId[] {
  return [...new Set(periods.map((period) => period.toString()))]
    .map((period) => BigInt(period))
    .sort(comparePeriod);
}

export function comparePeriod(a: PeriodId, b: PeriodId): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function validateIndexedAttestation(record: IndexedAttestation, deployment: ContractDeployment): void {
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

function keyOf(issuer: PublicKey, periodId: PeriodId): string {
  return `${issuer}:${periodId}`;
}
