# tests/admin-images/ — Admin Image Upload Consistency

- Covers image upload consistency across D1 meta + R2 binary (`upload-consistency`).
- Assert content-type rules (reject SVG), canonical keys (`assets/<id>/images/...`), and that meta/binary stay in sync.
- Use shared harness buckets/db; don't copy ad-hoc stubs.

Run: `npm test`.
