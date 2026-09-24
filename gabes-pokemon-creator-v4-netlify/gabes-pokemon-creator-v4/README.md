# Gabe's Pokemon Creator v6 — Custom DNS GTS Edition

v6 keeps the Netlify + Render web creator from v5 and upgrades the Windows delivery side into a guided **local custom-DNS GTS bridge** for Gen IV/V.

## Hosted pieces

- **Netlify:** static web creator.
- **Render:** PKHeX.Core API, auto-legality, and 30-minute GTS queue.
- Render API currently configured in the Windows bridge: `https://gabe-pokebuilder.onrender.com`.

The existing Netlify environment variable remains:

`BACKEND_URL=https://gabe-pokebuilder.onrender.com`

## Deploy v6

Replace/update the files in the GitHub repository, commit to `main`, then let Render and Netlify redeploy. The API health endpoint should report `creator: v6`:

`https://gabe-pokebuilder.onrender.com/api/health`

## First-time Windows GTS setup

Open the `tools` folder and run:

`setup-gts-rs.bat`

The helper checks for Git and Rust/Cargo, optionally offers to install them with Windows `winget`, clones the current upstream `gts-rs` repository from Codeberg, builds its release executable, and copies `gts-rs.exe` into the tools folder.

The upstream transport is kept separate rather than bundled into this project.

## Sending a Pokemon through custom DNS

1. Build a Pokemon on the website.
2. Click **Queue for GTS**.
3. Copy the delivery code.
4. On Windows, run `tools/start-custom-dns-gts.bat` as Administrator.
5. Enter the delivery code.
6. The bridge fetches the queued `.pk4`/`.pk5`, detects the PC's LAN IPv4 address, configures Windows Firewall rules when possible, and launches `gts-rs`.
7. On the DS connection, disable automatic DNS and enter the **Primary DNS** printed by the bridge.
8. Enter the normal in-game GTS and leave the bridge running.
9. Confirm receipt so the queue entry is marked delivered.

## Why custom DNS?

The DS still uses Wi-Fi, but DNS redirects the game's legacy GTS traffic to the local replacement GTS server on the Windows PC. `gts-rs` implements the actual Gen IV/V DNS/GTS transport; Gabe's Creator handles generation, legality, and queueing.

## Network caveats

The PC and DS must be able to reach each other. Retail DS-era games use Nintendo's old Wi-Fi stack, so a DS-compatible open/WEP network may be required depending on hardware/game. Modern WPA2/WPA3-only configurations are often incompatible with the original DS Wi-Fi implementation.

If `gts-rs` reports an address already in use, close other DNS/web-server software using the required ports and retry.

## Supported games

- Diamond / Pearl / Platinum
- HeartGold / SoulSilver
- Black / White
- Black 2 / White 2

## Third-party component

`gts-rs` is a separate GPL-3.0 project maintained at `https://codeberg.org/bolu/gts-rs`. This archive does not bundle its source or executable; the setup helper obtains/builds it directly from upstream.
