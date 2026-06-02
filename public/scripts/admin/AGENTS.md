# public/scripts/admin/ — Admin Authoring SPA

No framework, single state source. Mirrors the Worker layering: render ≈ view, effects ≈ application, validation ≈ domain. See `docs/ARCHITECTURE_CONSTRAINTS.md` "Frontend Admin".

## Contracts

- Single source of truth: state in `state.js`; transitions via `reducer.js` + `store.js`; reads via `selectors.js`. Don't scatter ad-hoc flags.
- Event handlers (`forms.js`, `main.js`) only `dispatch(action)` or call an effect. No business logic in handlers.
- `render.js` is render-only: input state → DOM (toast, loading overlay). It must not own state or call APIs.
- Async API orchestration lives in `effects.js` + `api.js` (fetch wrappers, test CRUD, image upload).
- Keep DOM references (`dom.js`) separate from data state. Validation / path normalization is pure in `validation.js`.
- Entry: `admin.js` → `main.js` bootstrap and event binding.

## Verify

- Pure modules (`reducer`, `store`, `selectors`, `validation`, `api`, `dom`) tested under `tests/public/` and `tests/frontend/`; cover branches directly.
- `npm test`; admin smoke flow also runs under `npm run test:e2e`.
