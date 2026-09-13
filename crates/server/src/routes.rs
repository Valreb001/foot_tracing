use axum::{
    routing::{get, post},
    Router,
};
use tower_http::services::ServeDir;

use crate::handlers::{calculate_steps, index};

pub fn build_router() -> Router {
    Router::new()
        .route("/", get(index))
        .route("/api/steps", post(calculate_steps))
        .nest_service("/static", ServeDir::new("static"))
}
