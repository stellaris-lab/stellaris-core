/**
 * Artifact and deployment manifest.
 *
 * Frontends, CLIs, backend services, and tests should consume a manifest rather
 * than hardcoding wasm/zkey/contract IDs throughout the app.
 */
import { StellarisError } from "./errors.js";
export function createManifest(input) {
    const manifest = {
        schemaVersion: "stellaris.manifest.v1",
        ...input,
    };
    validateManifest(manifest);
    return manifest;
}
export function validateManifest(manifest) {
    if (manifest.schemaVersion !== "stellaris.manifest.v1") {
        throw StellarisError.configuration("unsupported manifest schema", { schemaVersion: manifest.schemaVersion });
    }
    if (manifest.circuit.curve !== "bls12381") {
        throw StellarisError.configuration("Stellaris circuit must use BLS12-381", { curve: manifest.circuit.curve });
    }
    if (manifest.circuit.nPublicSignals !== 4) {
        throw StellarisError.configuration("Stellaris circuit must expose exactly 4 public signals");
    }
    const expected = ["solvent", "commitment", "liabilities", "period_id"];
    for (let i = 0; i < expected.length; i++) {
        if (manifest.circuit.publicSignalOrder[i] !== expected[i]) {
            throw StellarisError.configuration("public signal order mismatch", {
                expected,
                actual: manifest.circuit.publicSignalOrder,
            });
        }
    }
    if (!manifest.artifacts.wasmUrl || !manifest.artifacts.zkeyUrl) {
        throw StellarisError.configuration("manifest must include wasmUrl and zkeyUrl");
    }
}
export function assertVerificationKeyShape(vk) {
    if (vk.curve && vk.curve !== "bls12381") {
        throw StellarisError.configuration("verification key curve mismatch", { curve: vk.curve });
    }
    if (vk.protocol && vk.protocol !== "groth16") {
        throw StellarisError.configuration("verification key protocol mismatch", { protocol: vk.protocol });
    }
    if (vk.nPublic !== undefined && vk.nPublic !== 4) {
        throw StellarisError.configuration("verification key public signal count mismatch", { nPublic: vk.nPublic });
    }
    if (!Array.isArray(vk.IC) || vk.IC.length !== 5) {
        throw StellarisError.configuration("verification key IC length must be public signals + 1", {
            icLength: Array.isArray(vk.IC) ? vk.IC.length : "missing",
        });
    }
}
