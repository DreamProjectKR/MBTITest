# MRD (Market Requirements Document)

## Problem Statement

People want quick, shareable personality-style tests. For creators/operators, the key problem is operational: publishing and updating tests (JSON + images) should be fast, low-maintenance, and deployable on a static hosting platform.

## Target Users

- End users (test takers)
  - Want a simple flow: browse -> start -> answer -> get result -> share
  - Expect mobile-friendly UI and fast image loading
- Test creators/operators
  - Want a predictable JSON format for questions/results
  - Need an easy deployment path (Pages + R2), minimal backend

## Value Proposition

- Lightweight static frontend with serverless delivery of dynamic content (tests) from R2.
- Same-origin asset proxy reduces cross-origin constraints for images/JSON.

## Market/Context Assumptions

- Tests are curated and published by operators (not fully user-generated at runtime).
- Low backend complexity is preferred; content delivery and caching matter.

## MVP Scope

- Browsing tests
  - Home view of newest/top tests
  - Full test list
- Test execution
  - Intro page showing description/tags/author
  - Quiz page rendering questions and answer buttons
  - MBTI result computation (EI/SN/TF/JP)
  - Result page showing MBTI result image and share/restart
- Content delivery
  - Test index and test JSON served via Pages Functions backed by R2
  - Asset proxy under `/assets/*`

## Non-Goals (Current Repo State)

- Admin UI for authoring tests (README mentions it, but current repo does not contain `public/admin.html`).
- Authentication/authorization.
- Persistent user accounts, analytics pipeline, or database storage.

## Success Metrics (Suggested)

- Completion rate: % of users who reach result page.
- Load performance: time-to-first-render on mobile, image load times.
- Share rate: % of results shared or copied.
- Content velocity: time to publish/update a test (JSON+images) from operator workflow.

## Risks

- Content correctness: invalid JSON or incomplete `results` can break UX.
- Caching: stale cached JSON/ETag mismatches can cause confusing updates.
- Missing content: missing R2 objects lead to 404/empty lists; requires good monitoring.
