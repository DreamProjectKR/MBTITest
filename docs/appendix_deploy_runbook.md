# Appendix: Deployment and Runbook (Cloudflare Pages + R2)

## 1. Hosting Model

- Static site: `public/`
- Pages Functions: `functions/`
- R2 bucket provides content and assets.

## 2. Required Bindings and Variables

### R2 Binding

- `MBTI_BUCKET`: R2 bucket binding name used by Pages Functions.

### Variables (Observed)

From `wrangler.toml`:

- `ASSETS_BASE`
- `R2_PUBLIC_BASE_URL`

Frontend runtime defaults (in `public/scripts/config.js`):

- `ASSETS_BASE` defaults to empty string and is used as prefix for `window.assetUrl()`.
- `API_TESTS_BASE` defaults to `/api/tests`.

## 2.1 Wrangler Configuration (Observed)

- `wrangler.toml` contains:
  - `name = "mbtitest"`
  - `compatibility_date = "2024-12-08"`
  - `[site] bucket = "./public"` (static output directory for local/CLI workflows)
  - `[[r2_buckets]] binding = "MBTI_BUCKET"` (R2 binding)

## 3. Routes

Both root `_routes.json` and `public/_routes.json` include:

- `/api/*`
- `/assets/*`

This ensures the Functions routes are included in the build output.

## 4. Local Development

### Prerequisites

- `wrangler` is listed in `package.json` devDependencies.

### Local preview

- Run a Pages dev server pointing at `public/` and wiring Functions:
  - `npx wrangler pages dev public`

### Local env

- Use `.dev.vars` for local variables.
- Ensure you have a way to provide an R2 binding in local mode if your workflow requires it.

## 4.1 Frontend Asset Base Options

The frontend builds asset URLs using `window.assetUrl()` from `public/scripts/config.js`.

- Same-origin (recommended with the R2 proxy)
  - Keep `window.ASSETS_BASE` empty (default).
  - Asset references like `assets/images/mainLogo.png` become `/assets/images/mainLogo.png` and are served by `GET /assets/*`.
- Direct public R2 domain (optional)
  - Set `window.ASSETS_BASE` to something like `https://<your-public-r2-domain>`.
  - You must inject this before `public/scripts/config.js` runs (e.g., inline `<script>` in HTML), or change `config.js` defaults.

## 5. Deploy to Cloudflare Pages

### Recommended

- Pages project output directory: `public`
- Functions directory: `functions`
- Build command: empty (static)

### Runtime Configuration

- Configure `MBTI_BUCKET` binding in Pages settings.
- Set variables as needed (e.g., `R2_PUBLIC_BASE_URL` if your frontend uses it).

## 6. Content Publishing Workflow (Operator)

### Baseline

- Upload (or sync) these objects to R2:
  - `assets/index.json`
  - `assets/<test-id>/test.json`
  - `assets/<test-id>/images/*` (and any shared images under `assets/images/*`)

### Key Naming Expectations

- Backend expects `assets/index.json`.
- Index entries have `path` like `test-summer/test.json`, which backend normalizes to `assets/test-summer/test.json`.

## 7. Troubleshooting

- If `/api/tests` returns 500 "R2 binding MBTI_BUCKET is missing":
  - Check Pages Functions R2 bindings.
- If `/api/tests` returns empty tests:
  - Check that `assets/index.json` exists in R2.
- If `/api/tests/:id` returns 404 "Test JSON not found":
  - Check that `assets/<path from index>` exists in R2 and matches the index entry.
- If images fail to load due to cross-origin:
  - Prefer using `/assets/*` proxy or set `ASSETS_BASE`/asset mapping to same origin.

## References

- Interfaces: `./IRS.md`
- Data schema: `./appendix_data_schema.md`
