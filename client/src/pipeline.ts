/**
 * End-to-end attestation pipeline.
 *
 * This is the orchestration layer an exchange/backend service would use: it
 * normalizes a snapshot, evaluates issuer policy, generates a local proof,
 * optionally verifies it locally, and submits the attestation on-chain.
 */

import { StellarisClient } from "./stellar.js";
import { AuditSink, AttestationAuditLog, InMemoryAuditSink, makeAuditLog, makeAuditStep, makeWorkflowId } from "./audit.js";
import {
  AttestationReceipt,
  ProofBundle,
  ProvingArtifacts,
  ReserveSnapshot,
  normalizeSnapshot,
} from "./domain.js";
import { StellarisError } from "./errors.js";
import { evaluateSnapshotPolicy, PolicyReport, SnapshotPolicy } from "./policy.js";
import { generateProofFromSnapshot, verifyLocal } from "./prove.js";
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

export class AttestationPipeline {
  private readonly client: StellarisClient;
  private readonly artifacts: ProvingArtifacts;
  private readonly signer: TransactionSigner;
  private readonly policy?: SnapshotPolicy;
  private readonly auditSink: AuditSink;
  private readonly requireLocalVerification: boolean;

  constructor(options: AttestationPipelineOptions) {
    this.client = options.client;
    this.artifacts = options.artifacts;
    this.signer = options.signer;
    if (options.policy !== undefined) {
      this.policy = options.policy;
    }
    this.auditSink = options.auditSink ?? new InMemoryAuditSink();
    this.requireLocalVerification = options.requireLocalVerification ?? true;
  }

  async run(snapshot: ReserveSnapshot): Promise<AttestationPipelineResult> {
    const normalized = normalizeSnapshot(snapshot);
    const workflowId = makeWorkflowId(this.signer.publicKey, normalized.periodId);
    const localAudit = new InMemoryAuditSink();
    const record = async (name: string, status: "started" | "accepted" | "rejected" | "failed" | "submitted", context?: Record<string, unknown>) => {
      const step = makeAuditStep(context === undefined ? { name, status } : { name, status, context });
      localAudit.record(step);
      await this.auditSink.record(step);
    };

    await record("snapshot.normalized", "accepted", {
      periodId: normalized.periodId.toString(),
      accountCount: normalized.accounts.length,
    });

    const policyReport = evaluateSnapshotPolicy(normalized, this.policy);
    await record("policy.evaluated", policyReport.accepted ? "accepted" : "rejected", {
      findings: policyReport.findings.map((finding) => finding.code),
      reserveRatioBps: policyReport.reserveRatioBps?.toString() ?? null,
    });

    if (!policyReport.accepted) {
      throw StellarisError.validation("snapshot rejected by policy", { workflowId, policyReport });
    }

    const proof = await generateProofFromSnapshot(normalized, this.artifacts);
    await record("proof.generated", "accepted", {
      solvent: proof.parsed.solvent,
      commitment: proof.parsed.commitment,
    });

    if (!proof.parsed.solvent) {
      await record("proof.solvency", "rejected");
      throw StellarisError.validation("generated proof public signals report insolvency", { workflowId });
    }

    if (this.requireLocalVerification) {
      if (!this.artifacts.verificationKey) {
        await record("proof.local_verification", "failed", { reason: "missing_verification_key" });
        throw StellarisError.configuration("local verification requires a verification key", { context: { workflowId } });
      }
      const verified = await verifyLocal(this.artifacts.verificationKey, proof);
      await record("proof.local_verification", verified ? "accepted" : "rejected");
      if (!verified) {
        throw StellarisError.verification("local proof verification failed", { context: { workflowId } });
      }
    }

    const receipt = await this.client.attest({ issuer: this.signer.publicKey, bundle: proof, signer: this.signer });
    await record("contract.attest", "submitted", {
      transactionHash: receipt.transactionHash,
      ledger: receipt.ledger?.toString(),
    });

    return {
      proof,
      policyReport,
      receipt,
      auditLog: makeAuditLog({
        workflowId,
        issuer: this.signer.publicKey,
        periodId: normalized.periodId,
        deployment: this.client.deployment,
        steps: localAudit.snapshot(),
        publicSignals: proof.parsed,
        policyReport,
        receipt,
      }),
    };
  }
}

export function createAttestationPipeline(options: AttestationPipelineOptions): AttestationPipeline {
  return new AttestationPipeline(options);
}
