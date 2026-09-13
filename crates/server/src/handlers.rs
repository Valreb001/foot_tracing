use askama::Template;
use axum::{extract::Json, response::IntoResponse};
use foot_tracing_core::{steps_for_distance, Gender};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate;

pub async fn index() -> impl IntoResponse {
    IndexTemplate
}

#[derive(Deserialize)]
pub struct StepsRequest {
    distance_meters: f64,
    gender: Gender,
}

#[derive(Serialize)]
pub struct StepsResponse {
    steps: u64,
    step_length_m: f64,
    distance_meters: f64,
}

pub async fn calculate_steps(
    Json(req): Json<StepsRequest>,
) -> Result<Json<StepsResponse>, ApiError> {
    let calc = steps_for_distance(req.distance_meters, req.gender)?;

    Ok(Json(StepsResponse {
        steps: calc.steps,
        step_length_m: calc.step_length_m,
        distance_meters: calc.distance_meters,
    }))
}
