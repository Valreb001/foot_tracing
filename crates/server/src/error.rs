use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use foot_tracing_core::StepsError;
use serde::Serialize;

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

pub struct ApiError(StatusCode, String);

impl From<StepsError> for ApiError {
    fn from(err: StepsError) -> Self {
        ApiError(StatusCode::BAD_REQUEST, err.0)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(ErrorResponse { error: self.1 })).into_response()
    }
}
