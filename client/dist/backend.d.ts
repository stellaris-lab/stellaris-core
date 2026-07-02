/**
 * backend.ts — swappable proving-backend seam (Milestone D1, SDK side).
 *
 * The contract abstracts verification behind a `VerifierBackend` trait
 * (contracts/stellaris/src/verifier.rs); this is the symmetric SDK abstraction
 * for PROOF GENERATION. `prove.ts` historically hardcoded `snarkjs.groth16`;
 * this interface makes Groth16 ONE implementation, not a baked-in assumption, so
 * a future PLONK / post-quantum backend can plug in without touching the attest
 * pipeline, the public-signal ABI, or the byte-encoding boundary.
 *
 * Design (deliberately minimal — no speculative second backend is shipped):
 *   - `ProvingBackend`   : interface { version, prove(witnessInput, artifacts),
 *                          verify(vk, bundle) }
 *   - `Groth16Backend`   : the real, only implementation (snarkjs groth16)
 *   - `ProvingVersion`   : on-the-wire backend tag, mirrors the contract's
 *                          `VerifierVersion` (Groth16 = 1; 0 is unset/invalid)
 *
 * The proof-shape (`SnarkJsGroth16Proof`) and `ProofBundle` are unchanged: only
 * the call seam is abstracted. Witness construction stays in prove.ts because it
 * is statement-specific (reserve vector), not backend-specific.
 */
import { ProofBundle, ProvingArtifacts } from "./domain.js";
/**
 * On-the-wire backend selector. Mirrors the contract's `VerifierVersion`
 * (verifier.rs): Groth16 is `1`, leaving `0` as an explicit "unset/invalid"
 * sentinel. A manifest or SDK caller can request a specific backend by tag.
 */
export declare enum ProvingVersion {
    Groth16 = 1
}
/** The witness input shape a backend feeds its prover (statement-specific). */
export interface WitnessInput {
    readonly [signal: string]: string | string[];
}
/**
 * A proof-generation/verification backend. Groth16 is the only backend today;
 * a future backend implements this same interface so `generateProofFromInput`
 * and the attest pipeline are backend-agnostic.
 */
export interface ProvingBackend {
    /** The on-the-wire version tag this backend answers to. */
    readonly version: ProvingVersion;
    /** Generate a proof bundle from a witness input + proving artifacts. */
    prove(witnessInput: WitnessInput, artifacts: ProvingArtifacts): Promise<ProofBundle>;
    /** Verify a proof bundle locally against a verification key document. */
    verify(verificationKey: Record<string, unknown>, bundle: ProofBundle): Promise<boolean>;
}
/**
 * The Groth16 backend — the real, only implementation. Wraps snarkjs groth16,
 * the exact code path `prove.ts` used before the seam existed.
 */
export declare class Groth16Backend implements ProvingBackend {
    readonly version = ProvingVersion.Groth16;
    prove(witnessInput: WitnessInput, artifacts: ProvingArtifacts): Promise<ProofBundle>;
    verify(verificationKey: Record<string, unknown>, bundle: ProofBundle): Promise<boolean>;
}
/**
 * Resolve a backend by version tag. Today only Groth16 resolves. Unknown tags
 * throw, mirroring the contract's `WrongVerifierVersion`.
 *
 * SCOPE (honest boundary): a new SDK backend is one more arm here, but that is
 * only the proving half. A different proof shape also needs a contract entrypoint
 * that accepts it (the Soroban `attest*` signatures bind the concrete proof type
 * into XDR) plus its own on-chain verifier — NOT just a `dispatch_verify` arm.
 * This resolver is the SDK-side version-routing seam, not a claim that a new
 * proving system is free.
 */
export declare function backendFor(version: ProvingVersion): ProvingBackend;
/** The default backend the SDK uses when no explicit backend is requested. */
export declare const DEFAULT_PROVING_BACKEND: ProvingBackend;
