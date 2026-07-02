/**
 * Registry persistence and checkpointing.
 *
 * BigInt-heavy protocol state is not JSON-safe by default. This module defines a
 * deterministic wire format and a file-backed checkpoint store for backend/indexer
 * processes while keeping the core registry storage interface pluggable.
 */
import { StellarisError } from "./errors.js";
import { InMemoryAttestationStore, indexAttestation, } from "./registry.js";
export class JsonCheckpointCodec {
    encode(snapshot) {
        return {
            schemaVersion: "stellaris.registry.checkpoint.v1",
            deployment: snapshot.deployment,
            writtenAt: new Date().toISOString(),
            records: snapshot.attestations.map(serializeIndexedAttestation),
        };
    }
    decode(checkpoint) {
        assertCheckpointShape(checkpoint);
        return checkpoint.records.map(deserializeIndexedAttestation);
    }
}
export class CheckpointBackedAttestationStore {
    inner;
    constructor(records = []) {
        this.inner = new InMemoryAttestationStore();
        for (const record of records) {
            this.inner.put(record);
        }
    }
    put(record) {
        this.inner.put(record);
    }
    get(issuer, periodId) {
        return this.inner.get(issuer, periodId);
    }
    list(issuer) {
        return this.inner.list(issuer);
    }
    clear(issuer) {
        this.inner.clear(issuer);
    }
    exportRecords(issuer) {
        return this.inner.list(issuer);
    }
}
export class FileCheckpointRepository {
    path;
    codec;
    constructor(options) {
        this.path = options.path;
        this.codec = options.codec ?? new JsonCheckpointCodec();
    }
    async load() {
        const fs = await import("node:fs/promises");
        try {
            const raw = await fs.readFile(this.path, "utf8");
            const parsed = JSON.parse(raw);
            return this.codec.decode(parsed);
        }
        catch (cause) {
            if (isNodeNotFound(cause)) {
                return [];
            }
            throw StellarisError.configuration("failed to load registry checkpoint", {
                cause,
                context: { path: this.path },
            });
        }
    }
    async save(snapshot) {
        await this.saveCheckpoint(this.codec.encode(snapshot));
    }
    async saveRecords(deployment, records) {
        await this.saveCheckpoint(checkpointFromRecords(deployment, records));
    }
    async createStore() {
        return new CheckpointBackedAttestationStore(await this.load());
    }
    async saveCheckpoint(checkpoint) {
        const fs = await import("node:fs/promises");
        const body = `${JSON.stringify(checkpoint, null, 2)}\n`;
        await fs.mkdir(parentDir(this.path), { recursive: true });
        await fs.writeFile(this.path, body, "utf8");
    }
}
export function serializeIndexedAttestation(record) {
    return {
        attestation: serializeAttestation(record.attestation),
        deployment: record.deployment,
        indexedAt: record.indexedAt,
        source: record.source,
    };
}
export function deserializeIndexedAttestation(record) {
    return {
        attestation: deserializeAttestation(record.attestation),
        deployment: record.deployment,
        indexedAt: record.indexedAt,
        source: record.source,
    };
}
export function serializeAttestation(attestation) {
    return {
        commitment: attestation.commitment,
        liabilities: attestation.liabilities.toString(),
        solvent: attestation.solvent,
        ledgerTs: attestation.ledgerTs.toString(),
        periodId: attestation.periodId.toString(),
        issuer: attestation.issuer,
    };
}
export function deserializeAttestation(attestation) {
    return {
        commitment: attestation.commitment,
        liabilities: BigInt(attestation.liabilities),
        solvent: attestation.solvent,
        ledgerTs: BigInt(attestation.ledgerTs),
        periodId: BigInt(attestation.periodId),
        issuer: attestation.issuer,
    };
}
export function checkpointFromRecords(deployment, records) {
    return {
        schemaVersion: "stellaris.registry.checkpoint.v1",
        deployment,
        writtenAt: new Date().toISOString(),
        records: records.map(serializeIndexedAttestation),
    };
}
export function recordsFromCheckpoint(checkpoint) {
    return new JsonCheckpointCodec().decode(checkpoint);
}
export function indexReceiptLikeAttestation(attestation, deployment) {
    return indexAttestation(attestation, deployment, "receipt");
}
function assertCheckpointShape(checkpoint) {
    if (checkpoint.schemaVersion !== "stellaris.registry.checkpoint.v1") {
        throw StellarisError.configuration("unsupported registry checkpoint schema", {
            schemaVersion: checkpoint.schemaVersion,
        });
    }
    if (!Array.isArray(checkpoint.records)) {
        throw StellarisError.configuration("registry checkpoint records must be an array");
    }
}
function isNodeNotFound(cause) {
    return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";
}
function parentDir(path) {
    const index = path.lastIndexOf("/");
    return index <= 0 ? "." : path.slice(0, index);
}
