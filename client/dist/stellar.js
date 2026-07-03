/**
 * High-level Stellaris contract client.
 *
 * This module composes codec + transport + domain types. It does not contain
 * UI or demo mocks. Integrators can supply a real SorobanTransport backed by
 * @stellar/stellar-sdk, a server signer, or a test harness.
 */
import { assertBundleV2Consistency, assertBundleV3Consistency, bundleToContractArgs, decodeAttestation, decodeAttestationV2, decodeAttestationV3, } from "./codec.js";
import { StellarisError } from "./errors.js";
import { UnconfiguredSorobanTransport } from "./transport.js";
export var ContractErrorCode;
(function (ContractErrorCode) {
    ContractErrorCode[ContractErrorCode["NotInitialized"] = 1] = "NotInitialized";
    ContractErrorCode[ContractErrorCode["AlreadyInitialized"] = 2] = "AlreadyInitialized";
    ContractErrorCode[ContractErrorCode["Unauthorized"] = 3] = "Unauthorized";
    ContractErrorCode[ContractErrorCode["ProofInvalid"] = 4] = "ProofInvalid";
    ContractErrorCode[ContractErrorCode["NotSolvent"] = 5] = "NotSolvent";
    ContractErrorCode[ContractErrorCode["PeriodAlreadyAttested"] = 6] = "PeriodAlreadyAttested";
    ContractErrorCode[ContractErrorCode["BadPublicSignals"] = 7] = "BadPublicSignals";
    ContractErrorCode[ContractErrorCode["BadProofEncoding"] = 8] = "BadProofEncoding";
    ContractErrorCode[ContractErrorCode["BadLiabilityRoot"] = 9] = "BadLiabilityRoot";
    ContractErrorCode[ContractErrorCode["WrongVerifierVersion"] = 10] = "WrongVerifierVersion";
    ContractErrorCode[ContractErrorCode["OracleMismatch"] = 11] = "OracleMismatch";
    ContractErrorCode[ContractErrorCode["OracleNotConfigured"] = 12] = "OracleNotConfigured";
    ContractErrorCode[ContractErrorCode["CustodianNotConfigured"] = 13] = "CustodianNotConfigured";
    ContractErrorCode[ContractErrorCode["CustodianSigInvalid"] = 14] = "CustodianSigInvalid";
})(ContractErrorCode || (ContractErrorCode = {}));
const ERROR_MESSAGES = {
    [ContractErrorCode.NotInitialized]: "Contract not initialized",
    [ContractErrorCode.AlreadyInitialized]: "Contract already initialized",
    [ContractErrorCode.Unauthorized]: "Issuer authorization missing",
    [ContractErrorCode.ProofInvalid]: "Groth16 proof verification failed",
    [ContractErrorCode.NotSolvent]: "Issuer is not solvent",
    [ContractErrorCode.PeriodAlreadyAttested]: "Period already attested",
    [ContractErrorCode.BadPublicSignals]: "Bad public signals",
    [ContractErrorCode.BadProofEncoding]: "Bad proof encoding",
    [ContractErrorCode.BadLiabilityRoot]: "Bad liability root",
    [ContractErrorCode.WrongVerifierVersion]: "Unsupported verifier backend version",
    [ContractErrorCode.OracleMismatch]: "Price commitment does not match the published oracle commitment",
    [ContractErrorCode.OracleNotConfigured]: "No designated price oracle configured",
    [ContractErrorCode.CustodianNotConfigured]: "No designated custodian configured",
    [ContractErrorCode.CustodianSigInvalid]: "Custodian BLS signature verification failed",
};
export class ContractError extends Error {
    code;
    constructor(code) {
        super(`[ContractError(${code})] ${ERROR_MESSAGES[code] ?? "Unknown contract error"}`);
        this.name = "ContractError";
        this.code = code;
    }
}
export class StellarisClient {
    deployment;
    transport;
    constructor(options) {
        this.deployment = options.deployment;
        this.transport = options.transport ?? new UnconfiguredSorobanTransport();
    }
    async init(params) {
        this.assertSigner(params.admin, params.signer);
        const plan = this.plan("init", [params.admin, params.verificationKey]);
        await this.transport.invoke(plan, params.signer);
    }
    async attest(params) {
        this.assertSigner(params.issuer, params.signer);
        // Validate bundle consistency (commitment vs. public signals) before submit.
        // This throws on a malformed bundle without mutating anything.
        bundleToContractArgs(params.bundle);
        // Pass the raw snarkjs proof object + decimal public signals. The transport's
        // contract codec serializes them to the on-chain byte layout through the
        // single shared SDK encoder (encoding.ts). The decimal `{a,b,c}` tuple from
        // bundleToContractArgs is a display/inspection shape only — not submitted.
        const plan = this.plan("attest", [
            params.issuer,
            params.bundle.proof,
            [...params.bundle.publicSignals],
        ]);
        const result = await this.transport.invoke(plan, params.signer);
        const attestation = decodeAttestation(result.value);
        return {
            attestation,
            networkPassphrase: this.deployment.networkPassphrase,
            contractId: this.deployment.contractId,
            ...(result.transactionHash === undefined ? {} : { transactionHash: result.transactionHash }),
            ...(result.ledger === undefined ? {} : { ledger: result.ledger }),
        };
    }
    async getAttestation(issuer, periodId) {
        const plan = this.plan("get_attestation", [issuer, periodId.toString()]);
        const value = await this.transport.simulate(plan);
        return value === null ? null : decodeAttestation(value);
    }
    /**
     * v2 attest: solvency with a SNARK-proven liability total. The proof bundle's
     * public signals carry the circuit-computed `liabRoot`/`liabTotal`; the
     * contract codec serializes the raw snarkjs proof via the shared encoder.
     */
    async attestV2(params) {
        this.assertSigner(params.issuer, params.signer);
        assertBundleV2Consistency(params.bundle);
        const plan = this.plan("attest_v2", [
            params.issuer,
            params.bundle.proof,
            [...params.bundle.publicSignals],
        ]);
        const result = await this.transport.invoke(plan, params.signer);
        const attestation = decodeAttestationV2(result.value);
        return {
            attestation,
            networkPassphrase: this.deployment.networkPassphrase,
            contractId: this.deployment.contractId,
            ...(result.transactionHash === undefined ? {} : { transactionHash: result.transactionHash }),
            ...(result.ledger === undefined ? {} : { ledger: result.ledger }),
        };
    }
    async getAttestationV2(issuer, periodId) {
        const plan = this.plan("get_attestation_v2", [issuer, periodId.toString()]);
        const value = await this.transport.simulate(plan);
        return value === null ? null : decodeAttestationV2(value);
    }
    /**
     * v3 attest: multi-asset solvency with an oracle-priced aggregate. The proof
     * bundle's public signals carry the per-asset solvency flags + the aggregate
     * flag + the reserve/price commitments; the contract requires the AGGREGATE to
     * be solvent and stores the per-asset breakdown for transparency.
     */
    async attestV3(params) {
        this.assertSigner(params.issuer, params.signer);
        assertBundleV3Consistency(params.bundle);
        const plan = this.plan("attest_v3", [
            params.issuer,
            params.bundle.proof,
            [...params.bundle.publicSignals],
        ]);
        const result = await this.transport.invoke(plan, params.signer);
        const attestation = decodeAttestationV3(result.value);
        return {
            attestation,
            networkPassphrase: this.deployment.networkPassphrase,
            contractId: this.deployment.contractId,
            ...(result.transactionHash === undefined ? {} : { transactionHash: result.transactionHash }),
            ...(result.ledger === undefined ? {} : { ledger: result.ledger }),
        };
    }
    async getAttestationV3(issuer, periodId) {
        const plan = this.plan("get_attestation_v3", [issuer, periodId.toString()]);
        const value = await this.transport.simulate(plan);
        return value === null ? null : decodeAttestationV3(value);
    }
    async listPeriods(issuer) {
        const plan = this.plan("list_periods", [issuer]);
        const value = await this.transport.simulate(plan);
        return value.map((period) => BigInt(String(period)));
    }
    async getVerificationKey() {
        const plan = this.plan("get_vk", []);
        return this.transport.simulate(plan);
    }
    async getAdmin() {
        const plan = this.plan("get_admin", []);
        const value = await this.transport.simulate(plan);
        return value === null ? null : String(value);
    }
    // --- C3: designated price-oracle + per-period commitment binding ---------
    /**
     * Designate the price-oracle authority (admin-gated on-chain). `admin` must be
     * the contract admin and must sign.
     */
    async setOracle(params) {
        this.assertSigner(params.admin, params.signer);
        const plan = this.plan("set_oracle", [params.oracle]);
        await this.transport.invoke(plan, params.signer);
    }
    /**
     * Publish the authoritative price commitment for a period (oracle-gated
     * on-chain). `oracle` must be the designated oracle and must sign. A later
     * `attestV3` for the same period must present a matching `priceCommitment` or
     * be rejected with `OracleMismatch`.
     */
    async publishOracleCommitment(params) {
        this.assertSigner(params.oracle, params.signer);
        const plan = this.plan("publish_oracle_commitment", [
            params.periodId.toString(),
            params.commitment,
        ]);
        await this.transport.invoke(plan, params.signer);
    }
    async getOracle() {
        const plan = this.plan("get_oracle", []);
        const value = await this.transport.simulate(plan);
        return value === null ? null : String(value);
    }
    async getOracleCommitment(periodId) {
        const plan = this.plan("get_oracle_commitment", [periodId.toString()]);
        const value = await this.transport.simulate(plan);
        return value === null || value === undefined ? null : String(value);
    }
    // --- C2: designated custodian + BLS-signed reserve attestation -----------
    /**
     * Designate the custodian BLS12-381 public key (G2), admin-gated on-chain.
     * `pk` is the serialized G2 point (the transport/codec encodes it); `admin`
     * must be the contract admin and must sign.
     */
    async setCustodian(params) {
        this.assertSigner(params.admin, params.signer);
        const plan = this.plan("set_custodian", [params.custodianPublicKey]);
        await this.transport.invoke(plan, params.signer);
    }
    /**
     * Attest multi-asset solvency WITH a custodian BLS signature over the
     * reserveCommitment. Like `attestV3` but additionally requires (and the
     * contract verifies on-chain) a real BLS12-381 signature from the designated
     * custodian; on success the attestation is stamped `custodianBound=true`.
     * `custodianSig` is the serialized G1 signature point.
     */
    async attestV3Signed(params) {
        this.assertSigner(params.issuer, params.signer);
        assertBundleV3Consistency(params.bundle);
        const plan = this.plan("attest_v3_signed", [
            params.issuer,
            params.bundle.proof,
            [...params.bundle.publicSignals],
            params.custodianSig,
        ]);
        const result = await this.transport.invoke(plan, params.signer);
        const attestation = decodeAttestationV3(result.value);
        return {
            attestation,
            networkPassphrase: this.deployment.networkPassphrase,
            contractId: this.deployment.contractId,
            ...(result.transactionHash === undefined ? {} : { transactionHash: result.transactionHash }),
            ...(result.ledger === undefined ? {} : { ledger: result.ledger }),
        };
    }
    async getCustodian() {
        const plan = this.plan("get_custodian", []);
        const value = await this.transport.simulate(plan);
        return value === null || value === undefined ? null : String(value);
    }
    plan(operation, args) {
        return {
            operation,
            contractId: this.deployment.contractId,
            args,
            deployment: this.deployment,
        };
    }
    assertSigner(expectedPublicKey, signer) {
        if (signer.publicKey !== expectedPublicKey) {
            throw StellarisError.validation("signer public key does not match requested account", {
                expectedPublicKey,
                signerPublicKey: signer.publicKey,
            });
        }
    }
}
export function createStellarisClient(options) {
    return new StellarisClient(options);
}
