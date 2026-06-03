# worker/http/ — HTTP Dispatch & Route Registry

- `dispatch.ts` `dispatchWorkerRequest`: match route → resolve handler → `await` it (rejection → JSON 500). Tiered cache via the `SELF` binding for GET routes with a `tieredCache` descriptor; origin subrequest tagged `X-Mbti-Origin-Request`.
- `routes.ts` `routeDescriptors`: single source for routes (`match` + `methods` + `tieredCache`). `matchRoute` / `getRouteDescriptor` stay generic.
- Add/modify a route ONLY here; don't fork parse logic. Update `tests/routing/` (and `tests/router/` for cache options).
- Never return an un-awaited handler promise. Don't leak stack traces (logged server-side only).

Verify: `npm test` (`tests/http/`, `tests/routing/`, `tests/router/`).
