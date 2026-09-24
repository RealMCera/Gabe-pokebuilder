# Gabe's Pokémon Creator v4 — Netlify Web Edition

A personal-use web Pokémon creator focused on Nintendo DS games:

- Diamond / Pearl / Platinum (`.pk4`)
- HeartGold / SoulSilver (`.pk4`)
- Black / White (`.pk5`)
- Black 2 / White 2 (`.pk5`)

The frontend is a static site intended for **Netlify**. The PKHeX.Core legality/generation API is an **ASP.NET Core** service intended for **Render** (or another Docker/.NET host).

## Architecture

```text
Browser
  ↓
Netlify static frontend
  ↓ /api/* proxy
ASP.NET Core API on Render
  ↓
PKHeX.Core
```

The frontend always calls `/api`, so visitors see one website URL. During the Netlify build, `BACKEND_URL` is used to generate the proxy rule.

## 1. Put this project on GitHub

Create a repository and upload the contents of this folder. Both Netlify and Render can deploy from the same repo.

## 2. Deploy the backend on Render

### Option A — Blueprint

This repo includes `render.yaml`.

1. In Render choose **New → Blueprint**.
2. Connect the GitHub repository.
3. Render will create `gabes-pokemon-creator-api` using the included Dockerfile.
4. After deployment, copy the public Render URL, for example:

```text
https://gabes-pokemon-creator-api.onrender.com
```

5. Test:

```text
https://YOUR-RENDER-URL/api/health
```

You should receive JSON with `"ok": true`.

### CORS

The API allows cross-origin requests by default for the easiest first deployment. Because the normal browser path goes through Netlify's same-origin `/api` proxy, you can later set an `ALLOWED_ORIGINS` environment variable on Render to a comma-separated list of sites if you also want to restrict direct browser access to the API.

## 3. Deploy the frontend on Netlify

1. In Netlify choose **Add new project → Import an existing project**.
2. Connect the same GitHub repository.
3. Netlify should read `netlify.toml` automatically.
4. Add this environment variable in **Project configuration → Environment variables**:

```text
BACKEND_URL=https://YOUR-RENDER-URL.onrender.com
```

Do **not** add `/api` to the end.

5. Deploy.

Netlify runs:

```text
npm run build
```

and publishes the generated `dist/` directory.

The build creates a Netlify rewrite like:

```text
/api/*  https://YOUR-RENDER-URL.onrender.com/api/:splat  200
```

so the frontend can safely use relative `/api/...` paths.

## 4. Use it

Open the Netlify URL. The status badge should say **PKHeX backend online**. You can then preview encounters, validate, auto-legalize, and download `.pk4` / `.pk5` files from the browser.

## Local development

Start the API:

```powershell
cd backend/GabesPokemonCreator.Api
dotnet restore
dotnet run
```

For a quick local frontend test, either temporarily proxy `/api` with a dev server or change the first line of `frontend/app.js` to your local API URL. The production file intentionally uses:

```js
const API='/api';
```

## Deployment files added in v4

```text
netlify.toml
package.json
scripts/build-netlify.mjs
render.yaml
backend/GabesPokemonCreator.Api/Dockerfile
backend/GabesPokemonCreator.Api/.dockerignore
```

## Notes

- PKHeX.Core package: `26.8.26`.
- The API binds to Render's `PORT` environment variable automatically.
- Netlify serves only the static frontend. PKHeX stays in the .NET backend.
- Generated files should still be reviewed with current PKHeX before editing valuable save data.
- Pokémon names, artwork and trademarks belong to their respective owners. PKHeX.Core is distributed under its upstream license; review that license before public redistribution.
