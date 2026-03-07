import type { D1Database } from "../../_types.ts";

import {
  type TestMeta,
  computeTestsIndexEtag,
  mapRowToTestMeta,
} from "../../domain/tests/listPayload.ts";
import { listTestMetadata } from "../../infrastructure/repositories/d1/testMetadataRepository.ts";

export async function listPublishedTestsQuery(
  db: D1Database,
): Promise<{ tests: TestMeta[]; etag: string }> {
  const rows = await listTestMetadata(db, { publishedOnly: true });
  const tests = rows.map(mapRowToTestMeta);
  return { tests, etag: computeTestsIndexEtag(tests) };
}
