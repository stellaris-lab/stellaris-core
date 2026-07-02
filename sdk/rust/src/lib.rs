//! Rust SDK primitives for the Stellaris proof-of-reserves protocol.
//!
//! This crate intentionally starts with deterministic, language-neutral protocol
//! utilities. It must pass the same `protocol-spec` vectors as the TypeScript SDK
//! before it grows network or proving features.

use std::fmt;

pub type FieldElement = String;

const N_PUBLIC_SIGNALS: usize = 4;
const N_PUBLIC_SIGNALS_V2: usize = 5;
const N_ASSETS_V3: usize = 4;
const N_PUBLIC_SIGNALS_V3: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicSignals {
    pub solvent: bool,
    pub commitment: FieldElement,
    pub liabilities: u128,
    pub period_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicSignalsV2 {
    pub solvent: bool,
    pub reserve_commitment: FieldElement,
    pub liab_root: FieldElement,
    pub liab_total: u128,
    pub period_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicSignalsV3 {
    pub aggregate_solvent: bool,
    pub reserve_commitment: FieldElement,
    pub price_commitment: FieldElement,
    pub asset_solvent: [bool; N_ASSETS_V3],
    pub period_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SdkError {
    WrongSignalCount { expected: usize, actual: usize },
    InvalidFieldElement { label: String, value: String },
    InvalidFlag { label: String, value: String },
    InvalidInteger { label: String, value: String },
}

impl fmt::Display for SdkError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WrongSignalCount { expected, actual } => {
                write!(f, "expected {expected} public signals, got {actual}")
            }
            Self::InvalidFieldElement { label, value } => {
                write!(f, "{label} must be a decimal field element string: {value}")
            }
            Self::InvalidFlag { label, value } => write!(f, "{label} must be 0 or 1: {value}"),
            Self::InvalidInteger { label, value } => write!(f, "{label} is not a u64: {value}"),
        }
    }
}

impl std::error::Error for SdkError {}

pub fn assert_field_element(value: &str, label: &str) -> Result<(), SdkError> {
    let is_decimal = value == "0"
        || (!value.is_empty()
            && !value.starts_with('0')
            && value.as_bytes().iter().all(u8::is_ascii_digit));
    if is_decimal {
        Ok(())
    } else {
        Err(SdkError::InvalidFieldElement {
            label: label.to_owned(),
            value: value.to_owned(),
        })
    }
}

pub fn parse_public_signals(signals: &[String]) -> Result<PublicSignals, SdkError> {
    expect_count(signals, N_PUBLIC_SIGNALS)?;
    validate_all_fields(signals)?;
    Ok(PublicSignals {
        solvent: parse_flag(&signals[0], "solvent")?,
        commitment: signals[1].clone(),
        liabilities: parse_u128(&signals[2], "liabilities")?,
        period_id: parse_u64(&signals[3], "periodId")?,
    })
}

pub fn encode_public_signals(signals: &PublicSignals) -> Result<Vec<String>, SdkError> {
    assert_field_element(&signals.commitment, "commitment")?;
    Ok(vec![
        encode_flag(signals.solvent),
        signals.commitment.clone(),
        signals.liabilities.to_string(),
        signals.period_id.to_string(),
    ])
}

pub fn parse_public_signals_v2(signals: &[String]) -> Result<PublicSignalsV2, SdkError> {
    expect_count(signals, N_PUBLIC_SIGNALS_V2)?;
    validate_all_fields(signals)?;
    Ok(PublicSignalsV2 {
        solvent: parse_flag(&signals[0], "solvent")?,
        reserve_commitment: signals[1].clone(),
        liab_root: signals[2].clone(),
        liab_total: parse_u128(&signals[3], "liabTotal")?,
        period_id: parse_u64(&signals[4], "periodId")?,
    })
}

pub fn encode_public_signals_v2(signals: &PublicSignalsV2) -> Result<Vec<String>, SdkError> {
    assert_field_element(&signals.reserve_commitment, "reserveCommitment")?;
    assert_field_element(&signals.liab_root, "liabRoot")?;
    Ok(vec![
        encode_flag(signals.solvent),
        signals.reserve_commitment.clone(),
        signals.liab_root.clone(),
        signals.liab_total.to_string(),
        signals.period_id.to_string(),
    ])
}

pub fn parse_public_signals_v3(signals: &[String]) -> Result<PublicSignalsV3, SdkError> {
    expect_count(signals, N_PUBLIC_SIGNALS_V3)?;
    validate_all_fields(signals)?;
    Ok(PublicSignalsV3 {
        aggregate_solvent: parse_flag(&signals[0], "aggregateSolvent")?,
        reserve_commitment: signals[1].clone(),
        price_commitment: signals[2].clone(),
        asset_solvent: [
            parse_flag(&signals[3], "assetSolvent[0]")?,
            parse_flag(&signals[4], "assetSolvent[1]")?,
            parse_flag(&signals[5], "assetSolvent[2]")?,
            parse_flag(&signals[6], "assetSolvent[3]")?,
        ],
        period_id: parse_u64(&signals[7], "periodId")?,
    })
}

pub fn encode_public_signals_v3(signals: &PublicSignalsV3) -> Result<Vec<String>, SdkError> {
    assert_field_element(&signals.reserve_commitment, "reserveCommitment")?;
    assert_field_element(&signals.price_commitment, "priceCommitment")?;
    let mut encoded = vec![
        encode_flag(signals.aggregate_solvent),
        signals.reserve_commitment.clone(),
        signals.price_commitment.clone(),
    ];
    encoded.extend(signals.asset_solvent.iter().map(|flag| encode_flag(*flag)));
    encoded.push(signals.period_id.to_string());
    Ok(encoded)
}

fn expect_count(signals: &[String], expected: usize) -> Result<(), SdkError> {
    if signals.len() == expected {
        Ok(())
    } else {
        Err(SdkError::WrongSignalCount {
            expected,
            actual: signals.len(),
        })
    }
}

fn validate_all_fields(signals: &[String]) -> Result<(), SdkError> {
    for (index, signal) in signals.iter().enumerate() {
        assert_field_element(signal, &format!("publicSignals[{index}]"))?;
    }
    Ok(())
}

fn parse_flag(value: &str, label: &str) -> Result<bool, SdkError> {
    match value {
        "0" => Ok(false),
        "1" => Ok(true),
        _ => Err(SdkError::InvalidFlag {
            label: label.to_owned(),
            value: value.to_owned(),
        }),
    }
}

fn encode_flag(value: bool) -> String {
    if value { "1" } else { "0" }.to_owned()
}

fn parse_u64(value: &str, label: &str) -> Result<u64, SdkError> {
    value.parse::<u64>().map_err(|_| SdkError::InvalidInteger {
        label: label.to_owned(),
        value: value.to_owned(),
    })
}

fn parse_u128(value: &str, label: &str) -> Result<u128, SdkError> {
    value.parse::<u128>().map_err(|_| SdkError::InvalidInteger {
        label: label.to_owned(),
        value: value.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<SignalVector>,
        #[serde(rename = "invalidVectors")]
        invalid_vectors: Vec<SignalVector>,
    }

    #[derive(Debug, Deserialize)]
    struct SignalVector {
        name: String,
        version: String,
        signals: Vec<String>,
    }

    fn vectors() -> VectorFile {
        serde_json::from_str(include_str!("../test-vectors/public-signals.json"))
            .expect("protocol-spec public-signal vectors must be valid JSON")
    }

    #[test]
    fn parses_and_encodes_protocol_spec_vectors() {
        for vector in vectors().vectors {
            let encoded = match vector.version.as_str() {
                "v1" => encode_public_signals(&parse_public_signals(&vector.signals).unwrap()),
                "v2" => {
                    encode_public_signals_v2(&parse_public_signals_v2(&vector.signals).unwrap())
                }
                "v3" => {
                    encode_public_signals_v3(&parse_public_signals_v3(&vector.signals).unwrap())
                }
                other => panic!("unknown vector version {other}"),
            }
            .unwrap();
            assert_eq!(encoded, vector.signals, "{}", vector.name);
        }
    }

    #[test]
    fn rejects_invalid_protocol_spec_vectors() {
        for vector in vectors().invalid_vectors {
            let result = match vector.version.as_str() {
                "v1" => parse_public_signals(&vector.signals).map(|_| ()),
                "v2" => parse_public_signals_v2(&vector.signals).map(|_| ()),
                "v3" => parse_public_signals_v3(&vector.signals).map(|_| ()),
                other => panic!("unknown vector version {other}"),
            };
            assert!(result.is_err(), "{} should reject", vector.name);
        }
    }

    #[test]
    fn field_element_validation_matches_ts_sdk_rules() {
        assert!(assert_field_element("0", "x").is_ok());
        assert!(assert_field_element("12345", "x").is_ok());
        assert!(assert_field_element("01", "x").is_err());
        assert!(assert_field_element("-1", "x").is_err());
        assert!(assert_field_element("0x1f", "x").is_err());
        assert!(assert_field_element("", "x").is_err());
    }
}
