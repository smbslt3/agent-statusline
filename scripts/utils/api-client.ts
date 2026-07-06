/**
 * OAuth API client with three-tier caching
 * @tested scripts/__tests__/api-client.test.ts
 */
import { execFile } from 'child_process';
import { join } from 'path';
import { NEGATIVE_CACHE_SECONDS, type UsageLimits, type ExtraUsage, type CacheEntry } from '../types.js';
import { getCredentials } from './credentials.js';
import { hashToken } from './hash.js';
import { findExecutable, pathExists } from './spawn-cli.js';
import { VERSION } from '../version.js';
import { debugLog } from './debug.js';
import {
  loadFileCache as loadFileCacheGeneric,
  saveFileCache as saveFileCacheGeneric,
  fileCachePath,
  STALE_CACHE_TTL_SECONDS,
} from './file-cache.js';

const API_URL = 'https://api.anthropic.com/api/oauth/usage';
const API_TIMEOUT_MS = 5000;
const MAX_RETRY_AFTER_MS = 10000;
const STALE_FALLBACK_SECONDS = STALE_CACHE_TTL_SECONDS;

/**
 * In-memory cache Map: tokenHash -> CacheEntry
 */
const usageCacheMap: Map<string, CacheEntry<UsageLimits>> = new Map();

/**
 * Pending API requests Map: tokenHash -> Promise
 * Prevents duplicate concurrent requests for the same token
 */
const pendingRequests: Map<string, Promise<UsageLimits | null>> = new Map();

/**
 * Last used token hash for fallback when credentials are unavailable
 */
let lastTokenHash: string | null = null;

/**
 * Get cache file path for a specific token hash.
 * Delegates path composition to the shared file-cache utility.
 */
function getCacheFilePath(tokenHash: string): string {
  return fileCachePath(`cache-${tokenHash}.json`);
}

/**
 * Check if cache is still valid for given token.
 * Error entries use a shorter TTL (NEGATIVE_CACHE_SECONDS) to allow
 * retries after a brief cooldown, while preventing rapid-fire API calls.
 */
function isCacheValid(tokenHash: string, ttlSeconds: number): boolean {
  const cache = usageCacheMap.get(tokenHash);
  if (!cache) return false;
  const ageSeconds = (Date.now() - cache.timestamp) / 1000;
  const effectiveTtl = cache.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
  return ageSeconds < effectiveTtl;
}

/**
 * Fetch usage limits from Anthropic API
 *
 * @param ttlSeconds - Cache TTL in seconds (default: 300)
 * @returns Usage limits or null if failed
 */
export async function fetchUsageLimits(ttlSeconds: number = 300): Promise<UsageLimits | null> {
  // Get token first to determine cache key
  const token = await getCredentials();

  // Credential lookup failed - try to return cached data with last known token
  if (!token) {
    if (lastTokenHash) {
      const cached = usageCacheMap.get(lastTokenHash);
      if (cached && !cached.isError) return cached.data;

      const fileCache = await loadFileCache(lastTokenHash, STALE_FALLBACK_SECONDS);
      if (fileCache) return fileCache;
    }
    return null;
  }

  const tokenHash = hashToken(token);
  lastTokenHash = tokenHash;

  // Check memory cache first (includes negative cache entries)
  if (isCacheValid(tokenHash, ttlSeconds)) {
    const cached = usageCacheMap.get(tokenHash);
    if (cached) {
      if (cached.isError) {
        debugLog('api', 'Negative cache hit, returning stale or null');
        return loadFileCache(tokenHash, STALE_FALLBACK_SECONDS);
      }
      return cached.data;
    }
  }

  // Try to load from file cache (for persistence across calls)
  const fileCacheRaw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  if (fileCacheRaw) {
    usageCacheMap.set(tokenHash, { data: fileCacheRaw.data, timestamp: fileCacheRaw.timestamp });
    return fileCacheRaw.data;
  }

  // Check if there's already a pending request for this token
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }

  // Create new API request
  const requestPromise = fetchFromApi(token, tokenHash);
  pendingRequests.set(tokenHash, requestPromise);

  try {
    const result = await requestPromise;
    if (result) return result;

    // Save stale reference before overwriting with negative cache
    const staleMemory = usageCacheMap.get(tokenHash);

    // API failed - set negative cache to prevent rapid retries
    debugLog('api', `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    usageCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true,
    });

    // Fall back to stale cache
    if (staleMemory && !staleMemory.isError) return staleMemory.data;

    const staleFile = await loadFileCache(tokenHash, STALE_FALLBACK_SECONDS);
    if (staleFile) return staleFile;

    return null;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}

/**
 * Make a single API request using Node.js fetch
 */
async function makeRequest(token: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `agent-statusline/${VERSION}`,
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Trusted, fully-qualified curl locations, checked before any PATH lookup so we
 * never hand the OAuth token to a same-named executable planted earlier in PATH.
 */
function trustedCurlPaths(): string[] {
  if (process.platform === 'win32') {
    const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
    return [join(sysRoot, 'System32', 'curl.exe')];
  }
  return ['/usr/bin/curl', '/bin/curl', '/usr/local/bin/curl', '/opt/homebrew/bin/curl'];
}

/**
 * Resolve curl to an absolute path: a trusted system location if present, else
 * an absolute path from a PATH scan. Returns null when curl is unavailable.
 */
async function resolveCurl(): Promise<string | null> {
  for (const candidate of trustedCurlPaths()) {
    if (await pathExists(candidate)) return candidate;
  }
  // Last resort: PATH scan (still yields an absolute path). The token is passed
  // via stdin, not argv, so it never reaches the process table even here.
  return findExecutable(['curl']);
}

/**
 * Fallback API request using curl subprocess.
 *
 * Some environments (e.g. Node.js 20+ on Linux) get HTTP 403 from
 * Anthropic's OAuth usage endpoint due to TLS fingerprint differences
 * between Node's built-in HTTP client (undici) and standard clients
 * like curl/wget/Python. This fallback uses curl as a subprocess to
 * work around the issue.
 *
 * Security: the bearer token is passed to curl out-of-band via stdin
 * (`curl -K -`), NOT as a command-line argument, so it never appears in the
 * process table (`ps` / `/proc/<pid>/cmdline`) where other local users could
 * read it. curl is also resolved to a trusted absolute path.
 */
async function makeRequestViaCurl(token: string): Promise<{ ok: boolean; status: number; data: unknown } | null> {
  const curlPath = await resolveCurl();
  if (!curlPath) {
    debugLog('api', 'curl not found, skipping fallback');
    return null;
  }
  return new Promise((resolve) => {
    const child = execFile(
      curlPath,
      [
        '-s',
        '-w', '\n%{http_code}',
        '-K', '-', // read the Authorization header from stdin (kept off argv)
        API_URL,
        '-H', 'Accept: application/json',
        '-H', `User-Agent: agent-statusline/${VERSION}`,
        '-H', 'anthropic-beta: oauth-2025-04-20',
      ],
      { encoding: 'utf-8', timeout: API_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          // Log only the error code: the raw error object echoes argv + stderr,
          // which historically leaked the token. Never log it verbatim.
          debugLog('api', 'curl fallback failed', { code: (error as NodeJS.ErrnoException).code });
          resolve(null);
          return;
        }
        try {
          const lines = stdout.trimEnd().split('\n');
          const statusCode = parseInt(lines[lines.length - 1], 10);
          const body = lines.slice(0, -1).join('\n');
          const data = JSON.parse(body);
          resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode, data });
        } catch {
          debugLog('api', 'curl response parse failed');
          resolve(null);
        }
      }
    );

    // Ensure child process is cleaned up on timeout
    child.on('error', () => resolve(null));

    // Feed the secret header via stdin (curl reads it as a config file), then EOF.
    // Strip any CR/LF/quote so a malformed token can't break the config syntax.
    try {
      const safeToken = token.replace(/[\r\n"]/g, '');
      child.stdin?.end(`header = "Authorization: Bearer ${safeToken}"\n`);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Internal function to fetch from API with single retry on 429
 * and curl fallback on 403 (TLS fingerprint rejection)
 */
async function fetchFromApi(token: string, tokenHash: string): Promise<UsageLimits | null> {
  try {
    let response = await makeRequest(token);

    // Retry once on 429 if retry-after is short enough
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      if (retryAfterHeader === null) {
        debugLog('api', '429 received, no retry-after header, skipping');
      } else {
        const retryAfter = parseInt(retryAfterHeader, 10);
        if (!isNaN(retryAfter) && retryAfter * 1000 <= MAX_RETRY_AFTER_MS) {
          debugLog('api', `429 received, retrying after ${retryAfter}s`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          response = await makeRequest(token);
        } else {
          debugLog('api', `429 received, retry-after ${retryAfter}s exceeds limit, skipping`);
        }
      }
    }

    // On 403, Node's TLS fingerprint may be rejected — fall back to curl
    if (response.status === 403) {
      debugLog('api', '403 from fetch, trying curl fallback');
      const curlResult = await makeRequestViaCurl(token);
      if (curlResult?.ok) {
        return parseAndCacheLimits(curlResult.data, tokenHash);
      }
      debugLog('api', `curl fallback ${curlResult ? `returned ${curlResult.status}` : 'failed'}`);
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return parseAndCacheLimits(data, tokenHash);
  } catch (error) {
    debugLog('api', 'Request failed', error);
    return null;
  }
}

/**
 * A single normalized rate-limit window, shared by both the new `limits[]`
 * array entries and the legacy flat fields once validated.
 */
type LimitWindow = { utilization: number; resets_at: string | null } | null;

/**
 * Validate a single legacy flat rate-limit window (`d.five_hour` etc).
 * Returns a valid window object or null. Kept as the fallback path for
 * accounts/responses that haven't migrated to the `limits[]` array yet.
 */
function validateLimitWindow(raw: unknown): LimitWindow {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.utilization !== 'number') return null;
  return {
    utilization: w.utilization,
    resets_at: typeof w.resets_at === 'string' ? w.resets_at : null,
  };
}

/**
 * Validate the legacy flat `extra_usage` block (paid overage credits).
 * Returns null when absent/malformed. Kept as the fallback path for
 * responses that haven't migrated to the `spend` object yet.
 */
function validateExtraUsage(raw: unknown): ExtraUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  // Newer flat blocks express credit amounts in minor units alongside a
  // `decimal_places` factor (e.g. used_credits: 4241, decimal_places: 2 →
  // $42.41); older blocks omit it and are already in major units, so scale
  // only when it is present. `utilization` is a percent — never scaled.
  const scale = typeof x.decimal_places === 'number' ? 10 ** x.decimal_places : 1;
  const major = (v: unknown): number | null => (typeof v === 'number' ? v / scale : null);
  return {
    is_enabled: x.is_enabled === true,
    used_credits: major(x.used_credits),
    monthly_limit: major(x.monthly_limit),
    utilization: typeof x.utilization === 'number' ? x.utilization : null,
    currency: typeof x.currency === 'string' ? x.currency : null,
  };
}

/**
 * Read the new canonical `limits` array off the raw response and return it as
 * a plain array of records, or `[]` when absent/malformed/empty. Never throws.
 */
function readLimitsArray(d: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(d.limits)) return [];
  return d.limits.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
}

/**
 * Build a single normalized window from a `limits[]` entry, mapping its
 * `percent` field to `utilization`. Returns null on malformed entries.
 */
function windowFromLimitsEntry(entry: Record<string, unknown> | undefined): LimitWindow {
  if (!entry || typeof entry.percent !== 'number') return null;
  return {
    utilization: entry.percent,
    resets_at: typeof entry.resets_at === 'string' ? entry.resets_at : null,
  };
}

/**
 * Read the model display name from a `limits[]` entry's `scope`, or null when
 * the entry is not model-scoped. Used to route `weekly_scoped` windows (e.g.
 * Fable, Sonnet) to their per-model widgets.
 */
function readScopeModel(entry: Record<string, unknown>): string | null {
  const scope = entry.scope;
  if (!scope || typeof scope !== 'object') return null;
  const model = (scope as Record<string, unknown>).model;
  if (!model || typeof model !== 'object') return null;
  const name = (model as Record<string, unknown>).display_name;
  return typeof name === 'string' ? name : null;
}

/** True when a `limits[]` entry is a model-scoped weekly window. */
function isScopedWeeklyEntry(entry: Record<string, unknown>): boolean {
  return entry.kind === 'weekly_scoped' || readScopeModel(entry) !== null;
}

/**
 * Resolve a model-scoped weekly window (a `weekly_scoped` entry whose scope
 * model display name matches `family`, case-insensitive substring — e.g.
 * 'fable', 'sonnet'). Returns null when no such scoped window is present.
 */
function scopedWeeklyWindow(limitsArr: Record<string, unknown>[], family: string): LimitWindow {
  const entry = limitsArr.find((e) => {
    const model = readScopeModel(e);
    return model !== null && model.toLowerCase().includes(family);
  });
  return windowFromLimitsEntry(entry);
}

/**
 * Resolve the 5h (session) window: prefer the `limits[]` entry with
 * group/kind === 'session', fall back to the legacy flat `five_hour` field.
 */
function resolveFiveHour(d: Record<string, unknown>, limitsArr: Record<string, unknown>[]): LimitWindow {
  const entry = limitsArr.find((e) => e.group === 'session' || e.kind === 'session');
  const fromLimits = windowFromLimitsEntry(entry);
  if (fromLimits) return fromLimits;
  return validateLimitWindow(d.five_hour);
}

/**
 * Resolve the 7d (all-models weekly) window: prefer the `limits[]` entry with
 * kind === 'weekly_all' (or an unscoped weekly entry), fall back to the legacy
 * flat `seven_day` field. Model-scoped weekly windows (Fable/Sonnet) are
 * explicitly excluded so they can't be mistaken for the all-models window.
 */
function resolveSevenDay(d: Record<string, unknown>, limitsArr: Record<string, unknown>[]): LimitWindow {
  const entry = limitsArr.find(
    (e) => e.kind === 'weekly_all' || (e.group === 'weekly' && !isScopedWeeklyEntry(e))
  );
  const fromLimits = windowFromLimitsEntry(entry);
  if (fromLimits) return fromLimits;
  return validateLimitWindow(d.seven_day);
}

/**
 * Resolve the 7d-Sonnet window: prefer the `limits[]` `weekly_scoped` entry
 * scoped to Sonnet, fall back to the flat `seven_day_sonnet` field. Most
 * accounts have neither (null).
 */
function resolveSevenDaySonnet(d: Record<string, unknown>, limitsArr: Record<string, unknown>[]): LimitWindow {
  return scopedWeeklyWindow(limitsArr, 'sonnet') ?? validateLimitWindow(d.seven_day_sonnet);
}

/**
 * Resolve the 7d-Fable window (the Fable counterpart to 7d-Sonnet): prefer the
 * `limits[]` `weekly_scoped` entry scoped to Fable, fall back to a flat
 * `seven_day_fable` field should the API ever add one. Most accounts have
 * neither (null).
 */
function resolveSevenDayFable(d: Record<string, unknown>, limitsArr: Record<string, unknown>[]): LimitWindow {
  return scopedWeeklyWindow(limitsArr, 'fable') ?? validateLimitWindow(d.seven_day_fable);
}

/**
 * Read the new canonical `spend` object off the raw response, or null when
 * absent/malformed.
 */
function readSpend(d: Record<string, unknown>): Record<string, unknown> | null {
  if (!d.spend || typeof d.spend !== 'object') return null;
  return d.spend as Record<string, unknown>;
}

/**
 * Convert a `{ amount_minor, exponent }` money object to major currency units
 * (e.g. { amount_minor: 4241, exponent: 2 } → 42.41). `exponent` defaults to 2
 * (the standard ISO 4217 minor-unit factor, e.g. USD cents) when absent —
 * defaulting to 0 would render `amount_minor` as if it were already a major
 * amount, contradicting its own name. Returns null when the value is missing or
 * carries no numeric `amount_minor`.
 */
function minorToMajor(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.amount_minor !== 'number') return null;
  const exponent = typeof m.exponent === 'number' ? m.exponent : 2;
  return m.amount_minor / 10 ** exponent;
}

/**
 * Build ExtraUsage from the new `spend` object. Amounts are money objects
 * (`{ amount_minor, exponent }`), NOT plain numbers, and are converted to major
 * currency units. The cap comes from `spend.limit`, else the credit/money caps
 * nested under `spend.cap`. Never throws on missing sub-fields.
 */
function extraUsageFromSpend(spend: Record<string, unknown>): ExtraUsage {
  const used = spend.used && typeof spend.used === 'object' ? (spend.used as Record<string, unknown>) : null;
  const usedCredits = minorToMajor(used);
  const currency = used && typeof used.currency === 'string' ? (used.currency as string) : null;

  // Cap: prefer spend.limit, else the credit/money caps nested under spend.cap.
  let monthlyLimit = minorToMajor(spend.limit);
  if (monthlyLimit === null && spend.cap && typeof spend.cap === 'object') {
    const cap = spend.cap as Record<string, unknown>;
    monthlyLimit = minorToMajor(cap.credits) ?? minorToMajor(cap.money);
  }

  return {
    is_enabled: spend.enabled === true,
    used_credits: usedCredits,
    monthly_limit: monthlyLimit,
    utilization: typeof spend.percent === 'number' ? spend.percent : null,
    currency,
  };
}

/**
 * Resolve ExtraUsage: prefer the new `spend` object, fall back to the legacy
 * flat `extra_usage` block.
 */
function resolveExtraUsage(d: Record<string, unknown>): ExtraUsage | null {
  const spend = readSpend(d);
  if (spend) return extraUsageFromSpend(spend);
  return validateExtraUsage(d.extra_usage);
}

/**
 * Parse API response and update caches.
 *
 * The API is mid-migration: newer responses carry a canonical `limits[]`
 * array (per-window `{kind, group, percent, resets_at}` entries) and a
 * `spend` object (paid overage), while older/dual-write responses still
 * carry the flat `five_hour`/`seven_day`/`seven_day_sonnet`/`extra_usage`
 * fields. The `limits[]`/`spend` shapes are preferred; the flat fields are
 * used only as a fallback so accounts not yet migrated keep working.
 */
async function parseAndCacheLimits(data: unknown, tokenHash: string): Promise<UsageLimits> {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const limitsArr = readLimitsArray(d);

  const limits: UsageLimits = {
    five_hour: resolveFiveHour(d, limitsArr),
    seven_day: resolveSevenDay(d, limitsArr),
    seven_day_sonnet: resolveSevenDaySonnet(d, limitsArr),
    seven_day_fable: resolveSevenDayFable(d, limitsArr),
    extra_usage: resolveExtraUsage(d),
  };

  usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
  await saveFileCache(tokenHash, limits);

  return limits;
}

/**
 * Load raw cache content from file (includes timestamp)
 */
async function loadFileCacheRaw(
  tokenHash: string,
  ttlSeconds: number
): Promise<{ data: UsageLimits; timestamp: number } | null> {
  return loadFileCacheGeneric<UsageLimits>(getCacheFilePath(tokenHash), ttlSeconds);
}

/**
 * Load cache from file for specific token
 */
async function loadFileCache(tokenHash: string, ttlSeconds: number): Promise<UsageLimits | null> {
  const raw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  return raw?.data ?? null;
}

/**
 * Save cache to file for specific token.
 * The shared utility handles cleanup of all known cache prefixes,
 * so callers don't need to schedule it separately.
 */
async function saveFileCache(tokenHash: string, data: UsageLimits): Promise<void> {
  await saveFileCacheGeneric(getCacheFilePath(tokenHash), data);
}

/**
 * Clear in-memory cache (useful for testing)
 */
export function clearCache(): void {
  usageCacheMap.clear();
}

