export function installDefaultCacheStub(overrides = {}) {
  const calls = {
    match: [],
    put: [],
    delete: [],
  };
  globalThis.caches = {
    default: {
      async match(request) {
        calls.match.push(request);
        if (typeof overrides.match === "function") {
          return overrides.match(request);
        }
        return null;
      },
      async put(request, response) {
        calls.put.push({ request, response });
        if (typeof overrides.put === "function") {
          return overrides.put(request, response);
        }
      },
      async delete(request) {
        calls.delete.push(request);
        if (typeof overrides.delete === "function") {
          return overrides.delete(request);
        }
        return true;
      },
    },
  };
  return calls;
}

export function createContext({
  url,
  method = "GET",
  env = {},
  params = {},
  headers = {},
  body,
  waitUntil,
}) {
  return {
    request: new Request(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
    }),
    env,
    params,
    waitUntil: waitUntil || (() => {}),
  };
}

export function createIndexDb(rows) {
  return {
    prepare(query) {
      return {
        bind() {
          return this;
        },
        async all() {
          const publishedOnly = query.includes("WHERE is_published = 1");
          return {
            results:
              publishedOnly ?
                rows.filter((row) => Boolean(row.is_published))
              : rows,
          };
        },
        async first() {
          return null;
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

export function createDetailDb(row) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return row;
        },
        async all() {
          return { results: [] };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

export function createSaveDb(options = {}) {
  const calls = [];
  return {
    calls,
    db: {
      prepare(query) {
        return {
          bind(...args) {
            calls.push({ type: "bind", query, args });
            return this;
          },
          async first() {
            return typeof options.first === "function" ?
                options.first(query)
              : null;
          },
          async all() {
            if (typeof options.all === "function") {
              return options.all(query);
            }
            return { results: [] };
          },
        };
      },
      async batch(statements) {
        calls.push({ type: "batch", statements });
        if (typeof options.batch === "function") {
          return options.batch(statements);
        }
        return [];
      },
    },
  };
}

export function createJsonBucket(initialEntries = {}) {
  const objects = new Map(Object.entries(initialEntries));
  const calls = {
    get: [],
    put: [],
    delete: [],
    list: [],
  };

  return {
    calls,
    bucket: {
      async get(key, options) {
        calls.get.push({ key, options });
        if (!objects.has(key)) return null;
        const value = objects.get(key);
        return {
          etag: `etag-${key}`,
          size: typeof value === "string" ? value.length : 0,
          body: {},
          httpMetadata: {},
          async text() {
            return value;
          },
        };
      },
      async put(key, value) {
        calls.put.push({ key, value });
        const text =
          value instanceof Uint8Array ? new TextDecoder().decode(value)
          : typeof value === "string" ? value
          : String(value ?? "");
        objects.set(key, text);
      },
      async delete(key) {
        calls.delete.push(key);
        objects.delete(key);
      },
      async list() {
        calls.list.push(true);
        return { objects: [] };
      },
    },
    objects,
  };
}
