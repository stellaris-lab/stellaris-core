/**
 * Attestation registry/indexing layer.
 *
 * Protocol SDKs usually expose a state-oriented subsystem in addition to direct
 * RPC calls. This module reconciles contract state into a local store, detects
 * period gaps/replays, and gives backend services a stable query surface without
 * introducing frontend/demo code.
 */
import { Attestation, ContractDeployment, PeriodId, PublicKey } from "./domain.js";
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
export declare class InMemoryAttestationStore implements AttestationStore {
    private readonly records;
    put(record: IndexedAttestation): void;
    get(issuer: PublicKey, periodId: PeriodId): IndexedAttestation | null;
    list(issuer: PublicKey): readonly IndexedAttestation[];
    clear(issuer?: PublicKey): void;
}
export declare class AttestationRegistry {
    private readonly client;
    private readonly store;
    constructor(input: {
        readonly client: StellarisClient;
        readonly store?: AttestationStore;
    });
    put(record: IndexedAttestation): Promise<void>;
    get(issuer: PublicKey, periodId: PeriodId): Promise<IndexedAttestation | null>;
    refreshIssuer(issuer: PublicKey, options?: RegistryRefreshOptions): Promise<RegistrySnapshot>;
    snapshot(issuer: PublicKey): Promise<RegistrySnapshot>;
}
export declare function indexAttestation(attestation: Attestation, deployment: ContractDeployment, source?: IndexedAttestation["source"]): IndexedAttestation;
export declare function analyzeRegistry(records: readonly IndexedAttestation[]): RegistryDiagnostics;
export declare function findPeriodGaps(periods: readonly PeriodId[]): readonly PeriodGap[];
export declare function findDuplicatePeriods(periods: readonly PeriodId[]): readonly PeriodId[];
export declare function dedupeAndSort(periods: readonly PeriodId[]): readonly PeriodId[];
export declare function comparePeriod(a: PeriodId, b: PeriodId): number;
