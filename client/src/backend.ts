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

import { ProofBundle, ProvingArtifacts, SnarkJsGroth16Proof } from "./domain.js";
import { StellarisError, wrapUnknown } from "./errors.js";
import { assertVerificationKeyShape } from "./manifest.js";
import { parsePublicSignals } from "./signals.js";

/**
 * On-the-wire backend selector. Mirrors the contract's `VerifierVersion`
 * (verifier.rs): Groth16 is `1`, leaving `0` as an explicit "unset/invalid"
 * sentinel. A manifest or SDK caller can request a specific backend by tag.
 */
export enum ProvingVersion {
  Groth16 = 1,
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
export class Groth16Backend implements ProvingBackend {
  readonly version = ProvingVersion.Groth16;

  async prove(
    witnessInput: WitnessInput,
    artifacts: ProvingArtifacts,
  ): Promise<ProofBundle> {
    if (artifacts.verificationKey) {
      assertVerificationKeyShape(artifacts.verificationKey);
    }

    try {
      const snarkjs = await import("snarkjs");
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        witnessInput,
        artifacts.wasmUrl,
        artifacts.zkeyUrl,
      );

      const parsed = parsePublicSignals(publicSignals);
      return {
        proof: proof as SnarkJsGroth16Proof,
        publicSignals,
        parsed,
      };
    } catch (cause) {
      if (cause instanceof StellarisError) {
        throw cause;
      }
      throw wrapUnknown("proving", "failed to generate Groth16 proof", cause);
    }
  }

  async verify(
    verificationKey: Record<string, unknown>,
    bundle: ProofBundle,
  ): Promise<boolean> {
    try {
      const snarkjs = await import("snarkjs");
      return await snarkjs.groth16.verify(
        verificationKey,
        bundle.publicSignals,
        bundle.proof,
      );
    } catch (cause) {
      throw wrapUnknown("verification", "failed to verify proof locally", cause);
    }
  }
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
export function backendFor(version: ProvingVersion): ProvingBackend {
  switch (version) {
    case ProvingVersion.Groth16:
      return new Groth16Backend();
    default:
      throw StellarisError.validation(`unsupported proving backend version: ${version}`);
  }
}

/** The default backend the SDK uses when no explicit backend is requested. */
export const DEFAULT_PROVING_BACKEND: ProvingBackend = new Groth16Backend();
