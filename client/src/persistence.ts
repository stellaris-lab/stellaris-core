/**
 * Registry persistence and checkpointing.
 *
 * BigInt-heavy protocol state is not JSON-safe by default. This module defines a
 * deterministic wire format and a file-backed checkpoint store for backend/indexer
 * processes while keeping the core registry storage interface pluggable.
 */

import { Attestation, ContractDeployment, PeriodId, PublicKey } from "./domain.js";
import { StellarisError } from "./errors.js";
import {
  AttestationStore,
  IndexedAttestation,
  InMemoryAttestationStore,
  RegistrySnapshot,
  indexAttestation,
} from "./registry.js";

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

export class JsonCheckpointCodec implements CheckpointCodec {
  encode(snapshot: RegistrySnapshot): RegistryCheckpoint {
    return {
      schemaVersion: "stellaris.registry.checkpoint.v1",
      deployment: snapshot.deployment,
      writtenAt: new Date().toISOString(),
      records: snapshot.attestations.map(serializeIndexedAttestation),
    };
  }

  decode(checkpoint: RegistryCheckpoint): readonly IndexedAttestation[] {
    assertCheckpointShape(checkpoint);
    return checkpoint.records.map(deserializeIndexedAttestation);
  }
}

export class CheckpointBackedAttestationStore implements AttestationStore {
  private readonly inner: InMemoryAttestationStore;

  constructor(records: readonly IndexedAttestation[] = []) {
    this.inner = new InMemoryAttestationStore();
    for (const record of records) {
      this.inner.put(record);
    }
  }

  put(record: IndexedAttestation): void {
    this.inner.put(record);
  }

  get(issuer: PublicKey, periodId: PeriodId): IndexedAttestation | null {
    return this.inner.get(issuer, periodId);
  }

  list(issuer: PublicKey): readonly IndexedAttestation[] {
    return this.inner.list(issuer);
  }

  clear(issuer?: PublicKey): void {
    this.inner.clear(issuer);
  }

  exportRecords(issuer: PublicKey): readonly IndexedAttestation[] {
    return this.inner.list(issuer);
  }
}

export interface FileCheckpointOptions {
  readonly path: string;
  readonly codec?: CheckpointCodec;
}

export class FileCheckpointRepository {
  private readonly path: string;
  private readonly codec: CheckpointCodec;

  constructor(options: FileCheckpointOptions) {
    this.path = options.path;
    this.codec = options.codec ?? new JsonCheckpointCodec();
  }

  async load(): Promise<readonly IndexedAttestation[]> {
    const fs = await import("node:fs/promises");
    try {
      const raw = await fs.readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as RegistryCheckpoint;
      return this.codec.decode(parsed);
    } catch (cause) {
      if (isNodeNotFound(cause)) {
        return [];
      }
      throw StellarisError.configuration("failed to load registry checkpoint", {
        cause,
        context: { path: this.path },
      });
    }
  }

  async save(snapshot: RegistrySnapshot): Promise<void> {
    await this.saveCheckpoint(this.codec.encode(snapshot));
  }

  async saveRecords(deployment: ContractDeployment, records: readonly IndexedAttestation[]): Promise<void> {
    await this.saveCheckpoint(checkpointFromRecords(deployment, records));
  }

  async createStore(): Promise<CheckpointBackedAttestationStore> {
    return new CheckpointBackedAttestationStore(await this.load());
  }

  private async saveCheckpoint(checkpoint: RegistryCheckpoint): Promise<void> {
    const fs = await import("node:fs/promises");
    const body = `${JSON.stringify(checkpoint, null, 2)}\n`;
    await fs.mkdir(parentDir(this.path), { recursive: true });
    await fs.writeFile(this.path, body, "utf8");
  }
}

export function serializeIndexedAttestation(record: IndexedAttestation): SerializedIndexedAttestation {
  return {
    attestation: serializeAttestation(record.attestation),
    deployment: record.deployment,
    indexedAt: record.indexedAt,
    source: record.source,
  };
}

export function deserializeIndexedAttestation(record: SerializedIndexedAttestation): IndexedAttestation {
  return {
    attestation: deserializeAttestation(record.attestation),
    deployment: record.deployment,
    indexedAt: record.indexedAt,
    source: record.source,
  };
}

export function serializeAttestation(attestation: Attestation): SerializedAttestation {
  return {
    commitment: attestation.commitment,
    liabilities: attestation.liabilities.toString(),
    solvent: attestation.solvent,
    ledgerTs: attestation.ledgerTs.toString(),
    periodId: attestation.periodId.toString(),
    issuer: attestation.issuer,
  };
}

export function deserializeAttestation(attestation: SerializedAttestation): Attestation {
  return {
    commitment: attestation.commitment,
    liabilities: BigInt(attestation.liabilities),
    solvent: attestation.solvent,
    ledgerTs: BigInt(attestation.ledgerTs),
    periodId: BigInt(attestation.periodId),
    issuer: attestation.issuer,
  };
}

export function checkpointFromRecords(
  deployment: ContractDeployment,
  records: readonly IndexedAttestation[],
): RegistryCheckpoint {
  return {
    schemaVersion: "stellaris.registry.checkpoint.v1",
    deployment,
    writtenAt: new Date().toISOString(),
    records: records.map(serializeIndexedAttestation),
  };
}

export function recordsFromCheckpoint(checkpoint: RegistryCheckpoint): readonly IndexedAttestation[] {
  return new JsonCheckpointCodec().decode(checkpoint);
}

export function indexReceiptLikeAttestation(
  attestation: Attestation,
  deployment: ContractDeployment,
): IndexedAttestation {
  return indexAttestation(attestation, deployment, "receipt");
}

function assertCheckpointShape(checkpoint: RegistryCheckpoint): void {
  if (checkpoint.schemaVersion !== "stellaris.registry.checkpoint.v1") {
    throw StellarisError.configuration("unsupported registry checkpoint schema", {
      schemaVersion: checkpoint.schemaVersion,
    });
  }
  if (!Array.isArray(checkpoint.records)) {
    throw StellarisError.configuration("registry checkpoint records must be an array");
  }
}

function isNodeNotFound(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "code" in cause && (cause as { code?: unknown }).code === "ENOENT";
}

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "." : path.slice(0, index);
}
