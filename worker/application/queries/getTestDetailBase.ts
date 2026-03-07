import type { D1Database, R2Bucket } from "../../_types.ts";

import {
  type TestRow,
  buildTestDetailEtag,
  isPublishedRow,
  mergeTestDetailPayload,
} from "../../domain/tests/mergePayload.ts";
import { getTestMetadataById } from "../../infrastructure/repositories/d1/testMetadataRepository.ts";
import { readTestBodyBySourcePath } from "../../infrastructure/repositories/r2/testBodyRepository.ts";

export type TestDetailQueryResult =
  | { kind: "not_found" }
  | { kind: "forbidden_draft" }
  | { kind: "invalid_path" }
  | { kind: "missing_body"; key: string }
  | { kind: "invalid_body_json" }
  | {
      kind: "ok";
      row: TestRow;
      key: string;
      etag: string;
      payload: Record<string, unknown>;
    };

export async function getTestDetailBaseQuery(
  db: D1Database,
  bucket: R2Bucket,
  testId: string,
  requestUrl: string,
  publicBaseUrl: string | undefined,
  options: { enforcePublished: boolean },
): Promise<TestDetailQueryResult> {
  const row = await getTestMetadataById(db, testId);
  if (!row?.source_path) {
    return { kind: "not_found" };
  }
  if (options.enforcePublished && !isPublishedRow(row)) {
    return { kind: "forbidden_draft" };
  }

  const resolved = await readTestBodyBySourcePath(
    bucket,
    String(row.source_path),
    requestUrl,
    publicBaseUrl,
  );
  if (!resolved.key) {
    return { kind: "invalid_path" };
  }
  if (!resolved.bodyText) {
    return { kind: "missing_body", key: resolved.key };
  }

  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(resolved.bodyText) as unknown;
  } catch {
    return { kind: "invalid_body_json" };
  }

  return {
    kind: "ok",
    row,
    key: resolved.key,
    etag: buildTestDetailEtag(row, resolved.etag),
    payload: mergeTestDetailPayload(row, bodyJson),
  };
}
