import type { R2Bucket } from "../../../_types.ts";

/** I/O: write binary asset to R2. */
export async function putAsset(
  bucket: R2Bucket,
  key: string,
  value: Uint8Array,
  contentType?: string,
): Promise<void> {
  await bucket.put(key, value, {
    httpMetadata: { contentType },
  });
}

/** I/O: delete asset from R2. */
export async function deleteAsset(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}
