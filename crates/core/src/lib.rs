//! Shared domain logic for foot-tracing.
//!
//! Compiled both natively (for the Axum server) and to `wasm32-unknown-unknown`
//! (for in-browser live-tracking math), so the two never drift apart.

mod distance;
mod gender;
mod steps;

pub use distance::haversine_distance_m;
pub use gender::{Gender, FEMALE_STEP_LENGTH_M, MALE_STEP_LENGTH_M};
pub use steps::{step_count, steps_for_distance, StepsCalculation, StepsError};
