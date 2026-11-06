/**
 * Shared fetch-cache shell for local usage clients (currently the Antigravity
 * quota client). Provides a five-stage memory/file cache + request-dedup +
 * negative-cache + stale-fallback flow so clients don't reimplement it.
 *
 * CRITICAL: the file-cache and negative-cache imports are resolved INSIDE this
 * module so that a test's `vi.doMock('../utils/file-cache.js')` (set up before
 * the client under test is imported) still intercepts the calls made here.
 *
 */

import { loadFileCache, saveFileCache, STALE_CACHE_TTL_SECONDS } from './file-cache.js';
import { NEGATIVE_CACHE_SECONDS } from '../types.js';
import type { CacheEntry } from '../types.js';
import { debugLog } from './debug.js';

interface WithUsageCacheOptions<T> {
  /** Memory + file cache key (e.g. token hash or 'local'). */
  key: string;
  /** Resolved on-disk cache file path (caller computes via fileCachePath). */
  cacheFile: string;
  /** Fresh-cache TTL in seconds. */
  ttlSeconds: number;
  /** Per-client in-process memory cache map. */
  memoryCache: Map<string, CacheEntry<T>>;
  /** Per-client in-flight request dedup map. */
  pendingRequests: Map<string, Promise<T | null>>;
  /** debugLog context tag (e.g. 'antigravity'). */
  debugTag: string;
  /** Performs the actual fetch; returns null on failure. */
  collect: () => Promise<T | null>;
}

/**
 * Run `collect()` behind the standard three-tier cache shell:
 *
 * (a) memory cache — honors NEGATIVE_CACHE_SECONDS for error entries vs
 *     ttlSeconds for good entries; returns null on a fresh negative-cache hit;
 * (b) file cache hit (loadFileCache, ttlSeconds);
 * (c) pendingRequests dedup;
 * (d) collect() success → set memory cache + saveFileCache + return;
 * (e) collect() null → set negative memory cache, then fall back to a prior
 *     good memory entry, else a stale file entry (STALE_CACHE_TTL_SECONDS),
 *     else null.
 */
export async function withUsageCache<T>(opts: WithUsageCacheOptions<T>): Promise<T | null> {
  const { key, cacheFile, ttlSeconds, memoryCache, pendingRequests, debugTag, collect } = opts;

  const cached = memoryCache.get(key);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog(debugTag, 'negative cache hit');
        return null;
      }
      return cached.data;
    }
  }

  const fromFile = await loadFileCache<T>(cacheFile, ttlSeconds);
  if (fromFile) {
    memoryCache.set(key, { data: fromFile.data, timestamp: fromFile.timestamp });
    return fromFile.data;
  }

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const requestPromise = (async () => {
    const result = await collect();
    if (result) {
      memoryCache.set(key, { data: result, timestamp: Date.now() });
      await saveFileCache(cacheFile, result);
      return result;
    }

    memoryCache.set(key, {
      data: null,
      timestamp: Date.now(),
      isError: true,
    });

    if (cached && !cached.isError) return cached.data;

    const staleFile = await loadFileCache<T>(cacheFile, STALE_CACHE_TTL_SECONDS);
    return staleFile?.data ?? null;
  })();

  pendingRequests.set(key, requestPromise);
  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(key);
  }
}

/**
 * Extract a trimmed model name from a settings-like JSON object. Accepts both
 * `model: "name"` and `model: { name: "name" }` shapes, then falls back to a
 * top-level `selectedModel` string. Returns null when no usable value is found.
 */
export function pickSettingsModel(jsonLike: {
  model?: string | { name?: string } | null;
  selectedModel?: string | null;
} | null | undefined): string | null {
  const model = typeof jsonLike?.model === 'string'
    ? jsonLike.model
    : jsonLike?.model?.name || jsonLike?.selectedModel;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
}
