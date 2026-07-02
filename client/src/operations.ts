/**
 * Contract operation registry.
 *
 * A mature SDK keeps the contract ABI in one typed registry and derives client,
 * transport, audit, and generated-binding adapters from it. This file is the
 * source of truth for supported contract calls on the TypeScript side.
 */

import { ContractAttestArgs } from "./codec.js";
import { Attestation, AttestationV2, AttestationV3, PublicKey, VerificationKeyDocument } from "./domain.js";
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
} as const;

export type ContractOperation = keyof typeof CONTRACT_OPERATIONS;
export type OperationMutability = typeof CONTRACT_OPERATIONS[ContractOperation]["mutability"];
export type OperationAuth = typeof CONTRACT_OPERATIONS[ContractOperation]["auth"];

export interface OperationSpec<Name extends ContractOperation = ContractOperation> {
  readonly name: Name;
  readonly mutability: OperationMutability;
  readonly auth: OperationAuth;
}

export type OperationArgs<Name extends ContractOperation> =
  Name extends "init" ? readonly [admin: PublicKey, verificationKey: VerificationKeyDocument] :
  Name extends "attest" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[]] :
  Name extends "get_attestation" ? readonly [issuer: PublicKey, periodId: string] :
  Name extends "list_periods" ? readonly [issuer: PublicKey] :
  Name extends "get_vk" ? readonly [] :
  Name extends "get_admin" ? readonly [] :
  Name extends "init_v2" ? readonly [verificationKey: VerificationKeyDocument] :
  Name extends "attest_v2" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[]] :
  Name extends "get_attestation_v2" ? readonly [issuer: PublicKey, periodId: string] :
  Name extends "get_vk_v2" ? readonly [] :
  Name extends "init_v3" ? readonly [verificationKey: VerificationKeyDocument] :
  Name extends "attest_v3" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[]] :
  Name extends "get_attestation_v3" ? readonly [issuer: PublicKey, periodId: string] :
  Name extends "get_vk_v3" ? readonly [] :
  Name extends "set_oracle" ? readonly [oracle: PublicKey] :
  Name extends "publish_oracle_commitment" ? readonly [periodId: string, commitment: string] :
  Name extends "get_oracle" ? readonly [] :
  Name extends "get_oracle_commitment" ? readonly [periodId: string] :
  Name extends "set_custodian" ? readonly [custodianPk: unknown] :
  Name extends "attest_v3_signed" ? readonly [issuer: PublicKey, proof: ContractAttestArgs["proof"], publicSignals: readonly string[], custodianSig: unknown] :
  Name extends "get_custodian" ? readonly [] :
  never;

export type OperationResult<Name extends ContractOperation> =
  Name extends "init" ? void :
  Name extends "attest" ? Attestation :
  Name extends "get_attestation" ? Attestation | null :
  Name extends "list_periods" ? readonly bigint[] :
  Name extends "get_vk" ? VerificationKeyDocument | null :
  Name extends "get_admin" ? PublicKey | null :
  Name extends "init_v2" ? void :
  Name extends "attest_v2" ? AttestationV2 :
  Name extends "get_attestation_v2" ? AttestationV2 | null :
  Name extends "get_vk_v2" ? VerificationKeyDocument | null :
  Name extends "init_v3" ? void :
  Name extends "attest_v3" ? AttestationV3 :
  Name extends "get_attestation_v3" ? AttestationV3 | null :
  Name extends "get_vk_v3" ? VerificationKeyDocument | null :
  Name extends "set_oracle" ? void :
  Name extends "publish_oracle_commitment" ? void :
  Name extends "get_oracle" ? PublicKey | null :
  Name extends "get_oracle_commitment" ? string | null :
  Name extends "set_custodian" ? void :
  Name extends "attest_v3_signed" ? AttestationV3 :
  Name extends "get_custodian" ? string | null :
  never;

export function getOperationSpec<Name extends ContractOperation>(name: Name): OperationSpec<Name> {
  const spec = CONTRACT_OPERATIONS[name];
  return {
    name,
    mutability: spec.mutability,
    auth: spec.auth,
  };
}

export function isReadOperation(name: ContractOperation): boolean {
  return CONTRACT_OPERATIONS[name].mutability === "read";
}

export function assertOperationArgs(name: ContractOperation, args: readonly unknown[]): void {
  const expected = expectedArgCount(name);
  if (args.length !== expected) {
    throw StellarisError.encoding(`operation ${name} expects ${expected} args, received ${args.length}`, {
      operation: name,
      expected,
      actual: args.length,
    });
  }
}

export function expectedArgCount(name: ContractOperation): number {
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
