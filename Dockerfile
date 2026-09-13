FROM rust:1-slim-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY crates crates

RUN cargo build --release -p foot_tracing_server

FROM debian:bookworm-slim
WORKDIR /app

COPY --from=builder /app/target/release/foot_tracing ./foot_tracing
COPY static ./static

CMD ["./foot_tracing"]
