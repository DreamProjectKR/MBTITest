# public/partials/ — Shared HTML Fragments

- `header.html`, `footer.html` — shared markup loaded and wired by `public/scripts/layout.js`.
- Framework-free static HTML; no inline business logic or hardcoded origins.
- Images/links use `data-asset-*` attributes (hydrated by `config-bootstrap.mjs`); don't hardcode `/assets` URLs.
- Background images come from CSS vars (`--asset-header-bg`, `--asset-header-bg-non`, `--asset-footer-bg`) set in config-bootstrap; change the var path, not inline URLs.
- Keep markup in sync with `styles/header.css` / `styles/footer.css` selectors.

Verify: `tests/public/` (happy-dom) renders partials; `npm run test:e2e` for layout.
