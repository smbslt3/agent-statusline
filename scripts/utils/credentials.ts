/**
 * OAuth credential extraction with platform-specific caching
 * @tested scripts/__tests__/credentials.test.ts
 */
import { execFile } from 'child_process';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Cache TTL for keychain credentials (10 seconds).
 *
 * Keychain access (the macOS `security` subprocess) is expensive, so the result
 * is cached in-process. This dedups the token + credential-state reads WITHIN a
 * single render (getCredentials and getCredentialState share it). On the
 * long-lived agy host it also spans many renders. On the one-shot Claude host
 * each render is a fresh process, so this spans only that process by design:
 * the token is the protected secret, so it is deliberately NOT persisted to a
 * cross-process cache (a second on-disk copy would widen its exposure).
 */
const KEYCHAIN_CACHE_TTL_MS = 10_000;

/**
 * Backoff duration after keychain failure (60 seconds).
 * Prevents repeated macOS permission dialogs on keychain errors.
 */
const KEYCHAIN_BACKOFF_MS = 60_000;

/**
 * Cached credentials with mtime-based invalidation for file
 * or TTL-based invalidation for keychain
 */
let credentialsCache: {
  token: string | null;
  subscriptionType: string | null;
  mtime?: number; // For file-based cache
  timestamp?: number; // For keychain-based cache
} | null = null;

/**
 * Separate keychain backoff state.
 * When keychain fails, we skip retries for KEYCHAIN_BACKOFF_MS
 * and fall back to file-based credentials directly.
 * Stores the epoch-ms timestamp of last failure, or null if not in backoff.
 */
let keychainBackoffAt: number | null = null;

interface ParsedCredentials {
  token: string | null;
  subscriptionType: string | null;
}

function parseCredentials(raw: string): ParsedCredentials {
  const creds = JSON.parse(raw);
  const oauth = creds?.claudeAiOauth;
  return {
    token: oauth?.accessToken ?? null,
    subscriptionType: typeof oauth?.subscriptionType === 'string'
      ? oauth.subscriptionType
      : null,
  };
}

/**
 * Get OAuth access token from Claude Code credentials
 *
 * On macOS: Reads from Keychain (TTL-based cache)
 * On Linux/Windows: Reads from ~/.claude/.credentials.json (mtime-based cache)
 *
 * @returns Access token or null if not found
 */
export async function getCredentials(): Promise<string | null> {
  return (await loadCredentials())?.token ?? null;
}

/**
 * Outcome of reading the stored Claude login. `found` distinguishes a
 * successful read (the credentials store parsed) from a failure (missing file,
 * keychain error, unreadable / invalid JSON). The money-zone detection relies
 * on this distinction: an unreadable login must NOT be treated as evidence of
 * an API account (see statusline.ts).
 */
export interface CredentialState {
  /** True when the credentials store was read and parsed successfully. */
  found: boolean;
  /** Plan type recorded with the login (e.g. "pro", "max", "team"), or null. */
  subscriptionType: string | null;
}

/**
 * Read the stored Claude login, distinguishing "read failed" from "read
 * succeeded but no subscription recorded". Drives money-zone auto-detection
 * (statusline.ts): only a *successful* no-subscription read (with no usage
 * window and no ANTHROPIC_API_KEY) marks the account as API-only.
 */
export async function getCredentialState(): Promise<CredentialState> {
  const creds = await loadCredentials();
  return { found: creds !== null, subscriptionType: creds?.subscriptionType ?? null };
}

async function loadCredentials(): Promise<ParsedCredentials | null> {
  try {
    if (process.platform === 'darwin') {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}

/**
 * Run macOS `security` command asynchronously.
 * Unlike execFileSync, this does not block the event loop.
 */
function execKeychainAsync(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf-8', timeout: 3000 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      }
    );
  });
}

/**
 * Get credentials from macOS Keychain (with TTL-based cache + backoff on failure).
 * Uses async execFile to avoid blocking the event loop.
 */
async function getCredentialsFromKeychain(): Promise<ParsedCredentials | null> {
  // Check backoff: skip keychain entirely during cooldown
  if (keychainBackoffAt !== null && Date.now() - keychainBackoffAt < KEYCHAIN_BACKOFF_MS) {
    return await getCredentialsFromFile();
  }

  // Check TTL-based cache
  if (
    credentialsCache?.timestamp &&
    Date.now() - credentialsCache.timestamp < KEYCHAIN_CACHE_TTL_MS
  ) {
    return credentialsCache;
  }

  try {
    const result = await execKeychainAsync();
    const parsed = parseCredentials(result);

    // Cache result and clear any backoff
    credentialsCache = { ...parsed, timestamp: Date.now() };
    keychainBackoffAt = null;
    return parsed;
  } catch {
    // Set backoff to suppress retries for 60 seconds
    keychainBackoffAt = Date.now();
    // Fallback to file if Keychain fails
    return await getCredentialsFromFile();
  }
}

/**
 * Get credentials from file (~/.claude/.credentials.json) with mtime-based cache
 */
async function getCredentialsFromFile(): Promise<ParsedCredentials | null> {
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json');

    // Check mtime for cache invalidation
    const fileStat = await stat(credPath);
    const mtime = fileStat.mtimeMs;

    // Return cached if mtime matches
    if (credentialsCache?.mtime === mtime) {
      return credentialsCache;
    }

    const content = await readFile(credPath, 'utf-8');
    const parsed = parseCredentials(content);

    // Cache result
    credentialsCache = { ...parsed, mtime };
    return parsed;
  } catch {
    return null;
  }
}
