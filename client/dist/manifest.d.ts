/**
 * Artifact and deployment manifest.
 *
 * Frontends, CLIs, backend services, and tests should consume a manifest rather
 * than hardcoding wasm/zkey/contract IDs throughout the app.
 */
import { ContractDeployment, ProvingArtifacts, VerificationKeyDocument } from "./domain.js";
export interface StellarisManifest {
    readonly schemaVersion: "stellaris.manifest.v1";
    readonly circuit: {
        readonly name: "proof-of-reserves";
        readonly curve: "bls12381";
        readonly nReserves: number;
        readonly nPublicSignals: number;
        readonly publicSignalOrder: readonly ["solvent", "commitment", "liabilities", "period_id"];
    };
    readonly artifacts: ProvingArtifacts;
    readonly deployment?: ContractDeployment;
}
export declare function createManifest(input: Omit<StellarisManifest, "schemaVersion">): StellarisManifest;
export declare function validateManifest(manifest: StellarisManifest): void;
export declare function assertVerificationKeyShape(vk: VerificationKeyDocument): void;
