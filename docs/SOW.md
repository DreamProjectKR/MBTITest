# SOW (Statement of Work)

## Objective

Document the current MBTI test hub project (frontend + Pages Functions) into separated artifacts: MRD/PRD/SOW/SRS/SDS/IRS, plus appendices for data schema and deployment runbook.

## In Scope

- Document current code behavior for:
  - `public/` pages and scripts
  - `functions/` endpoints (assets load via public R2 absolute URLs)
  - `assets/` data formats used by the API
- Provide interface contracts (endpoints, headers, status codes) and data schema definitions.
- Provide deployment/runbook guidance for Cloudflare Pages + R2.

## Out of Scope

- Implementing a new admin UI or altering product behavior.
- Changing infrastructure settings or adding new services.

## Deliverables

- `./00_overview.md`
- `./MRD.md`
- `./PRD.md`
- `./SOW.md`
- `./SRS.md`
- `./SDS.md`
- `./IRS.md`
- `./appendix_data_schema.md`
- `./appendix_deploy_runbook.md`

## Assumptions

- Cloudflare Pages Functions are enabled.
- R2 bucket is available and bound as `MBTI_BUCKET`.
- Tests are curated by operator and uploaded to R2 (at least `assets/index.json`).

## Risks and Mitigations

- Risk: README mentions admin workflow not present in repo.
  - Mitigation: document as "not implemented in current code" and list as future work.
- Risk: data schema drift across tests.
  - Mitigation: define minimum required fields and validation guidance.

## Acceptance Criteria

- Documents reflect the repository state and identify any mismatches (e.g., admin page).
- IRS includes explicit request/response shapes, status codes, caching, and error handling.
- SDS maps modules/files to responsibilities and describes runtime configuration.

## Roles

- Operator/maintainer: publishes tests (JSON/images) to R2.
- End user: takes tests via static pages.

## Timeline (Suggested)

- Documentation-only scope; timeline depends on review cycles.
