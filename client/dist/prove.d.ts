/**
 * Groth16 proof generation for Stellaris.
 *
 * This module owns witness construction and local proof verification only. It has
 * no Stellar RPC dependency and no UI/demo behavior.
 */
import { ProvingBackend, WitnessInput } from "./backend.js";
import { NormalizedReserveSnapshot, ProofBundle, ProvingArtifacts, ReserveSnapshot } from "./domain.js";
export interface ReserveInput {
    readonly balances: readonly bigint[];
    readonly salt: bigint;
    readonly liabilities: bigint;
    readonly periodId: bigint;
}
export declare function validateReserveInput(input: ReserveInput): void;
export declare function buildWitnessInput(input: ReserveInput): WitnessInput;
export declare function generateProofFromInput(input: ReserveInput, artifacts: ProvingArtifacts, backend?: ProvingBackend): Promise<ProofBundle>;
export declare function generateProofFromSnapshot(snapshot: ReserveSnapshot | NormalizedReserveSnapshot, artifacts: ProvingArtifacts, backend?: ProvingBackend): Promise<ProofBundle>;
export declare function verifyLocal(verificationKey: Record<string, unknown>, bundle: ProofBundle, backend?: ProvingBackend): Promise<boolean>;
export declare function toContractArgs(bundle: ProofBundle): {
    readonly proof: {
        readonly a: readonly [string, string];
        readonly b: readonly [readonly [string, string], readonly [string, string]];
        readonly c: readonly [string, string];
    };
    readonly pubSignals: readonly string[];
};
