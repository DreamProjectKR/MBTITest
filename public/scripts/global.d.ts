/** Globals set by config.js and include-partials.js. */
declare global {
  interface Window {
    partialsReady?: boolean;
    ASSETS_BASE?: string;
    buildAssetUrl?: (
      path: string,
      resizeRaw?: string,
      versionRaw?: string,
    ) => string;
    API_TESTS_BASE?: string;
    TEST_INDEX_URL?: string;
    getTestIndex?: () => Promise<{ tests?: unknown[] }>;
    applyAssetAttributes?: (el: Element) => void;
    parseResizeOptions?: (raw: string) => Record<string, string>;
    assetUrl?: (path: string) => string;
    assetResizeUrl?: (
      path: string,
      options?: Record<string, unknown>,
    ) => string;
  }
}

export {};
