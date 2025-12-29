import type { PagesContext } from "../types/bindings.d.ts";

export interface UploadBytes {
  bytes: Uint8Array;
  contentType: string;
}

export function extensionFromMime(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return "png";
}

export async function readUploadBytes(context: PagesContext): Promise<UploadBytes | null> {
  const contentTypeHeader = context.request.headers.get("content-type") || "";
  const isMultipart = contentTypeHeader.toLowerCase().startsWith("multipart/form-data");

  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return null;
    const buffer = await file.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return null;
    return { bytes: new Uint8Array(buffer), contentType: file.type || "application/octet-stream" };
  }

  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { bytes: new Uint8Array(buffer), contentType: contentTypeHeader || "application/octet-stream" };
}


