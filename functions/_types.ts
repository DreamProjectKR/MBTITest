/**
 * Minimal Cloudflare Pages Functions types.
 * We avoid `any` completely; everything unknown is `unknown`.
 *
 * This is intentionally structural (no dependency on external type packages).
 */

export type PagesParams = Record<string, string | string[] | undefined>;

export type HeadersInit =
  | Headers
  | Record<string, string>
  | Array<[string, string]>;

export interface PagesContext<Env, Params extends PagesParams = PagesParams> {
  request: Request;
  env: Env;
  params?: Params;
  waitUntil(promise: Promise<unknown>): void;
}

export interface R2HttpMetadata {
  contentType?: string;
  cacheControl?: string;
}

export interface R2ObjectBody {
  // `ReadableStream<Uint8Array>` in CF runtime; keep structural.
  readonly locked?: boolean;
}

export interface R2Object {
  etag?: string;
  size?: number;
  body: R2ObjectBody | null;
  httpMetadata?: R2HttpMetadata;
  text(): Promise<string>;
}

export interface R2BucketListObject {
  key: string;
  size?: number;
  etag?: string;
  uploaded?: string | Date | null;
}

export interface R2BucketListResult {
  objects: R2BucketListObject[];
}

/** Optional range for R2 get (partial content). */
export interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

export interface R2Bucket {
  get(
    key: string,
    options?: { range?: R2Range | Headers },
  ): Promise<R2Object | null>;
  list(options: { prefix: string }): Promise<R2BucketListResult>;
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: R2HttpMetadata },
  ): Promise<void>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

/** D1 batch result shape (one element per statement). */
export interface D1Result {
  results?: unknown[];
  success?: boolean;
  meta?: unknown;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface MbtiEnv {
  MBTI_BUCKET?: R2Bucket;
  mbti_db?: D1Database;
  MBTI_KV?: KVNamespace;
  ASSETS_BASE?: string;
  R2_PUBLIC_BASE_URL?: string;
}
