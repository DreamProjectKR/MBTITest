import type { R2Bucket } from "../../../_types.ts";

import {
  getTestKey,
  normalizeR2KeyFromIndexPath,
} from "../../../domain/tests/assetKeys.ts";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** I/O: read test JSON body from R2. */
export async function readTestBody(
  bucket: R2Bucket,
  testId: string,
): Promise<unknown | null> {
  const key = getTestKey(testId);
  const object = await bucket.get(key);
  if (!object) return null;
  const text = await object.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Test JSON at ${key} is not valid JSON.`);
  }
}

/** I/O: write test JSON body to R2. */
export async function writeTestBody(
  bucket: R2Bucket,
  testId: string,
  body: unknown,
): Promise<void> {
  const key = getTestKey(testId);
  await bucket.put(
    key,
    new TextEncoder().encode(JSON.stringify(body, null, 2)),
    { httpMetadata: { contentType: JSON_CONTENT_TYPE } },
  );
}

/** I/O: delete test JSON body from R2. */
export async function deleteTestBody(
  bucket: R2Bucket,
  testId: string,
): Promise<void> {
  await bucket.delete(getTestKey(testId));
}

/** I/O: resolve test body text by D1 source_path with optional localhost fallback. */
export async function readTestBodyBySourcePath(
  bucket: R2Bucket,
  rawPath: string,
  requestUrl: string,
  publicBaseUrl?: string,
): Promise<{ key: string; bodyText: string | null; etag: string | null }> {
  const key = normalizeR2KeyFromIndexPath(rawPath);
  if (!key) {
    return { key: "", bodyText: null, etag: null };
  }

  const object = await bucket.get(key);
  if (object) {
    return {
      key,
      bodyText: await object.text(),
      etag: object.etag ? String(object.etag) : null,
    };
  }

  const requestHost = new URL(requestUrl).hostname;
  const isLocalhost =
    requestHost === "localhost" || requestHost === "127.0.0.1";
  const publicBase =
    publicBaseUrl ? String(publicBaseUrl).replace(/\/+$/, "") : "";
  if (!isLocalhost || !publicBase) {
    return { key, bodyText: null, etag: null };
  }

  const remoteUrl = `${publicBase}/${key.replace(/^\/+/, "")}`;
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    return { key, bodyText: null, etag: null };
  }

  return {
    key,
    bodyText: await response.text(),
    etag: response.headers.get("etag"),
  };
}
