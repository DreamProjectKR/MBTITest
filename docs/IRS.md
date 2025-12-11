# IRS (Interface Requirements Specification)

## 1. Overview

This document defines the external interfaces between:

- Frontend pages in `public/`
- Pages Functions endpoints in `functions/`

Primary interface is HTTP (same origin in Cloudflare Pages).

## 2. HTTP Interfaces

### 2.1 `GET /api/tests`

- Purpose: Return the test index list.
- Backend implementation: `functions/api/tests/index.js`

#### Request

- Method: GET
- Headers (optional):
  - `If-None-Match`: for caching

#### Response

- Success (200)
  - Content-Type: `application/json; charset=utf-8`
  - Body:
    - On hit: contents of R2 key `assets/index.json`
    - On miss: `{ "tests": [] }` (compatibility behavior)
  - Headers:
    - `Cache-Control: public, max-age=<maxAge>, stale-while-revalidate=<maxAge*10>`
    - `ETag: <etag>` when available
- Not Modified (304)
  - Returned if `If-None-Match` equals stored `etag`

#### Cache Details (as implemented)

- Normal hit: `maxAge=60`
- If `assets/index.json` missing: returns `{ "tests": [] }` with `maxAge=5`
- If `MBTI_BUCKET` missing: error response uses `maxAge=0`

#### Error Cases

- 500 if R2 binding `MBTI_BUCKET` is missing:
  - Body: `{ "error": "R2 binding MBTI_BUCKET is missing." }`

### 2.2 `GET /api/tests/:id`

- Purpose: Return a full test definition by id.
- Backend implementation: `functions/api/tests/[id].js`

#### Request

- Method: GET
- Path params:
  - `id`: test identifier matching `assets/index.json` entry `tests[].id`
- Headers (optional):
  - `If-None-Match`

#### Response

- Success (200)
  - Content-Type: `application/json; charset=utf-8`
  - Body: JSON document from R2 referenced by the index entry path.
  - Headers: cache + optional ETag
- Not Modified (304)
  - Returned if `If-None-Match` equals stored `etag`

#### Cache Details (as implemented)

- Success (200): `maxAge=120`
- Not Modified (304): `maxAge=120`
- Errors typically use `maxAge=0`, except some 404s use short caching:
  - index missing: `maxAge=5`
  - test not found / JSON missing: `maxAge=30`

#### Error Cases

- 400 missing `id`:
  - `{ "error": "Missing test id." }`
- 404 when index missing:
  - `{ "error": "index.json not found in R2." }`
- 404 when test id not found:
  - `{ "error": "Test not found: <id>" }`
- 404 when referenced test JSON missing:
  - `{ "error": "Test JSON not found in R2.", "key": "..." }`
- 500 invalid JSON in index:
  - `{ "error": "index.json is invalid JSON." }`
- 500 missing R2 binding:
  - `{ "error": "R2 binding MBTI_BUCKET is missing." }`

### 2.3 `GET /assets/*`

- Purpose: Same-origin proxy to read assets from R2.
- Backend implementation: `functions/assets/[[path]].js`

#### Request

- Method: GET
- Path params:
  - `path`: multi-segment tail
- Headers (optional):
  - `If-None-Match`

#### Resolution Behavior

The proxy tries candidate keys in order:

1. `assets/<tail>`
2. `<tail>`
3. `assets/data/<tail>`

#### Response

- Success (200)
  - Body: R2 object body
  - Headers:
    - `Content-Type`: metadata content type or guessed by extension
    - `ETag`: set to the R2 object's etag when available (may be empty string if unavailable)
    - `Cache-Control`:
      - JSON: `public, max-age=60`
      - Other assets: `public, max-age=31536000, immutable`
      - If R2 `httpMetadata.cacheControl` is set, it overrides the computed value
    - `X-MBTI-Assets-Proxy: 1`
    - `X-MBTI-R2-Key: <resolved key>`
- Not Modified (304)
  - If ETag matches `If-None-Match`
- Not Found (404)
  - Plaintext body describing attempted keys
  - `X-MBTI-R2-Key: MISS`

## 3. Frontend Integration Contracts

- Querystring contracts:
  - Intro/Quiz/Result accept `testId`.
  - Result accepts `result` (MBTI string).
- Data contracts: see `./appendix_data_schema.md`.

## 4. Compatibility Notes

- The frontend currently primarily fetches through `/api/tests` and `/api/tests/:id`.
- Asset URLs may be absolute (http/https) or relative; helper functions normalize and prefix as needed.
