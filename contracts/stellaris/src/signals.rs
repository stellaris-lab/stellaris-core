//! Public signal parsing and validation.

use soroban_sdk::{crypto::bls12_381::Fr, Env, Vec, U256};

use crate::types::{
    ParsedSignals, ParsedSignalsV2, ParsedSignalsV3, StellarisContractError, N_ASSETS_V3,
    N_PUBLIC_SIGNALS, N_PUBLIC_SIGNALS_V2, N_PUBLIC_SIGNALS_V3, SIG2_LIAB_ROOT, SIG2_LIAB_TOTAL,
    SIG2_PERIOD, SIG2_RESERVE_COMMITMENT, SIG2_SOLVENT, SIG3_AGGREGATE_SOLVENT,
    SIG3_ASSET_SOLVENT_BASE, SIG3_PERIOD, SIG3_PRICE_COMMITMENT, SIG3_RESERVE_COMMITMENT,
    SIG_COMMITMENT, SIG_LIABILITIES, SIG_PERIOD, SIG_SOLVENT,
};

pub fn parse_public_signals(
    env: &Env,
    pub_signals: &Vec<U256>,
) -> Result<ParsedSignals, StellarisContractError> {
    if pub_signals.len() as usize != N_PUBLIC_SIGNALS {
        return Err(StellarisContractError::BadPublicSignals);
    }

    let solvent_u256 = pub_signals
        .get(SIG_SOLVENT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let commitment = pub_signals
        .get(SIG_COMMITMENT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let liabilities_u256 = pub_signals
        .get(SIG_LIABILITIES as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let period_u256 = pub_signals
        .get(SIG_PERIOD as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;

    let solvent = if solvent_u256 == U256::from_u32(env, 1) {
        true
    } else if solvent_u256 == U256::from_u32(env, 0) {
        false
    } else {
        return Err(StellarisContractError::BadPublicSignals);
    };

    let liabilities = liabilities_u256
        .to_u128()
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let period_u128 = period_u256
        .to_u128()
        .ok_or(StellarisContractError::BadPublicSignals)?;
    if period_u128 > u64::MAX as u128 {
        return Err(StellarisContractError::BadPublicSignals);
    }
    let period_id = period_u128 as u64;

    let mut fr_signals: Vec<Fr> = Vec::new(env);
    for i in 0..N_PUBLIC_SIGNALS as u32 {
        let val = pub_signals
            .get(i)
            .ok_or(StellarisContractError::BadPublicSignals)?;
        fr_signals.push_back(Fr::from_u256(val));
    }

    Ok(ParsedSignals {
        solvent,
        commitment,
        liabilities,
        period_id,
        fr_signals,
    })
}

/// Parse the v2 public-signal layout:
///   [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
///
/// `liab_root` is a Poseidon field element (a hash) and is kept full-width as a
/// `U256` — it MUST NOT be truncated via `to_u128`. `liab_total` is the proven
/// total liabilities and fits u128.
pub fn parse_public_signals_v2(
    env: &Env,
    pub_signals: &Vec<U256>,
) -> Result<ParsedSignalsV2, StellarisContractError> {
    if pub_signals.len() as usize != N_PUBLIC_SIGNALS_V2 {
        return Err(StellarisContractError::BadPublicSignals);
    }

    let solvent_u256 = pub_signals
        .get(SIG2_SOLVENT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let reserve_commitment = pub_signals
        .get(SIG2_RESERVE_COMMITMENT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let liab_root = pub_signals
        .get(SIG2_LIAB_ROOT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let liab_total_u256 = pub_signals
        .get(SIG2_LIAB_TOTAL as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let period_u256 = pub_signals
        .get(SIG2_PERIOD as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;

    let solvent = if solvent_u256 == U256::from_u32(env, 1) {
        true
    } else if solvent_u256 == U256::from_u32(env, 0) {
        false
    } else {
        return Err(StellarisContractError::BadPublicSignals);
    };

    let liab_total = liab_total_u256
        .to_u128()
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let period_u128 = period_u256
        .to_u128()
        .ok_or(StellarisContractError::BadPublicSignals)?;
    if period_u128 > u64::MAX as u128 {
        return Err(StellarisContractError::BadPublicSignals);
    }
    let period_id = period_u128 as u64;

    let mut fr_signals: Vec<Fr> = Vec::new(env);
    for i in 0..N_PUBLIC_SIGNALS_V2 as u32 {
        let val = pub_signals
            .get(i)
            .ok_or(StellarisContractError::BadPublicSignals)?;
        fr_signals.push_back(Fr::from_u256(val));
    }

    Ok(ParsedSignalsV2 {
        solvent,
        reserve_commitment,
        liab_root,
        liab_total,
        period_id,
        fr_signals,
    })
}

/// Parse a U256 that must be exactly 0 or 1 into a bool (a solvency flag).
fn parse_bool_flag(env: &Env, v: &U256) -> Result<bool, StellarisContractError> {
    if *v == U256::from_u32(env, 1) {
        Ok(true)
    } else if *v == U256::from_u32(env, 0) {
        Ok(false)
    } else {
        Err(StellarisContractError::BadPublicSignals)
    }
}

/// Parse the v3 public-signal layout (multi-asset solvency):
///   [ aggregateSolvent, reserveCommitment, priceCommitment,
///     assetSolvent[0..N_ASSETS_V3-1], period ]
///
/// `reserveCommitment` and `priceCommitment` are full-width field elements kept
/// as `U256`. The per-asset solvency flags and the aggregate flag must each be
/// exactly 0 or 1.
pub fn parse_public_signals_v3(
    env: &Env,
    pub_signals: &Vec<U256>,
) -> Result<ParsedSignalsV3, StellarisContractError> {
    if pub_signals.len() as usize != N_PUBLIC_SIGNALS_V3 {
        return Err(StellarisContractError::BadPublicSignals);
    }

    let aggregate_solvent = parse_bool_flag(
        env,
        &pub_signals
            .get(SIG3_AGGREGATE_SOLVENT as u32)
            .ok_or(StellarisContractError::BadPublicSignals)?,
    )?;
    let reserve_commitment = pub_signals
        .get(SIG3_RESERVE_COMMITMENT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let price_commitment = pub_signals
        .get(SIG3_PRICE_COMMITMENT as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;

    let mut asset_solvent: Vec<bool> = Vec::new(env);
    for a in 0..N_ASSETS_V3 as u32 {
        let flag = parse_bool_flag(
            env,
            &pub_signals
                .get(SIG3_ASSET_SOLVENT_BASE as u32 + a)
                .ok_or(StellarisContractError::BadPublicSignals)?,
        )?;
        asset_solvent.push_back(flag);
    }

    let period_u256 = pub_signals
        .get(SIG3_PERIOD as u32)
        .ok_or(StellarisContractError::BadPublicSignals)?;
    let period_u128 = period_u256
        .to_u128()
        .ok_or(StellarisContractError::BadPublicSignals)?;
    if period_u128 > u64::MAX as u128 {
        return Err(StellarisContractError::BadPublicSignals);
    }
    let period_id = period_u128 as u64;

    let mut fr_signals: Vec<Fr> = Vec::new(env);
    for i in 0..N_PUBLIC_SIGNALS_V3 as u32 {
        let val = pub_signals
            .get(i)
            .ok_or(StellarisContractError::BadPublicSignals)?;
        fr_signals.push_back(Fr::from_u256(val));
    }

    Ok(ParsedSignalsV3 {
        aggregate_solvent,
        reserve_commitment,
        price_commitment,
        asset_solvent,
        period_id,
        fr_signals,
    })
}
