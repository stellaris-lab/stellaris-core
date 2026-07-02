//! Storage accessors.

use soroban_sdk::{crypto::bls12_381::G2Affine, Address, Env, Vec, U256};

use crate::types::{Attestation, AttestationV2, AttestationV3, DataKey, StellarisContractError};
use crate::verifier::Groth16VerificationKey;

pub fn store_vk(env: &Env, vk: &Groth16VerificationKey) {
    env.storage().instance().set(&DataKey::Vk, vk);
}

pub fn load_vk(env: &Env) -> Result<Groth16VerificationKey, StellarisContractError> {
    env.storage()
        .instance()
        .get(&DataKey::Vk)
        .ok_or(StellarisContractError::NotInitialized)
}

pub fn get_vk(env: &Env) -> Option<Groth16VerificationKey> {
    env.storage().instance().get(&DataKey::Vk)
}

pub fn has_attestation(env: &Env, issuer: &Address, period_id: u64) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::Attest(issuer.clone(), period_id))
}

pub fn store_attestation(env: &Env, attestation: &Attestation) {
    let key = DataKey::Attest(attestation.issuer.clone(), attestation.period_id);
    env.storage().instance().set(&key, attestation);
}

pub fn load_attestation(env: &Env, issuer: Address, period_id: u64) -> Option<Attestation> {
    env.storage()
        .instance()
        .get(&DataKey::Attest(issuer, period_id))
}

pub fn append_period(env: &Env, issuer: &Address, period_id: u64) {
    let key = DataKey::Periods(issuer.clone());
    let mut periods: Vec<u64> = env
        .storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    periods.push_back(period_id);
    env.storage().instance().set(&key, &periods);
}

pub fn list_periods(env: &Env, issuer: Address) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&DataKey::Periods(issuer))
        .unwrap_or_else(|| Vec::new(env))
}

// --- v2: parallel VK + attestation namespace -------------------------------

pub fn store_vk_v2(env: &Env, vk: &Groth16VerificationKey) {
    env.storage().instance().set(&DataKey::VkV2, vk);
}

pub fn load_vk_v2(env: &Env) -> Result<Groth16VerificationKey, StellarisContractError> {
    env.storage()
        .instance()
        .get(&DataKey::VkV2)
        .ok_or(StellarisContractError::NotInitialized)
}

pub fn get_vk_v2(env: &Env) -> Option<Groth16VerificationKey> {
    env.storage().instance().get(&DataKey::VkV2)
}

pub fn has_attestation_v2(env: &Env, issuer: &Address, period_id: u64) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::AttestV2(issuer.clone(), period_id))
}

pub fn store_attestation_v2(env: &Env, attestation: &AttestationV2) {
    let key = DataKey::AttestV2(attestation.issuer.clone(), attestation.period_id);
    env.storage().instance().set(&key, attestation);
}

pub fn load_attestation_v2(env: &Env, issuer: Address, period_id: u64) -> Option<AttestationV2> {
    env.storage()
        .instance()
        .get(&DataKey::AttestV2(issuer, period_id))
}

// --- v3: multi-asset VK + attestation namespace ----------------------------

pub fn store_vk_v3(env: &Env, vk: &Groth16VerificationKey) {
    env.storage().instance().set(&DataKey::VkV3, vk);
}

pub fn load_vk_v3(env: &Env) -> Result<Groth16VerificationKey, StellarisContractError> {
    env.storage()
        .instance()
        .get(&DataKey::VkV3)
        .ok_or(StellarisContractError::NotInitialized)
}

pub fn get_vk_v3(env: &Env) -> Option<Groth16VerificationKey> {
    env.storage().instance().get(&DataKey::VkV3)
}

pub fn has_attestation_v3(env: &Env, issuer: &Address, period_id: u64) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::AttestV3(issuer.clone(), period_id))
}

pub fn store_attestation_v3(env: &Env, attestation: &AttestationV3) {
    let key = DataKey::AttestV3(attestation.issuer.clone(), attestation.period_id);
    env.storage().instance().set(&key, attestation);
}

pub fn load_attestation_v3(env: &Env, issuer: Address, period_id: u64) -> Option<AttestationV3> {
    env.storage()
        .instance()
        .get(&DataKey::AttestV3(issuer, period_id))
}

// --- C3: designated price-oracle authority + per-period published commitments -

pub fn store_oracle(env: &Env, oracle: &Address) {
    env.storage().instance().set(&DataKey::Oracle, oracle);
}

pub fn get_oracle(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Oracle)
}

pub fn store_oracle_commitment(env: &Env, period_id: u64, commitment: &U256) {
    env.storage()
        .instance()
        .set(&DataKey::OracleCommitment(period_id), commitment);
}

pub fn load_oracle_commitment(env: &Env, period_id: u64) -> Option<U256> {
    env.storage()
        .instance()
        .get(&DataKey::OracleCommitment(period_id))
}

// --- C2: designated custodian BLS public key (G2) ---------------------------

pub fn store_custodian(env: &Env, pk: &G2Affine) {
    env.storage().instance().set(&DataKey::Custodian, pk);
}

pub fn load_custodian(env: &Env) -> Option<G2Affine> {
    env.storage().instance().get(&DataKey::Custodian)
}
