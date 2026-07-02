/**
 * Groth16 proof generation for Stellaris.
 *
 * This module owns witness construction and local proof verification only. It has
 * no Stellar RPC dependency and no UI/demo behavior.
 */
import { DEFAULT_PROVING_BACKEND } from "./backend.js";
import { MAX_RESERVE, N_RESERVES } from "./constants.js";
import { normalizeSnapshot, toReserveInput, } from "./domain.js";
import { StellarisError } from "./errors.js";
export function validateReserveInput(input) {
    if (input.balances.length === 0) {
        throw StellarisError.validation("balances must include at least one value");
    }
    if (input.balances.length > N_RESERVES) {
        throw StellarisError.validation(`balances length exceeds max ${N_RESERVES}`);
    }
    for (let i = 0; i < input.balances.length; i++) {
        const balance = input.balances[i];
        if (typeof balance !== "bigint" || balance < 0n || balance > MAX_RESERVE) {
            throw StellarisError.validation(`balance ${i} is outside uint64 range`);
        }
    }
    if (input.salt < 0n) {
        throw StellarisError.validation("salt must be non-negative");
    }
    if (input.liabilities < 0n) {
        throw StellarisError.validation("liabilities must be non-negative");
    }
    if (input.periodId < 0n) {
        throw StellarisError.validation("periodId must be non-negative");
    }
}
export function buildWitnessInput(input) {
    validateReserveInput(input);
    const padded = [...input.balances];
    while (padded.length < N_RESERVES) {
        padded.push(0n);
    }
    return {
        r: padded.map((balance) => balance.toString()),
        salt: input.salt.toString(),
        liabilities_in: input.liabilities.toString(),
        period_in: input.periodId.toString(),
    };
}
export async function generateProofFromInput(input, artifacts, backend = DEFAULT_PROVING_BACKEND) {
    const witnessInput = buildWitnessInput(input);
    return backend.prove(witnessInput, artifacts);
}
export async function generateProofFromSnapshot(snapshot, artifacts, backend = DEFAULT_PROVING_BACKEND) {
    const normalized = "accounts" in snapshot && "balances" in snapshot
        ? snapshot
        : normalizeSnapshot(snapshot);
    return generateProofFromInput(toReserveInput(normalized), artifacts, backend);
}
export async function verifyLocal(verificationKey, bundle, backend = DEFAULT_PROVING_BACKEND) {
    return backend.verify(verificationKey, bundle);
}
export function toContractArgs(bundle) {
    const p = bundle.proof;
    if (!p.pi_a || !p.pi_b || !p.pi_c) {
        throw StellarisError.encoding("proof is missing pi_a, pi_b, or pi_c");
    }
    return {
        proof: {
            a: [p.pi_a[0], p.pi_a[1]],
            b: [
                [p.pi_b[0][0], p.pi_b[0][1]],
                [p.pi_b[1][0], p.pi_b[1][1]],
            ],
            c: [p.pi_c[0], p.pi_c[1]],
        },
        pubSignals: [...bundle.publicSignals],
    };
}
