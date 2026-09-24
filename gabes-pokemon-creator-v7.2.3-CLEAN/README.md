# Gabe's Pokemon Creator v8 — Hosted GTS Edition

V8 removes the requirement to install the GTS bridge on your own Windows PC. The web creator remains on Netlify, PKHeX/legalization remains on Render, and the new `hosted-gts/` container is designed for a small Linux VPS with a dedicated public IPv4.

## Repo layout
- `frontend/` — Netlify website
- `backend/` — Render .NET/PKHeX API
- `hosted-gts/` — always-on DNS + Gen IV/V GTS bridge
- `tools/` — legacy local bridge tools (optional; no longer required for the hosted route)

## Render
Keep Root Directory = `backend`, Dockerfile Path = `GabesPokemonCreator.Api/Dockerfile`, Build Context = `GabesPokemonCreator.Api`. Add `GTS_BRIDGE_TOKEN` with a long random secret.

## Netlify
Keep `BACKEND_URL=https://gabe-pokebuilder.onrender.com` (or your own Render URL).

## Hosted GTS
Read `hosted-gts/README.md`. Deploy that container to a Linux VPS with a dedicated public IPv4 and inbound UDP 53 + TCP 80. Point the DS Primary DNS at that IPv4.

## Health check
`/api/health` should report `creator: v8`.


This ZIP is deliberately packaged with **no extra outer folder**. When you open it, you should immediately see:

- `backend/`
- `frontend/`
- `tools/`
- `netlify.toml`
- `render.yaml`
- `package.json`
- `scripts/`

## Important GitHub upload rule

Upload the **contents of this ZIP directly to the root of your GitHub repository**. Do not upload the ZIP as one nested folder.

After uploading, this GitHub path must exist exactly:

`backend/GabesPokemonCreator.Api/Services/PokemonGenerationService.cs`

There must be only one file defining `PokemonGenerationService`. This clean build contains exactly one.

## Render settings

If you are using the existing Render Web Service instead of the Blueprint file, use:

- Root Directory: `backend`
- Runtime: Docker
- Dockerfile Path: `GabesPokemonCreator.Api/Dockerfile`
- Docker Build Context Directory: `GabesPokemonCreator.Api`

Then use **Manual Deploy → Clear build cache & deploy**.

After deploy, check:

`https://gabe-pokebuilder.onrender.com/api/health`

It should report `creator: v7.2.3`.

## Netlify

Keep this environment variable:

`BACKEND_URL=https://gabe-pokebuilder.onrender.com`

Then redeploy the site.

## Included fixes

- one and only one `PokemonGenerationService.cs`
- corrected EXP level/growth byte casts
- DS nickname legality fix
- naturalized EXP helper
- smart randomizer
- GTS queue
- custom DNS Windows bridge tools