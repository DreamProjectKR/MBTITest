/** In-memory KV stub for tests (get/put/delete). */
export function createMemoryKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, _options) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

export const createMemoryKV = createMemoryKv;
