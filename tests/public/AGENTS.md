# tests/public/ — Browser Script Tests (happy-dom)

- Covers `public/scripts/*` page logic, admin UI modules, config/layout/analytics, and static-import smoke (`0-*-static-import`).
- Use `setup-happy-dom.mjs`; fixtures in `fixtures-pages.mjs` / `fixtures-admin-html.mjs` / `sample-test-json.mjs`; stable imports via `stable-import.mjs`, `config-install.mjs`.
- Assert DOM hydration (`data-asset-*` → `src`/`srcset`) and page behavior, not network.

Run: `npm test`; coverage includes `public/scripts/**`.
