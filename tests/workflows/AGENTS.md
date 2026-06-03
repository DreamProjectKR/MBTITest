# tests/workflows/ — Image Upload Workflow Tests

- Covers `uploadTestImage` + `uploadResultImage`: success, failure, put-fails, delete-fails, infer-types, merge branches.
- Assert mutation order, content-type inference, and compensation (cleanup on failure). Use shared harness buckets/db.
- Minimum 1 success + 1 failure path per workflow.

Run: `npm test`.
