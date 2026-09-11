use askama::Template;
use axum::{
    extract::Json,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::services::ServeDir;

// Average step length in meters, based on common pedometer reference figures.
const MALE_STEP_LENGTH_M: f64 = 0.78;
const FEMALE_STEP_LENGTH_M: f64 = 0.70;

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate;

async fn index() -> impl IntoResponse {
    IndexTemplate
}

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum Gender {
    Male,
    Female,
}

impl Gender {
    fn step_length_m(self) -> f64 {
        match self {
            Gender::Male => MALE_STEP_LENGTH_M,
            Gender::Female => FEMALE_STEP_LENGTH_M,
        }
    }
}

#[derive(Deserialize)]
struct StepsRequest {
    distance_meters: f64,
    gender: Gender,
}

#[derive(Serialize)]
struct StepsResponse {
    steps: u64,
    step_length_m: f64,
    distance_meters: f64,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(ErrorResponse { error: self.1 })).into_response()
    }
}

async fn calculate_steps(
    Json(req): Json<StepsRequest>,
) -> Result<Json<StepsResponse>, ApiError> {
    if !req.distance_meters.is_finite() || req.distance_meters <= 0.0 {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "distance_meters must be a positive number".to_string(),
        ));
    }

    let step_length = req.gender.step_length_m();
    let steps = (req.distance_meters / step_length).ceil() as u64;

    Ok(Json(StepsResponse {
        steps,
        step_length_m: step_length,
        distance_meters: req.distance_meters,
    }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/api/steps", post(calculate_steps))
        .nest_service("/static", ServeDir::new("static"));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("failed to bind to port 3000");

    println!("foot-tracing listening on http://0.0.0.0:3000");
    axum::serve(listener, app).await.expect("server error");
}
