import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteTestBody,
  readTestBody,
  readTestBodyBySourcePath,
  writeTestBody,
} from "../../worker/infrastructure/repositories/r2/testBodyRepository.ts";

test("readTestBody returns null when object missing", async () => {
  const bucket = {
    async get() {
      return null;
    },
  };
  const v = await readTestBody(bucket, "my-test");
  assert.equal(v, null);
});

test("readTestBody throws when JSON invalid", async () => {
  const bucket = {
    async get() {
      return {
        async text() {
          return "{ not json";
        },
      };
    },
  };
  await assert.rejects(
    () => readTestBody(bucket, "bad-json"),
    /not valid JSON/,
  );
});

test("writeTestBody then readTestBody round-trip", async () => {
  const store = new Map();
  const bucket = {
    async get(key) {
      const text = store.get(key);
      if (!text) return null;
      return {
        etag: "e1",
        async text() {
          return text;
        },
      };
    },
    async put(key, value) {
      store.set(
        key,
        value instanceof Uint8Array ? new TextDecoder().decode(value) : value,
      );
    },
  };
  await writeTestBody(bucket, "rid", { a: 1 });
  const v = await readTestBody(bucket, "rid");
  assert.deepEqual(v, { a: 1 });
});

test("deleteTestBody removes key", async () => {
  const deleted = [];
  const bucket = {
    async get() {
      return null;
    },
    async delete(key) {
      deleted.push(key);
    },
  };
  await deleteTestBody(bucket, "tid");
  assert.ok(deleted[0].includes("tid"));
});

test("readTestBodyBySourcePath returns empty key for blank path", async () => {
  const r = await readTestBodyBySourcePath({}, "   ", "https://example.com/x");
  assert.equal(r.key, "");
  assert.equal(r.bodyText, null);
});

test("readTestBodyBySourcePath reads from bucket when present", async () => {
  const bucket = {
    async get(key) {
      assert.ok(key.startsWith("assets/"));
      return {
        etag: "et",
        async text() {
          return '{"ok":true}';
        },
      };
    },
  };
  const r = await readTestBodyBySourcePath(
    bucket,
    "t1/test.json",
    "https://example.com/",
  );
  assert.equal(r.bodyText, '{"ok":true}');
  assert.equal(r.etag, "et");
});

test("readTestBodyBySourcePath localhost fetch ok", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('{"remote":1}', {
      status: 200,
      headers: { etag: '"fe"' },
    });
  try {
    const bucket = {
      async get() {
        return null;
      },
    };
    const r = await readTestBodyBySourcePath(
      bucket,
      "t1/test.json",
      "http://127.0.0.1:8787/x",
      "https://cdn.example.com",
    );
    assert.equal(JSON.parse(r.bodyText).remote, 1);
    assert.equal(r.etag, '"fe"');
  } finally {
    globalThis.fetch = orig;
  }
});

test("readTestBodyBySourcePath localhost fetch not ok", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    const bucket = {
      async get() {
        return null;
      },
    };
    const r = await readTestBodyBySourcePath(
      bucket,
      "t1/test.json",
      "http://localhost:8787/x",
      "https://cdn.example.com",
    );
    assert.equal(r.bodyText, null);
  } finally {
    globalThis.fetch = orig;
  }
});

test("readTestBodyBySourcePath non-localhost missing object", async () => {
  const bucket = {
    async get() {
      return null;
    },
  };
  const r = await readTestBodyBySourcePath(
    bucket,
    "t1/test.json",
    "https://prod.example.com/x",
    "https://cdn.example.com",
  );
  assert.equal(r.bodyText, null);
});
