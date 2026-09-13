mod error;
mod handlers;
mod routes;

#[tokio::main]
async fn main() {
    let app = routes::build_router();

    // Railway (and most PaaS hosts) assign the port dynamically via $PORT.
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let addr = format!("0.0.0.0:{port}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|_| panic!("failed to bind to {addr}"));

    println!("foot-tracing listening on http://{addr}");
    axum::serve(listener, app).await.expect("server error");
}
