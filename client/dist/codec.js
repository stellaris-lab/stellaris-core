/**
 * Encoding boundary for contract arguments.
 *
 * Keep all low-level proof/public-signal encoding in one module. When Stellar SDK
 * exposes first-class BLS12-381 XDR helpers, only this file should change.
 */
import { proofToBytes, signalToBytes, } from "./encoding.js";
import { StellarisError } from "./errors.js";
import { parsePublicSignals, parsePublicSignalsV2, parsePublicSignalsV3 } from "./signals.js";
export function proofToContractArgs(proof) {
    if (!Array.isArray(proof.pi_a) || !Array.isArray(proof.pi_b) || !Array.isArray(proof.pi_c)) {
        throw StellarisError.encoding("invalid snarkjs proof shape");
    }
    const a0 = requiredDecimal(proof.pi_a[0], "proof.pi_a[0]");
    const a1 = requiredDecimal(proof.pi_a[1], "proof.pi_a[1]");
    const c0 = requiredDecimal(proof.pi_c[0], "proof.pi_c[0]");
    const c1 = requiredDecimal(proof.pi_c[1], "proof.pi_c[1]");
    const bx = proof.pi_b[0];
    const by = proof.pi_b[1];
    if (!Array.isArray(bx) || !Array.isArray(by)) {
        throw StellarisError.encoding("proof pi_b must be [[x.c0,x.c1],[y.c0,y.c1]]");
    }
    return {
        a: [a0, a1],
        b: [
            [requiredDecimal(bx[0], "proof.pi_b[0][0]"), requiredDecimal(bx[1], "proof.pi_b[0][1]")],
            [requiredDecimal(by[0], "proof.pi_b[1][0]"), requiredDecimal(by[1], "proof.pi_b[1][1]")],
        ],
        c: [c0, c1],
    };
}
export function bundleToContractArgs(bundle) {
    const parsed = parsePublicSignals(bundle.publicSignals);
    if (parsed.commitment !== bundle.parsed.commitment) {
        throw StellarisError.encoding("bundle parsed commitment differs from raw public signals");
    }
    return {
        proof: proofToContractArgs(bundle.proof),
        publicSignals: [...bundle.publicSignals],
    };
}
/**
 * Serialize a proof bundle to the byte-exact `attest` arguments the on-chain
 * verifier consumes. This is the production encoding path: G1 points -> 96-byte
 * uncompressed buffers, G2 -> 192-byte (with the c1||c0 Fp2 ordering), and each
 * public signal -> a 32-byte big-endian U256 buffer. A transport only needs to
 * wrap these in ScVal (ScBytes / ScU256) — no field math at the transport layer.
 */
export function bundleToContractBytes(bundle) {
    const parsed = parsePublicSignals(bundle.publicSignals);
    if (parsed.commitment !== bundle.parsed.commitment) {
        throw StellarisError.encoding("bundle parsed commitment differs from raw public signals");
    }
    return {
        proof: proofToBytes(bundle.proof),
        publicSignals: bundle.publicSignals.map((s) => signalToBytes(s)),
    };
}
export function assertBundleV2Consistency(bundle) {
    const parsed = parsePublicSignalsV2(bundle.publicSignals);
    if (parsed.reserveCommitment !== bundle.parsed.reserveCommitment ||
        parsed.liabRoot !== bundle.parsed.liabRoot ||
        parsed.liabTotal !== bundle.parsed.liabTotal ||
        parsed.periodId !== bundle.parsed.periodId ||
        parsed.solvent !== bundle.parsed.solvent) {
        throw StellarisError.encoding("v2 bundle parsed values differ from raw public signals");
    }
    proofToBytes(bundle.proof);
}
export function assertBundleV3Consistency(bundle) {
    const parsed = parsePublicSignalsV3(bundle.publicSignals);
    if (parsed.aggregateSolvent !== bundle.parsed.aggregateSolvent ||
        parsed.reserveCommitment !== bundle.parsed.reserveCommitment ||
        parsed.priceCommitment !== bundle.parsed.priceCommitment ||
        parsed.periodId !== bundle.parsed.periodId ||
        parsed.assetSolvent.length !== bundle.parsed.assetSolvent.length ||
        parsed.assetSolvent.some((flag, index) => flag !== bundle.parsed.assetSolvent[index])) {
        throw StellarisError.encoding("v3 bundle parsed values differ from raw public signals");
    }
    proofToBytes(bundle.proof);
}
export function decodeAttestation(raw) {
    if (!raw || typeof raw !== "object") {
        throw StellarisError.encoding("attestation response is not an object");
    }
    const value = raw;
    return {
        commitment: requiredString(value.commitment, "commitment"),
        liabilities: requiredBigInt(value.liabilities, "liabilities"),
        solvent: decodeBoolean(value.solvent, "solvent"),
        ledgerTs: optionalBigInt(value.ledgerTs ?? value.ledger_ts, "ledgerTs", 0n),
        periodId: requiredBigInt(value.periodId ?? value.period_id, "periodId"),
        issuer: requiredString(value.issuer, "issuer"),
    };
}
/**
 * Decode a v2 attestation (solvency with SNARK-proven liabilities). `liabRoot`
 * is a full-width field element (a hash) kept as a string; `liabTotal` is the
 * proven total liabilities.
 */
export function decodeAttestationV2(raw) {
    if (!raw || typeof raw !== "object") {
        throw StellarisError.encoding("v2 attestation response is not an object");
    }
    const value = raw;
    return {
        reserveCommitment: requiredString(value.reserveCommitment ?? value.reserve_commitment, "reserveCommitment"),
        liabRoot: requiredString(value.liabRoot ?? value.liab_root, "liabRoot"),
        liabTotal: requiredBigInt(value.liabTotal ?? value.liab_total, "liabTotal"),
        solvent: decodeBoolean(value.solvent, "solvent"),
        ledgerTs: optionalBigInt(value.ledgerTs ?? value.ledger_ts, "ledgerTs", 0n),
        periodId: requiredBigInt(value.periodId ?? value.period_id, "periodId"),
        issuer: requiredString(value.issuer, "issuer"),
    };
}
/**
 * Decode a v3 multi-asset attestation. `assetSolvent` is the per-asset flag
 * vector (Soroban returns it as an array of bools); `reserveCommitment` and
 * `priceCommitment` are full-width field elements kept as strings.
 */
export function decodeAttestationV3(raw) {
    if (!raw || typeof raw !== "object") {
        throw StellarisError.encoding("v3 attestation response is not an object");
    }
    const value = raw;
    const rawFlags = value.assetSolvent ?? value.asset_solvent ?? [];
    if (!Array.isArray(rawFlags)) {
        throw StellarisError.encoding("v3 assetSolvent is not an array");
    }
    const assetSolvent = rawFlags.map((flag, index) => decodeBoolean(flag, `assetSolvent[${index}]`));
    return {
        aggregateSolvent: decodeBoolean(value.aggregateSolvent ?? value.aggregate_solvent, "aggregateSolvent"),
        reserveCommitment: requiredString(value.reserveCommitment ?? value.reserve_commitment, "reserveCommitment"),
        priceCommitment: requiredString(value.priceCommitment ?? value.price_commitment, "priceCommitment"),
        assetSolvent,
        oracleBound: decodeBoolean(value.oracleBound ?? value.oracle_bound, "oracleBound"),
        custodianBound: decodeBoolean(value.custodianBound ?? value.custodian_bound, "custodianBound"),
        ledgerTs: optionalBigInt(value.ledgerTs ?? value.ledger_ts, "ledgerTs", 0n),
        periodId: requiredBigInt(value.periodId ?? value.period_id, "periodId"),
        issuer: requiredString(value.issuer, "issuer"),
    };
}
function decodeBoolean(value, label) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        if (value === "true" || value === "1")
            return true;
        if (value === "false" || value === "0")
            return false;
    }
    if (typeof value === "number") {
        if (value === 1)
            return true;
        if (value === 0)
            return false;
    }
    throw StellarisError.encoding(`${label} must be a boolean-like value`, { value });
}
function requiredString(value, label) {
    if (typeof value !== "string" || value.length === 0) {
        throw StellarisError.encoding(`${label} must be a non-empty string`, { value });
    }
    return value;
}
function requiredDecimal(value, label) {
    const decimal = requiredString(value, label);
    if (!/^(0|[1-9][0-9]*)$/.test(decimal)) {
        throw StellarisError.encoding(`${label} must be a canonical decimal string`, { value });
    }
    return decimal;
}
function requiredBigInt(value, label) {
    const decimal = requiredDecimal(value, label);
    return BigInt(decimal);
}
function optionalBigInt(value, label, fallback) {
    return value === undefined || value === null ? fallback : requiredBigInt(value, label);
}
