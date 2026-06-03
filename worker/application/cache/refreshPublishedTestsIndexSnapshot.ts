import type { MbtiEnv, PagesContext } from "../../_types.ts";

import { putAsset } from "../../infrastructure/repositories/r2/assetRepository.ts";
import { listPublishedTestsQuery } from "../queries/listPublishedTests.ts";

type SnapshotContext = Pick<PagesContext<MbtiEnv>, "env" | "waitUntil">;

const INDEX_SNAPSHOT_KEY = "assets/index.json";

/** I/O: best-effort R2 snapshot for fast `GET /assets/index.json` reads. */
export function refreshPublishedTestsIndexSnapshot(
  context: SnapshotContext,
): void {
  const db = context.env.MBTI_DB;
  const bucket = context.env.MBTI_BUCKET;
  if (!db || !bucket) return;

  context.waitUntil(
    (async () => {
      try {
        const { tests } = await listPublishedTestsQuery(db);
        const body = new TextEncoder().encode(JSON.stringify({ tests }));
        await putAsset(bucket, INDEX_SNAPSHOT_KEY, body, "application/json");
      } catch {
        // Best effort: Pages/API remain source of truth.
      }
    })(),
  );
}
