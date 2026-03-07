import type { D1Database, R2Bucket } from "../../_types.ts";

import {
  type TestDetailQueryResult,
  getTestDetailBaseQuery,
} from "./getTestDetailBase.ts";

export async function getPublicTestDetailQuery(
  db: D1Database,
  bucket: R2Bucket,
  testId: string,
  requestUrl: string,
  publicBaseUrl?: string,
): Promise<TestDetailQueryResult> {
  return getTestDetailBaseQuery(db, bucket, testId, requestUrl, publicBaseUrl, {
    enforcePublished: true,
  });
}
