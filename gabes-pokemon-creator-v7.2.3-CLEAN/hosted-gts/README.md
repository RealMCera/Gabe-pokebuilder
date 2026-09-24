# Gabe's Hosted GTS v8

This folder is for a small Linux VPS with a dedicated public IPv4. Nothing is installed on the Windows PC used to visit the website.

## Architecture
Netlify UI -> Render PKHeX API/queue -> Hosted GTS VPS -> Nintendo DS

The GTS container builds the upstream `gts-rs` project and runs it with a queue supervisor. `gts-rs` supplies the Gen IV/V DNS + in-game GTS protocol; the supervisor claims the oldest waiting Pokemon from the Render queue and feeds its `.pk4`/`.pk5` path to `gts-rs` over stdin.

## Required ports
Allow inbound:
- UDP 53 (DNS)
- TCP 80 (GTS HTTP)

Use a VPS with a static/dedicated public IPv4. `network_mode: host` is intentional so `gts-rs` sees/binds the host network instead of a Docker-private 172.x address.

## 1. Configure Render
Add an environment variable to the existing Render API:

GTS_BRIDGE_TOKEN=<a long random secret>

Redeploy Render after setting it.

## 2. Configure this server
Edit docker-compose.yml:
- CREATOR_API_URL should be your Render URL.
- GTS_BRIDGE_TOKEN must exactly match the Render secret.

Then run on the VPS:

  docker compose up -d --build
  docker compose logs -f

## 3. DS setup
Set the Nintendo Wi-Fi connection's Primary DNS to the VPS public IPv4. Leave Secondary DNS blank or use the same value.

Gen IV/V retail games still need DS-compatible Wi-Fi (typically open/WEP for the original game network stack).

## 4. Send
On the site, build a Pokemon and click Send to Hosted GTS. Then enter the normal in-game GTS. Only one delivery is staged at a time; exit/re-enter the GTS for another Pokemon.

## Important prototype note
The queue currently lives in Render process memory and expires after 30 minutes. A Render restart clears pending deliveries. For a multi-user/public service, move queue state to Redis/Postgres and add per-console authentication before opening the GTS publicly.
