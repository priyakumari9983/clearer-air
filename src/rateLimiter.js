/** Sliding-window limiter with a hard cap on tracked keys, so memory stays bounded. */
export function createRateLimiter({ limit, windowMs, maxKeys = 5000, now = Date.now }) {
  const hits = new Map();
  return function isLimited(key) {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    recent.push(t);
    hits.delete(key); // re-insert so the oldest key is always first
    hits.set(key, recent);
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
    return recent.length > limit;
  };
}
