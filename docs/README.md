# MBTI Test Hub Docs (Minimal)

This directory intentionally contains only one document: this file.

## What This Repo Is

- Static site (HTML/CSS/JS) served by **Cloudflare Pages** from `public/`.
- Small backend using **Cloudflare Pages Functions** in `functions/`:
  - `GET /api/tests` (test index)
  - `GET /api/tests/:id` (test detail)
  - `GET /assets/*` (same-origin asset proxy to R2)
- Content stored in **Cloudflare R2** (bucket bound as `MBTI_BUCKET`).

## Production Request Flow

- Pages serves HTML/JS/CSS from `public/`.
- Browser requests:
  - JSON from `https://dreamp.org/api/tests...`
  - Images from `https://dreamp.org/assets/...` (same-origin)
- Pages Function `GET /assets/*` reads from R2 via the binding and returns the object.
  - This avoids CORS issues that happen when the browser requests `*.r2.dev` directly.

## Key Files

- Frontend runtime config: `public/scripts/config.js`
  - `window.assetUrl(path)` builds an asset URL.
  - Production default uses same-origin `/assets/...` (so assets go through the proxy).
- API endpoints:
  - `functions/api/tests/index.js` -> `GET /api/tests`
  - `functions/api/tests/[id].js` -> `GET /api/tests/:id`
- Asset proxy:
  - `functions/assets/[[path]].js` -> `GET /assets/*`
- Routing include list:
  - `_routes.json`
  - `public/_routes.json`

## Deploy (Cloudflare Pages)

- **Build settings**
  - Build command: (empty)
  - Output directory: `public`
  - Functions directory: `functions`
- **Bindings**
  - R2 binding: `MBTI_BUCKET` -> your R2 bucket that contains `assets/...` keys
- **Routes**
  - Ensure `/_routes.json` and `/public/_routes.json` include `/api/*` and `/assets/*`

## Data Layout in R2 (Minimal Contract)

### 1 Test Index: `assets/index.json`

- Required shape:
  - `tests`: array
  - Each entry:
    - `id`: string
    - `path`: string (usually `test-xxx/test.json`, backend normalizes to `assets/<path>`)
  - Recommended:
    - `title`, `thumbnail`, `tags`, `createdAt`, `updatedAt`

### 2 Test Definition: `assets/<test-id>/test.json`

- Required fields (as used by current frontend):
  - `id`, `title`
  - `thumbnail`, `author`, `authorImg`, `tags`, `description`
  - `questions[]` where `prompt` is an image path and each answer has `mbtiAxis` + `direction`
  - `results` map keyed by MBTI (e.g. `INTJ`) containing `image`

## Troubleshooting

- Images 404 under `/assets/...`
  - Check `MBTI_BUCKET` binding exists
  - Check R2 keys exist under `assets/...`
  - Check `_routes.json` includes `/assets/*`
- Browser console shows CORS errors referencing `*.r2.dev`
  - That means something is still pointing the browser at the R2 public domain.
  - Production should request same-origin `https://dreamp.org/assets/...` instead.
