# public/styles/ — CSS

- Plain CSS, no preprocessor/framework: `reset.css`, `header.css`, `footer.css`, `main.css`, `testintro.css`, `testlist.css`, `testquiz.css`, `testresult.css`, `admin.css`.
- Load `reset.css` first; keep each page's rules scoped to that page to avoid cross-page bleed.
- Asset URLs come from CSS vars set by `config-bootstrap.mjs` (`--ASSETS_BASE`, `--asset-header-bg`, `--asset-header-bg-non`, `--asset-footer-bg`); reference the var, don't hardcode `/assets` paths.
- Batch visual changes; avoid layout thrash and unnecessary reflows.

Verify: visual/manual + `npm run test:e2e`. No unit tests for CSS.
