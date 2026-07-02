/**
 * Contract operation registry.
 *
 * A mature SDK keeps the contract ABI in one typed registry and derives client,
 * transport, audit, and generated-binding adapters from it. This file is the
 * source of truth for supported contract calls on the TypeScript side.
 */
import { StellarisError } from "./errors.js";
export const CONTRACT_OPERATIONS = {
    init: {
        mutability: "write",
        auth: "admin",
    },
    attest: {
        mutability: "write",
        auth: "issuer",
    },
    get_attestation: {
        mutability: "read",
        auth: "none",
    },
    list_periods: {
        mutability: "read",
        auth: "none",
    },
    get_vk: {
        mutability: "read",
        auth: "none",
    },
    get_admin: {
        mutability: "read",
        auth: "none",
    },
    // v2: solvency with SNARK-proven liabilities (5-signal statement).
    init_v2: {
        mutability: "write",
        auth: "admin",
    },
    attest_v2: {
        mutability: "write",
        auth: "issuer",
    },
    get_attestation_v2: {
        mutability: "read",
        auth: "none",
    },
    get_vk_v2: {
        mutability: "read",
        auth: "none",
    },
    // v3: multi-asset solvency with oracle-priced aggregate (8-signal statement).
    init_v3: {
        mutability: "write",
        auth: "admin",
    },
    attest_v3: {
        mutability: "write",
        auth: "issuer",
    },
    get_attestation_v3: {
        mutability: "read",
        auth: "none",
    },
    get_vk_v3: {
        mutability: "read",
        auth: "none",
    },
    // C3: designated price-oracle + per-period published commitments.
    set_oracle: {
        mutability: "write",
        auth: "admin",
    },
    publish_oracle_commitment: {
        mutability: "write",
        auth: "oracle",
    },
    get_oracle: {
        mutability: "read",
        auth: "none",
    },
    get_oracle_commitment: {
        mutability: "read",
        auth: "none",
    },
    // C2: designated custodian + BLS-signed reserve attestation.
    set_custodian: {
        mutability: "write",
        auth: "admin",
    },
    attest_v3_signed: {
        mutability: "write",
        auth: "issuer",
    },
    get_custodian: {
        mutability: "read",
        auth: "none",
    },
};
export function getOperationSpec(name) {
    const spec = CONTRACT_OPERATIONS[name];
    return {
        name,
        mutability: spec.mutability,
        auth: spec.auth,
    };
}
export function isReadOperation(name) {
    return CONTRACT_OPERATIONS[name].mutability === "read";
}
export function assertOperationArgs(name, args) {
    const expected = expectedArgCount(name);
    if (args.length !== expected) {
        throw StellarisError.encoding(`operation ${name} expects ${expected} args, received ${args.length}`, {
            operation: name,
            expected,
            actual: args.length,
        });
    }
}
export function expectedArgCount(name) {
    switch (name) {
        case "init":
            return 2;
        case "attest":
            return 3;
        case "get_attestation":
            return 2;
        case "list_periods":
            return 1;
        case "get_vk":
        case "get_admin":
            return 0;
        case "init_v2":
            return 1;
        case "attest_v2":
            return 3;
        case "get_attestation_v2":
            return 2;
        case "get_vk_v2":
            return 0;
        case "init_v3":
            return 1;
        case "attest_v3":
            return 3;
        case "get_attestation_v3":
            return 2;
        case "get_vk_v3":
            return 0;
        case "set_oracle":
            return 1;
        case "publish_oracle_commitment":
            return 2;
        case "get_oracle":
            return 0;
        case "get_oracle_commitment":
            return 1;
        case "set_custodian":
            return 1;
        case "attest_v3_signed":
            return 4;
        case "get_custodian":
            return 0;
    }
}
