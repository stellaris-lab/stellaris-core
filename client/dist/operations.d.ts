/**
 * Contract operation registry.
 *
 * A mature SDK keeps the contract ABI in one typed registry and derives client,
 * transport, audit, and generated-binding adapters from it. This file is the
 * source of truth for supported contract calls on the TypeScript side.
 */
import { ContractAttestArgs } from "./codec.js";
import { Attestation, AttestationV2, AttestationV3, PublicKey, VerificationKeyDocument } from "./domain.js";
export declare const CONTRACT_OPERATIONS: {
    readonly init: {
        readonly mutability: "write";
        readonly auth: "admin";
    };
    readonly attest: {
        readonly mutability: "write";
        readonly auth: "issuer";
    };
    readonly get_attestation: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly list_periods: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly get_vk: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly get_admin: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly init_v2: {
        readonly mutability: "write";
        readonly auth: "admin";
    };
    readonly attest_v2: {
        readonly mutability: "write";
        readonly auth: "issuer";
    };
    readonly get_attestation_v2: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly get_vk_v2: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly init_v3: {
        readonly mutability: "write";
        readonly auth: "admin";
    };
    readonly attest_v3: {
        readonly mutability: "write";
        readonly auth: "issuer";
    };
    readonly get_attestation_v3: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly get_vk_v3: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly set_oracle: {
        readonly mutability: "write";
        readonly auth: "admin";
    };
    readonly publish_oracle_commitment: {
        readonly mutability: "write";
        readonly auth: "oracle";
    };
    readonly get_oracle: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly get_oracle_commitment: {
        readonly mutability: "read";
        readonly auth: "none";
    };
    readonly set_custodian: {
        readonly mutability: "write";
        readonly auth: "admin";
    };
    readonly attest_v3_signed: {
        readonly mutability: "write";
        readonly auth: "issuer";
    };
    readonly get_custodian: {
        readonly mutability: "read";
        readonly auth: "none";
    };
};
export type ContractOperation = keyof typeof CONTRACT_OPERATIONS;
export type OperationMutability = typeof CONTRACT_OPERATIONS[ContractOperation]["mutability"];
export type OperationAuth = typeof CONTRACT_OPERATIONS[ContractOperation]["auth"];
export interface OperationSpec<Name extends ContractOperation = ContractOperation> {
    readonly name: Name;
    readonly mutability: OperationMutability;
    readonly auth: OperationAuth;
}
export type OperationArgs<Name extends ContractOperation> = Name extends "init" ? readonly [admin: PublicKey, verificationKey: VerificationKeyDocument] : Name extends "attest" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[]] : Name extends "get_attestation" ? readonly [issuer: PublicKey, periodId: string] : Name extends "list_periods" ? readonly [issuer: PublicKey] : Name extends "get_vk" ? readonly [] : Name extends "get_admin" ? readonly [] : Name extends "init_v2" ? readonly [verificationKey: VerificationKeyDocument] : Name extends "attest_v2" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[]] : Name extends "get_attestation_v2" ? readonly [issuer: PublicKey, periodId: string] : Name extends "get_vk_v2" ? readonly [] : Name extends "init_v3" ? readonly [verificationKey: VerificationKeyDocument] : Name extends "attest_v3" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[]] : Name extends "get_attestation_v3" ? readonly [issuer: PublicKey, periodId: string] : Name extends "get_vk_v3" ? readonly [] : Name extends "set_oracle" ? readonly [oracle: PublicKey] : Name extends "publish_oracle_commitment" ? readonly [periodId: string, commitment: string] : Name extends "get_oracle" ? readonly [] : Name extends "get_oracle_commitment" ? readonly [periodId: string] : Name extends "set_custodian" ? readonly [custodianPk: unknown] : Name extends "attest_v3_signed" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[], custodianSig: unknown] : Name extends "get_custodian" ? readonly [] : never;
export type OperationResult<Name extends ContractOperation> = Name extends "init" ? void : Name extends "attest" ? Attestation : Name extends "get_attestation" ? Attestation | null : Name extends "list_periods" ? readonly bigint[] : Name extends "get_vk" ? VerificationKeyDocument | null : Name extends "get_admin" ? PublicKey | null : Name extends "init_v2" ? void : Name extends "attest_v2" ? AttestationV2 : Name extends "get_attestation_v2" ? AttestationV2 | null : Name extends "get_vk_v2" ? VerificationKeyDocument | null : Name extends "init_v3" ? void : Name extends "attest_v3" ? AttestationV3 : Name extends "get_attestation_v3" ? AttestationV3 | null : Name extends "get_vk_v3" ? VerificationKeyDocument | null : Name extends "set_oracle" ? void : Name extends "publish_oracle_commitment" ? void : Name extends "get_oracle" ? PublicKey | null : Name extends "get_oracle_commitment" ? string | null : Name extends "set_custodian" ? void : Name extends "attest_v3_signed" ? AttestationV3 : Name extends "get_custodian" ? string | null : never;
export declare function getOperationSpec<Name extends ContractOperation>(name: Name): OperationSpec<Name>;
export declare function isReadOperation(name: ContractOperation): boolean;
export declare function assertOperationArgs(name: ContractOperation, args: readonly unknown[]): void;
export declare function expectedArgCount(name: ContractOperation): number;
