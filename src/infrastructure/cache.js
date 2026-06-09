import { LRUCache } from 'lru-cache';
import { metrics } from './metrics.js';

// ──────────────────────────────────────────────────────────────
// In-Memory Cache Wrapper
// ──────────────────────────────────────────────────────────────

/**
 * In-memory cache used for high-performance data (e.g. RBAC).
 * Uses lru-cache to enforce hard memory limits and automatic TTL eviction.
 */
const memoryCache = new LRUCache({
  max: 1000, // maximum number of entries
  ttl: 1000 * 60 * 5, // 5 minutes default TTL
});

/**
 * Retrieve a cached value by key.
 *
 * @param {string} key - Cache key
 * @returns {Promise<unknown | null>} Value or null on miss
 */
const cacheGet = async (key) => {
  const val = memoryCache.get(key);
  if (val !== undefined && val !== null) {
    metrics.cache.hits += 1;
    return val;
  }
  metrics.cache.misses += 1;
  return null;
};

/**
 * Store a value in cache with a TTL.
 *
 * @param {string} key - Cache key
 * @param {unknown} value - Value to cache
 * @param {number} [ttlSeconds=300] - Time-to-live in seconds
 * @returns {Promise<void>}
 */
const cacheSet = async (key, value, ttlSeconds = 300) => {
  memoryCache.set(key, value, { ttl: ttlSeconds * 1000 });
};

/**
 * Delete a specific cache entry.
 *
 * @param {string} key - Cache key to invalidate
 * @returns {Promise<void>}
 */
const cacheDel = async (key) => {
  memoryCache.delete(key);
};

/**
 * Atomically increment a numeric value in the cache.
 *
 * @param {string} key - Cache key
 * @returns {Promise<number>} The new value after incrementing
 */
const cacheIncr = async (key) => {
  let val = memoryCache.get(key);
  if (typeof val !== 'number') {
    val = parseInt(val, 10);
    if (Number.isNaN(val)) val = 0;
  }
  val += 1;
  memoryCache.set(key, val, { ttl: 1000 * 60 * 60 * 24 * 365 }); // 1 year fallback TTL
  return val;
};

export { cacheGet, cacheSet, cacheDel, cacheIncr };
