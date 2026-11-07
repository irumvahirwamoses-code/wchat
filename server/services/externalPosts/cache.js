const cache = new Map();

function keyOf(parts) {
  return parts.filter(Boolean).join(':').toLowerCase();
}

export function getCache(key, ttlMs = 10 * 60 * 1000) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data) {
  cache.set(key, { at: Date.now(), data });
}

export function makeKey(provider, query, page, perPage) {
  return keyOf([provider, query, page, perPage]);
}
