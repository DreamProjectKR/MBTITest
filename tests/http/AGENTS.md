# tests/http/ — Dispatch Tests

- Covers `dispatchWorkerRequest`: method branches, tiered-cache via `SELF`, origin subrequest header, and async-handler exception → JSON 500 (`dispatch-*`).
- Assert dispatch `await`s handlers (rejection surfaces as JSON error) and tiered-cache only applies to GET routes with a descriptor.

Run: `npm test`.
