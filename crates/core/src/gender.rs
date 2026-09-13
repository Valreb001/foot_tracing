use serde::{Deserialize, Serialize};

// Average step length in meters, based on common pedometer reference figures.
pub const MALE_STEP_LENGTH_M: f64 = 0.78;
pub const FEMALE_STEP_LENGTH_M: f64 = 0.70;

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Gender {
    Male,
    Female,
}

impl Gender {
    pub fn step_length_m(self) -> f64 {
        match self {
            Gender::Male => MALE_STEP_LENGTH_M,
            Gender::Female => FEMALE_STEP_LENGTH_M,
        }
    }

    /// Parses the lowercase wire/JS representation ("male" / "female").
    /// Unrecognized values fall back to `Male`, matching the browser client's default.
    pub fn from_wire(s: &str) -> Self {
        match s {
            "female" => Gender::Female,
            _ => Gender::Male,
        }
    }
}
