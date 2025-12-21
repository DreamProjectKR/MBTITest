# PRD (Product Requirements Document)

## Product Summary

A static MBTI test hub with a serverless content API (Pages Functions + R2). Users browse and take tests; the system computes MBTI results from answer choices and renders result images.

## Goals

- Provide a simple, fast test-taking experience on mobile and desktop.
- Allow operators to publish tests as JSON + images without a complex backend.
- Keep frontend and content delivery compatible with Cloudflare Pages.

## Out of Scope (Current Repo)

- In-browser test editor/admin UI.
- User login, personalization, or persistent storage beyond R2 objects.

## Personas

- Test taker
  - Needs: frictionless flow, fast loading, share link
- Operator
  - Needs: predictable schema, straightforward deployment, safe caching

## Functional Requirements

### FR1: List tests

- System shall provide a list endpoint returning an array of test metadata.
- Frontend shall render the list and allow navigation to `testintro.html?testId=...`.

### FR2: View test intro

- System shall provide a detail endpoint returning test definition by id.
- Frontend shall render title, thumbnail, tags, author info, and description.

### FR3: Run quiz

- Frontend shall render question prompts (images) and answer buttons.
- Frontend shall accumulate per-axis scores based on `mbtiAxis` and `direction`.

### FR4: Compute and show result

- Frontend shall compute a 4-letter MBTI string (EI/SN/TF/JP).
- Frontend shall navigate to result page with `result` query param.
- Result page shall render the corresponding result image.

### FR5: Share and restart

- Intro and result pages shall support share (Web Share API if available, otherwise clipboard).
- Result page shall support restart (navigate to quiz with same `testId`).

### FR6: Asset delivery

- Frontend shall resolve asset URLs using runtime config and/or same-origin proxy.
- Backend shall proxy `/assets/*` from R2 with suitable caching headers.

## Non-Functional Requirements

- Performance
  - Static pages should load quickly; images should be cacheable.
- Reliability
  - Backend should return consistent response shapes (e.g., empty list instead of error when index missing).
- Compatibility
  - Modern evergreen browsers.
- Security
  - No secrets in frontend; R2 access only via backend binding.

## Acceptance Criteria (MVP)

- A user can navigate: home -> list -> intro -> quiz -> result.
- For a valid test JSON, result MBTI is computed deterministically.
- When R2 is misconfigured, API returns actionable errors (server side) and frontend fails gracefully.

## Dependencies

- Cloudflare Pages
- Cloudflare R2 binding `MBTI_BUCKET`
- Runtime variables as needed for asset base URL
