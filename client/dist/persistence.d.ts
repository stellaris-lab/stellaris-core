/**
 * Registry persistence and checkpointing.
 *
 * BigInt-heavy protocol state is not JSON-safe by default. This module defines a
 * deterministic wire format and a file-backed checkpoint store for backend/indexer
 * processes while keeping the core registry storage interface pluggable.
 */
import { Attestation, ContractDeployment, PeriodId, PublicKey } from "./domain.js";
import { AttestationStore, IndexedAttestation, RegistrySnapshot } from "./registry.js";
export interface SerializedAttestation {
    readonly commitment: string;
    readonly liabilities: string;
    readonly solvent: boolean;
    readonly ledgerTs: string;
    readonly periodId: string;
    readonly issuer: PublicKey;
}
export interface SerializedIndexedAttestation {
    readonly attestation: SerializedAttestation;
    readonly deployment: ContractDeployment;
    readonly indexedAt: string;
    readonly source: IndexedAttestation["source"];
}
export interface RegistryCheckpoint {
    readonly schemaVersion: "stellaris.registry.checkpoint.v1";
    readonly deployment: ContractDeployment;
    readonly writtenAt: string;
    readonly records: readonly SerializedIndexedAttestation[];
}
export interface CheckpointCodec {
    encode(snapshot: RegistrySnapshot): RegistryCheckpoint;
    decode(checkpoint: RegistryCheckpoint): readonly IndexedAttestation[];
}
export declare class JsonCheckpointCodec implements CheckpointCodec {
    encode(snapshot: RegistrySnapshot): RegistryCheckpoint;
    decode(checkpoint: RegistryCheckpoint): readonly IndexedAttestation[];
}
export declare class CheckpointBackedAttestationStore implements AttestationStore {
    private readonly inner;
    constructor(records?: readonly IndexedAttestation[]);
    put(record: IndexedAttestation): void;
    get(issuer: PublicKey, periodId: PeriodId): IndexedAttestation | null;
    list(issuer: PublicKey): readonly IndexedAttestation[];
    clear(issuer?: PublicKey): void;
    exportRecords(issuer: PublicKey): readonly IndexedAttestation[];
}
export interface FileCheckpointOptions {
    readonly path: string;
    readonly codec?: CheckpointCodec;
}
export declare class FileCheckpointRepository {
    private readonly path;
    private readonly codec;
    constructor(options: FileCheckpointOptions);
    load(): Promise<readonly IndexedAttestation[]>;
    save(snapshot: RegistrySnapshot): Promise<void>;
    saveRecords(deployment: ContractDeployment, records: readonly IndexedAttestation[]): Promise<void>;
    createStore(): Promise<CheckpointBackedAttestationStore>;
    private saveCheckpoint;
}
export declare function serializeIndexedAttestation(record: IndexedAttestation): SerializedIndexedAttestation;
export declare function deserializeIndexedAttestation(record: SerializedIndexedAttestation): IndexedAttestation;
export declare function serializeAttestation(attestation: Attestation): SerializedAttestation;
export declare function deserializeAttestation(attestation: SerializedAttestation): Attestation;
export declare function checkpointFromRecords(deployment: ContractDeployment, records: readonly IndexedAttestation[]): RegistryCheckpoint;
export declare function recordsFromCheckpoint(checkpoint: RegistryCheckpoint): readonly IndexedAttestation[];
export declare function indexReceiptLikeAttestation(attestation: Attestation, deployment: ContractDeployment): IndexedAttestation;
