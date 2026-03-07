import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet as adminTestDetailGet } from "../worker/api/admin/tests/[id].ts";
import { onRequestGet as adminTestsIndexGet } from "../worker/api/admin/tests/index.ts";
import { onRequestGet as publicTestDetailGet } from "../worker/api/tests/[id].ts";
import { onRequestGet as publicTestsIndexGet } from "../worker/api/tests/index.ts";

globalThis.caches = {
  default: {
    match: async () => null,
    put: async () => {},
    delete: async () => true,
  },
};

function createContext(url, env, params = {}) {
  return {
    request: new Request(url),
    env,
    params,
    waitUntil() {},
  };
}

function createIndexDb(rows) {
  return {
    prepare(query) {
      return {
        bind() {
          return this;
        },
        async all() {
          const publishedOnly = query.includes("WHERE is_published = 1");
          return {
            results:
              publishedOnly ?
                rows.filter((row) => Boolean(row.is_published))
              : rows,
          };
        },
        async first() {
          return null;
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

function createDetailDb(row) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return row;
        },
        async all() {
          return { results: [] };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

function createBucket(bodyText) {
  return {
    async get() {
      return {
        etag: "body-etag",
        body: {},
        async text() {
          return bodyText;
        },
      };
    },
    async list() {
      return { objects: [] };
    },
    async put() {},
    async delete() {},
  };
}

test("GET /api/tests only returns published tests", async () => {
  const env = {
    MBTI_DB: createIndexDb([
      {
        test_id: "draft-test",
        title: "Draft",
        thumbnail_path: "assets/draft/images/thumbnail.png",
        tags_json: "[]",
        source_path: "draft/test.json",
        created_at: "2026-03-07",
        updated_at: "2026-03-07",
        is_published: 0,
      },
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
  };
  const response = await publicTestsIndexGet(
    createContext("https://example.com/api/tests", env),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.tests.map((item) => item.id),
    ["published-test"],
  );
});

test("GET /api/admin/tests includes drafts for editor flows", async () => {
  const env = {
    MBTI_DB: createIndexDb([
      {
        test_id: "draft-test",
        title: "Draft",
        thumbnail_path: "assets/draft/images/thumbnail.png",
        tags_json: "[]",
        source_path: "draft/test.json",
        created_at: "2026-03-07",
        updated_at: "2026-03-07",
        is_published: 0,
      },
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
  };
  const response = await adminTestsIndexGet(
    createContext("https://example.com/api/admin/tests", env),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.tests.map((item) => item.id),
    ["draft-test", "published-test"],
  );
});

test("GET /api/tests/:id returns 404 for draft tests", async () => {
  const env = {
    MBTI_DB: createDetailDb({
      test_id: "draft-test",
      title: "Draft",
      description_json: "[]",
      author: "DREAM",
      author_img_path: "assets/draft/images/author.png",
      thumbnail_path: "assets/draft/images/thumbnail.png",
      tags_json: "[]",
      source_path: "draft/test.json",
      created_at: "2026-03-07",
      updated_at: "2026-03-07",
      is_published: 0,
    }),
    MBTI_BUCKET: createBucket(JSON.stringify({ questions: [], results: {} })),
  };
  const response = await publicTestDetailGet(
    createContext("https://example.com/api/tests/draft-test", env, {
      id: "draft-test",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.error, /Test not found/);
});

test("GET /api/admin/tests/:id can still read draft details", async () => {
  const env = {
    MBTI_DB: createDetailDb({
      test_id: "draft-test",
      title: "Draft",
      description_json: "[]",
      author: "DREAM",
      author_img_path: "assets/draft/images/author.png",
      thumbnail_path: "assets/draft/images/thumbnail.png",
      tags_json: "[]",
      source_path: "draft/test.json",
      created_at: "2026-03-07",
      updated_at: "2026-03-07",
      is_published: 0,
    }),
    MBTI_BUCKET: createBucket(
      JSON.stringify({
        questions: [],
        results: {},
      }),
    ),
  };
  const response = await adminTestDetailGet(
    createContext("https://example.com/api/admin/tests/draft-test", env, {
      id: "draft-test",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.id, "draft-test");
  assert.equal(body.isPublished, false);
});
