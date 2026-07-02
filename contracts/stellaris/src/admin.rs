//! Admin helpers.

use soroban_sdk::{Address, Env};

use crate::types::{DataKey, StellarisContractError};

pub fn initialize_once(env: &Env, admin: &Address) -> Result<(), StellarisContractError> {
    if env.storage().instance().has(&DataKey::Admin) {
        return Err(StellarisContractError::AlreadyInitialized);
    }
    env.storage().instance().set(&DataKey::Admin, admin);
    Ok(())
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn require_issuer_auth(issuer: &Address) {
    issuer.require_auth();
}
