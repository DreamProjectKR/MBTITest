import assert from "node:assert/strict";
import test from "node:test";

import worker from "../../worker/index.ts";
import { getTieredCacheCf, parsePath } from "../../worker/router.ts";
import {
  createIndexDb,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("route registry parses nested admin result image path", () => {
  const match = parsePath("/api/admin/tests/test-a/results/ENFP/image");
  assert.equal(match.route, "api/admin/tests/:id/results/:mbti/image");
  assert.deepEqual(match.params, { id: "test-a", mbti: "ENFP" });
});

test("route registry returns tiered cache config for public detail route", () => {
  const config = getTieredCacheCf("api/tests/:id", { id: "test-a" });
  assert.equal(config.cacheTtl, 600);
  assert.deepEqual(config.cacheTags, ["api", "api-tests", "test-test-a"]);
});

test("worker fetch dispatches public tests index route", async () => {
  const request = new Request("https://example.com/api/tests");
  const response = await worker.fetch(
    request,
    {
      MBTI_DB: createIndexDb([
        {
          test_id: "published-test",
          title: "Published",
          thumbnail_path: "assets/published/images/thumbnail.png",
          tags_json: "[]",
          source_path: "published/test.json",
          created_at: "2026-03-07",
          updated_at: "2026-03-07",
          is_published: 1,
        },
      ]),
    },
    { waitUntil() {} },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.tests.map((item) => item.id),
    ["published-test"],
  );
});

test("worker fetch dispatches compute POST route", async () => {
  const request = new Request("https://example.com/api/tests/test-a/compute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      answers: [
        { mbtiAxis: "EI", direction: "E" },
        { mbtiAxis: "SN", direction: "S" },
        { mbtiAxis: "TF", direction: "T" },
        { mbtiAxis: "JP", direction: "J" },
      ],
    }),
  });
  const response = await worker.fetch(
    request,
    {
      MBTI_DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return { test_id: "test-a", is_published: 1 };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      },
      MBTI_BUCKET: createJsonBucket().bucket,
    },
    { waitUntil() {} },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.mbti, "ESTJ");
});
