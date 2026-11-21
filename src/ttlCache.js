/** Tiny TTL + size-bounded cache (insertion-order eviction). */
export function createTtlCache({ ttlMs, maxEntries, now = Date.now }) {
  const store = new Map();
  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now()) { store.delete(key); return undefined; }
      return entry.value;
    },
    set(key, value) {
      store.delete(key);
      store.set(key, { value, expires: now() + ttlMs });
      if (store.size > maxEntries) store.delete(store.keys().next().value);
    },
  };
}
