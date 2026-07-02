/**
 * End-to-end attestation pipeline.
 *
 * This is the orchestration layer an exchange/backend service would use: it
 * normalizes a snapshot, evaluates issuer policy, generates a local proof,
 * optionally verifies it locally, and submits the attestation on-chain.
 */
import { StellarisClient } from "./stellar.js";
import { AuditSink, AttestationAuditLog } from "./audit.js";
import { AttestationReceipt, ProofBundle, ProvingArtifacts, ReserveSnapshot } from "./domain.js";
import { PolicyReport, SnapshotPolicy } from "./policy.js";
import { TransactionSigner } from "./transport.js";
export interface AttestationPipelineOptions {
    readonly client: StellarisClient;
    readonly artifacts: ProvingArtifacts;
    readonly signer: TransactionSigner;
    readonly policy?: SnapshotPolicy;
    readonly auditSink?: AuditSink;
    readonly requireLocalVerification?: boolean;
}
export interface AttestationPipelineResult {
    readonly proof: ProofBundle;
    readonly policyReport: PolicyReport;
    readonly receipt: AttestationReceipt;
    readonly auditLog: AttestationAuditLog;
}
export declare class AttestationPipeline {
    private readonly client;
    private readonly artifacts;
    private readonly signer;
    private readonly policy?;
    private readonly auditSink;
    private readonly requireLocalVerification;
    constructor(options: AttestationPipelineOptions);
    run(snapshot: ReserveSnapshot): Promise<AttestationPipelineResult>;
}
export declare function createAttestationPipeline(options: AttestationPipelineOptions): AttestationPipeline;
