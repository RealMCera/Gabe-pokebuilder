# Gabe's Pokémon Creator v7.2.3 — Clean Deploy Build

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
