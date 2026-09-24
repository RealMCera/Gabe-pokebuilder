FROM rust:1.88-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://codeberg.org/bolu/gts-rs.git /src/gts-rs
WORKDIR /src/gts-rs
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/gts-rs/target/release/gts-rs /usr/local/bin/gts-rs
WORKDIR /app
COPY supervisor.py /app/supervisor.py
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh && mkdir -p /data/pokemon
VOLUME ["/data"]
EXPOSE 53/udp
EXPOSE 80/tcp
ENTRYPOINT ["/app/start.sh"]
