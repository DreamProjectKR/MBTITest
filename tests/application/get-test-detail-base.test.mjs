import assert from "node:assert/strict";
import test from "node:test";

import { getTestDetailBaseQuery } from "../../worker/application/queries/getTestDetailBase.ts";

test("getTestDetailBaseQuery: not_found when no row", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return null;
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(
    db,
    {},
    "id",
    "https://x/",
    undefined,
    { enforcePublished: true },
  );
  assert.equal(r.kind, "not_found");
});

test("getTestDetailBaseQuery: forbidden_draft when unpublished", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "d",
            source_path: "d/test.json",
            is_published: 0,
          };
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(db, {}, "d", "https://x/", undefined, {
    enforcePublished: true,
  });
  assert.equal(r.kind, "forbidden_draft");
});

test("getTestDetailBaseQuery: invalid_path when key normalizes empty", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "x",
            source_path: "   ",
            is_published: 1,
          };
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(db, {}, "x", "https://x/", undefined, {
    enforcePublished: true,
  });
  assert.equal(r.kind, "invalid_path");
});

test("getTestDetailBaseQuery: missing_body when R2 has no object (non-localhost)", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "t1",
            source_path: "t1/test.json",
            is_published: 1,
          };
        },
      };
    },
  };
  const bucket = {
    async get() {
      return null;
    },
  };
  const r = await getTestDetailBaseQuery(
    db,
    bucket,
    "t1",
    "https://example.com/",
    undefined,
    { enforcePublished: true },
  );
  assert.equal(r.kind, "missing_body");
  assert.equal(r.key, "assets/t1/test.json");
});

test("getTestDetailBaseQuery: invalid_body_json when R2 text is not JSON", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "t2",
            source_path: "t2/test.json",
            is_published: 1,
          };
        },
      };
    },
  };
  const bucket = {
    async get() {
      return {
        etag: "e1",
        async text() {
          return "{not-valid-json";
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(
    db,
    bucket,
    "t2",
    "https://example.com/",
    undefined,
    { enforcePublished: true },
  );
  assert.equal(r.kind, "invalid_body_json");
});

test("getTestDetailBaseQuery: ok when enforcePublished false for unpublished row", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "draft",
            source_path: "draft/test.json",
            is_published: 0,
            title: "Draft T",
            description_json: null,
            tags_json: null,
            author: "a",
            author_img_path: "",
            thumbnail_path: "",
            created_at: "2026-01-01",
            updated_at: "2026-01-02",
          };
        },
      };
    },
  };
  const bucket = {
    async get() {
      return {
        etag: "etag1",
        async text() {
          return JSON.stringify({ questions: [], results: {} });
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(
    db,
    bucket,
    "draft",
    "https://example.com/",
    undefined,
    { enforcePublished: false },
  );
  assert.equal(r.kind, "ok");
  assert.equal(r.payload?.id, "draft");
  assert.equal(r.payload?.isPublished, false);
});
