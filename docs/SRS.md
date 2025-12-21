# SRS (Software Requirements Specification)

## 1. Introduction

### 1.1 Purpose

Define the requirements for the MBTI test hub software as implemented in this repository.

### 1.2 System Context

- Static frontend served from Cloudflare Pages (`public/`).
- Serverless API and R2 asset proxy served from Cloudflare Pages Functions (`functions/`).
- Content stored in R2 under keys such as `assets/index.json` and `assets/<test>/...`.

## 2. Overall Description

### 2.1 Product Perspective

The system is a content-driven frontend that fetches test definitions at runtime and renders quiz/results. The backend is minimal and primarily reads from R2.

### 2.2 Users

- Test taker
- Operator/maintainer

### 2.3 Operating Environment

- Browser: modern evergreen browsers.
- Hosting: Cloudflare Pages + Pages Functions.
- Storage: Cloudflare R2 via binding.

### 2.4 Constraints

- No server-side rendering; static HTML/JS.
- API must be simple and cache-friendly (ETag support).
- R2 objects must follow expected key conventions.

## 3. Functional Requirements

### 3.1 Test Index

- System shall provide a test index endpoint at `GET /api/tests`.
- Endpoint shall return JSON with shape `{ "tests": [...] }`.
- If `assets/index.json` is missing in R2, endpoint shall return `{ "tests": [] }` with HTTP 200 (compatibility behavior).

### 3.2 Test Detail

- System shall provide a test detail endpoint at `GET /api/tests/:id`.
- Endpoint shall resolve `:id` in `assets/index.json`.
- Endpoint shall fetch the test JSON from R2 using `tests[].path` (normalized to `assets/...`).

### 3.3 Asset Loading

- System shall provide an asset proxy at `GET /assets/*` for same-origin image loading.
- Asset proxy shall set Content-Type and caching headers appropriately.

### 3.4 Frontend Pages

- Home (`index.html`) shall render sections for new/top tests by fetching `/api/tests`.
- List (`testlist.html`) shall render all tests by fetching `/api/tests`.
- Intro (`testintro.html`) shall render a specific test by fetching `/api/tests/:id`.
- Quiz (`testquiz.html`) shall render questions and compute MBTI result.
- Result (`testresult.html`) shall render MBTI result image and allow share/restart.

### 3.5 MBTI Computation

- Each answer shall define:
  - `mbtiAxis`: one of `EI`, `SN`, `TF`, `JP`
  - `direction`: one of `E/I/S/N/T/F/J/P`
- Result shall be computed by comparing counts in each axis; tie-breaker favors the first letter (E, S, T, J).

## 4. Non-Functional Requirements

### 4.1 Performance

- Static assets should be cacheable with long TTL where safe.
- API responses should support ETag and reasonable TTL.

### 4.2 Reliability

- API should return explicit errors on misconfiguration (missing R2 binding).
- Frontend should display usable error messages when fetch fails.

### 4.3 Security

- No private credentials in frontend.
- R2 access performed only in serverless environment via binding.

### 4.4 Accessibility

- Pages should remain usable on mobile.
- Buttons and focus navigation should be functional; ARIA values for progress are set by quiz code.

## 5. Data Requirements

See `./appendix_data_schema.md` for detailed schemas.

## 6. External Interfaces

See `./IRS.md`.
