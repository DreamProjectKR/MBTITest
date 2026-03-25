import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserEnv } from "./setup-happy-dom.mjs";

createBrowserEnv();

const api = await import("../../public/scripts/admin/api.js");

test("fetchJson throws with body.error when response not ok", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "bad req" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(() => api.fetchJson("http://127.0.0.1:1/x"), /bad req/);
});

test("fetchJson throws generic message when JSON parse fails on error", async () => {
  globalThis.fetch = async () =>
    new Response("not json", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });

  await assert.rejects(
    () => api.fetchJson("http://127.0.0.1:1/x"),
    /요청 실패/,
  );
});

test("fetch helpers delegate to fetchJson", async () => {
  let lastUrl = "";
  globalThis.fetch = async (url) => {
    lastUrl = String(url);
    return new Response(JSON.stringify({ tests: [], items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await api.fetchTestsIndex();
  assert.ok(lastUrl.includes("/api/admin/tests"));

  await api.fetchTestDetail("ab");
  assert.ok(lastUrl.includes("/ab"));

  await api.saveTest("ab", { x: 1 });
  assert.ok(lastUrl.includes("/ab"));

  await api.fetchImageList("ab");
  assert.ok(lastUrl.includes("/images"));

  const buf = new Uint8Array([1, 2, 3]).buffer;
  await api.uploadTestImage("ab", new File([buf], "a.png"), "thumb");
  assert.ok(lastUrl.includes("/images"));

  await api.uploadResultImage("ab", "INTJ", new File([buf], "r.png"));
  assert.ok(lastUrl.includes("/results/INTJ/image"));
});
