export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface D1Result<T> {
  results?: T[];
  success?: boolean;
  changes?: number;
  last_row_id?: number;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<Record<string, unknown>>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface R2HttpMetadata {
  contentType?: string;
  cacheControl?: string;
}

export interface R2ObjectBody {
  body: ReadableStream<Uint8Array> | null;
  etag?: string;
  httpMetadata?: R2HttpMetadata;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>,
    options?: R2PutOptions,
  ): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{
    objects: Array<{
      key: string;
      size?: number;
      etag?: string;
      uploaded?: string | Date;
    }>;
  }>;
}

export interface Env {
  MBTI_DB: D1Database;
  MBTI_BUCKET: R2Bucket;
  ADMIN_TOKEN?: string;
  EMIT_INDEX_ON_SAVE?: string;
  ASSETS_BASE?: string;
  R2_PUBLIC_BASE_URL?: string;
}

export interface PagesContext<Params extends Record<string, string | string[] | undefined> = {}> {
  request: Request;
  env: Env;
  params: Params;
  waitUntil(promise: Promise<unknown>): void;
}


