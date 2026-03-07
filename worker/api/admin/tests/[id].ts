import type { MbtiEnv, PagesContext } from "../../../_types.ts";

import {
  SaveTestValidationError,
  saveTestWorkflow,
} from "../../../application/workflows/saveTest.ts";
import { noStoreJsonResponse } from "../../_utils/http.ts";
import { loadTestDetail } from "../../tests/[id].ts";

type Params = { id?: string };

type TestPayload = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  author?: unknown;
  authorImg?: unknown;
  thumbnail?: unknown;
  tags?: unknown;
  isPublished?: unknown;
  path?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  questions?: unknown;
  results?: unknown;
};

function badRequest(message: string): Response {
  return noStoreJsonResponse({ error: message }, 400);
}

function methodNotAllowed(): Response {
  return noStoreJsonResponse({ error: "Method not allowed." }, 405);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export async function onRequestPut(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return noStoreJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );
  const db = context.env.MBTI_DB;
  if (!db)
    return noStoreJsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      500,
    );

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  let payload: unknown;
  try {
    payload = (await context.request.json()) as unknown;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  if (!isObject(payload)) return badRequest("Request body must be an object.");

  const p = payload as TestPayload;
  if (p.id && String(p.id) !== testId)
    return badRequest("Payload id must match the URL parameter.");

  try {
    const result = await saveTestWorkflow(context, testId, p);
    return noStoreJsonResponse(result);
  } catch (err) {
    if (err instanceof SaveTestValidationError) {
      return badRequest(err.message);
    }
    const message = err instanceof Error ? err.message : "Failed to save test.";
    return noStoreJsonResponse({ error: message }, 500);
  }
}

export async function onRequestGet(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  return loadTestDetail(context, { enforcePublished: false, useCache: false });
}
