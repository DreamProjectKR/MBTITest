import type { D1Database, PagesContext, R2Bucket } from "../types/bindings.d.ts";
import { errorResponse } from "./http.js";

export function requireDb(context: PagesContext): D1Database | Response {
  const db = context.env.MBTI_DB;
  if (!db) return errorResponse("D1 binding MBTI_DB is missing.", 500);
  return db;
}

export function requireBucket(context: PagesContext): R2Bucket | Response {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) return errorResponse("R2 binding MBTI_BUCKET is missing.", 500);
  return bucket;
}


