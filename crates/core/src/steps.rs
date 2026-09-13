use crate::gender::Gender;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StepsCalculation {
    pub steps: u64,
    pub step_length_m: f64,
    pub distance_meters: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepsError(pub String);

/// Steps for a distance, clamped to 0 for non-positive/non-finite input.
/// Used where a hard error would be inconvenient, e.g. live tracking before
/// any movement has been recorded.
pub fn step_count(distance_meters: f64, gender: Gender) -> u64 {
    if !distance_meters.is_finite() || distance_meters <= 0.0 {
        return 0;
    }
    (distance_meters / gender.step_length_m()).ceil() as u64
}

/// Steps for a distance, validating the input. Used by the manual-entry API
/// where a bad distance should surface as an error rather than silently be 0.
pub fn steps_for_distance(distance_meters: f64, gender: Gender) -> Result<StepsCalculation, StepsError> {
    if !distance_meters.is_finite() || distance_meters <= 0.0 {
        return Err(StepsError(
            "distance_meters must be a positive number".to_string(),
        ));
    }

    Ok(StepsCalculation {
        steps: step_count(distance_meters, gender),
        step_length_m: gender.step_length_m(),
        distance_meters,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_positive_distance() {
        assert!(steps_for_distance(0.0, Gender::Male).is_err());
        assert!(steps_for_distance(-5.0, Gender::Male).is_err());
        assert!(steps_for_distance(f64::NAN, Gender::Male).is_err());
    }

    #[test]
    fn rounds_up_to_whole_steps() {
        let calc = steps_for_distance(1.0, Gender::Male).unwrap();
        assert_eq!(calc.steps, 2); // 1m / 0.78m per step -> 1.28 -> ceil -> 2
    }

    #[test]
    fn step_count_clamps_instead_of_erroring() {
        assert_eq!(step_count(0.0, Gender::Male), 0);
        assert_eq!(step_count(-1.0, Gender::Female), 0);
    }
}
