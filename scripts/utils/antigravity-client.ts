/**
 * Antigravity CLI (`agy`) / IDE credit-balance client.
 *
 * Feeds ONLY the `agentCredits` low-balance warning. agy's quota, agent_state,
 * subagents, and tasks are streamed in stdin (see agy-stdin.ts); the one thing
 * stdin omits is the credit balance, so this client fetches it from the local
 * Antigravity language server — a Connect-RPC endpoint on 127.0.0.1
 * (`exa.language_server_pb.LanguageServerService/GetUserStatus`) that, while
 * Antigravity is running, reports `userTier.availableCredits` (and per-model
 * quota, which we no longer rely on). Invoked lazily, only when the
 * `agentCredits` widget is in the layout. Live-verified on 2026-06-13. The
 * same RPC is used by CodexBar, openusage, and several Antigravity usage
 * extensions.
 *
 * Safety properties: loopback-only HTTP(S) (self-signed certs accepted for
 * 127.0.0.1 only), no credential files read, no external endpoints, no
 * processes spawned other than the OS process/port listing commands. When no
 * server is running this degrades to the settings model-name fallback (and the
 * credits widget simply hides).
 *
 * @tested scripts/__tests__/antigravity-client.test.ts
 */

import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import https from 'https';
import os from 'os';
import path from 'path';
import { type AntigravityUsageLimits, type CacheEntry } from '../types.js';
import { fileCachePath } from './file-cache.js';
import { debugLog } from './debug.js';
import { findExecutable, pathExists } from './spawn-cli.js';
import { pickSettingsModel, withUsageCache } from './usage-cache.js';

// Single shared cache key/file: the agy quota is a property of the local
// machine, not of any one session. Concurrently-starting agy processes may each
// run one discovery probe before the first writes this file — a bounded
// (PROBE_DEADLINE_MS), self-limiting cold-start cost gated behind the lone
// agentCredits widget, accepted in preference to a cross-process lock.
const ANTIGRAVITY_USAGE_CACHE_KEY = 'local';
const ANTIGRAVITY_USAGE_CACHE_FILE = fileCachePath('antigravity-usage-local.json');
const ANTIGRAVITY_EXECUTABLES = ['agy', 'antigravity', 'antigravity-cli'];

const RPC_SERVICE_PATH = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const RPC_REQUEST_TIMEOUT_MS = 2000;
const MAX_PROBE_PORTS = 8;
const DISCOVERY_TIMEOUT_MS = 5000;
/**
 * Aggregate wall-clock budget for all per-port probes combined. With several
 * servers × ports each at RPC_REQUEST_TIMEOUT_MS the serial probing could
 * otherwise run far longer than any single request; this caps the total.
 */
const PROBE_DEADLINE_MS = 4000;

const antigravityCacheMap: Map<string, CacheEntry<AntigravityUsageLimits>> = new Map();
const pendingRequests: Map<string, Promise<AntigravityUsageLimits | null>> = new Map();

interface AntigravitySettings {
  selectedModel?: string;
  model?: string | {
    name?: string;
  };
}

interface ServerCandidate {
  ports: number[];
  csrfToken: string | null;
}

function resolveAntigravityHomes(): string[] {
  if (process.env.ANTIGRAVITY_HOME) return [process.env.ANTIGRAVITY_HOME];
  return [
    path.join(os.homedir(), '.gemini', 'antigravity-cli'),
    path.join(os.homedir(), '.config', 'antigravity-cli'),
  ];
}

/**
 * Get current/default Antigravity model from settings.
 * The real `agy` settings.json stores a top-level string `model`
 * (e.g. "Gemini 3.5 Flash (High)"); object shapes are accepted defensively.
 */
async function readSettingsModel(): Promise<string | null> {
  for (const home of resolveAntigravityHomes()) {
    for (const filename of ['settings.json', 'config/settings.json']) {
      try {
        const raw = await readFile(path.join(home, filename), 'utf-8');
        const json = JSON.parse(raw) as AntigravitySettings;
        const model = pickSettingsModel(json);
        if (model) return model;
      } catch {
        // Continue checking the next candidate path.
      }
    }
  }
  return null;
}

/**
 * Check whether Antigravity CLI local state or executable exists.
 * Credential/token files are intentionally ignored.
 */
export async function isAntigravityInstalled(): Promise<boolean> {
  const localState = await Promise.all(resolveAntigravityHomes().map(pathExists));
  return localState.some(Boolean)
    || Boolean(await findExecutable(ANTIGRAVITY_EXECUTABLES));
}

function runCommand(file: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    try {
      execFile(
        file,
        args,
        { timeout: DISCOVERY_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        (error, stdout) => resolve(error ? '' : String(stdout))
      );
    } catch {
      resolve('');
    }
  });
}

function extractFlag(commandLine: string, flag: string): string | null {
  const match = commandLine.match(new RegExp(`${flag}[=\\s]+("?)([^"\\s]+)\\1`));
  return match ? match[2] : null;
}

function isAntigravityCommand(name: string, commandLine: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerCmd = commandLine.toLowerCase();
  if (/^agy(\.exe)?$/.test(lowerName)) return true;
  if (lowerCmd.includes('antigravity-cli') || lowerCmd.includes('antigravity_cli')) return true;
  return lowerName.includes('language_server') && lowerCmd.includes('antigravity');
}

/**
 * Find running Antigravity language servers (the agy CLI embeds one; the IDE
 * runs a separate `language_server*` process whose command line carries the
 * CSRF token the IDE endpoint requires).
 */
async function discoverServersWindows(): Promise<ServerCandidate[]> {
  // Note: no `ConvertTo-Json -AsArray` (Windows PowerShell 5.1 lacks it);
  // a single matching process therefore serializes as a bare object.
  const script = '$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -match \'^agy(\\.exe)?$|language_server\' };'
    + '$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue;'
    + '$out = @($procs | ForEach-Object { $procId = $_.ProcessId; [pscustomobject]@{ name = $_.Name; cmd = "$($_.CommandLine)"; ports = @($conns | Where-Object { $_.OwningProcess -eq $procId } | ForEach-Object LocalPort | Sort-Object -Unique) } });'
    + 'ConvertTo-Json -InputObject $out -Compress -Depth 4';
  const stdout = await runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (!stdout.trim()) return [];

  try {
    const parsed = JSON.parse(stdout) as
      | Array<{ name?: string; cmd?: string; ports?: number[] | number }>
      | { name?: string; cmd?: string; ports?: number[] | number };
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .filter((entry) => isAntigravityCommand(entry.name ?? '', entry.cmd ?? ''))
      .map((entry) => {
        // Windows PowerShell 5.1 has no `ConvertTo-Json -AsArray`, so a single
        // listening port serializes as a bare number rather than an array.
        const portsArr = Array.isArray(entry.ports)
          ? entry.ports
          : (entry.ports != null ? [entry.ports] : []);
        return {
          ports: portsArr.filter((port) => Number.isInteger(port) && port > 0),
          csrfToken: extractFlag(entry.cmd ?? '', '--csrf_token')
            ?? extractFlag(entry.cmd ?? '', '--extension_server_csrf_token'),
        };
      })
      .filter((candidate) => candidate.ports.length > 0);
  } catch {
    return [];
  }
}

async function discoverServersPosix(): Promise<ServerCandidate[]> {
  const psOut = await runCommand('ps', ['-ax', '-o', 'pid=,command=']);
  if (!psOut.trim()) return [];

  const candidates: Array<{ pid: number; commandLine: string }> = [];
  for (const line of psOut.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match) continue;
    const commandLine = match[2];
    const binary = path.basename(commandLine.split(/\s+/)[0] ?? '');
    if (isAntigravityCommand(binary, commandLine)) {
      candidates.push({ pid: Number(match[1]), commandLine });
    }
  }

  const out: ServerCandidate[] = [];
  for (const candidate of candidates) {
    const lsofOut = await runCommand('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-p', String(candidate.pid)]);
    const ports = Array.from(new Set(
      [...lsofOut.matchAll(/:(\d+)\s+\(LISTEN\)/g)].map((m) => Number(m[1]))
    ));
    if (ports.length > 0) {
      out.push({
        ports,
        csrfToken: extractFlag(candidate.commandLine, '--csrf_token')
          ?? extractFlag(candidate.commandLine, '--extension_server_csrf_token'),
      });
    }
  }
  return out;
}

/**
 * Trust model: discovery matches agy/language_server processes by name on the
 * local machine and the RPC targets hardcoded loopback (127.0.0.1). A malicious
 * SAME-USER local process could therefore spoof the credit/quota numbers shown
 * in the status line — but no secret is sent to it (the request carries only a
 * scraped CSRF token) and no command runs. The parsed quota/credit values are
 * treated as advisory, display-only data, which is acceptable under the
 * same-uid trust model. `rejectUnauthorized:false` (see postUserStatus) is bound
 * to this loopback host alone and never to a remote or input-derived address.
 */
function discoverServers(): Promise<ServerCandidate[]> {
  return process.platform === 'win32' ? discoverServersWindows() : discoverServersPosix();
}

/**
 * POST to the local Connect-RPC endpoint. Self-signed certificates are
 * accepted because the host is hard-coded to loopback.
 */
function postUserStatus(port: number, csrfToken: string | null): Promise<unknown | null> {
  return new Promise((resolve) => {
    const request = https.request({
      host: '127.0.0.1',
      port,
      path: RPC_SERVICE_PATH,
      method: 'POST',
      rejectUnauthorized: false,
      timeout: RPC_REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        ...(csrfToken ? { 'X-Codeium-Csrf-Token': csrfToken } : {}),
      },
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    request.on('error', () => resolve(null));
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.end('{}');
  });
}

/**
 * Sum available credits from `userTier.availableCredits` (e.g. Google One AI).
 * `creditAmount` arrives as a string; entries that don't parse are skipped.
 * Returns null when no usable credit entry is present.
 */
function parseAvailableCredits(userStatus: unknown): { amount: number; type: string | null; minForUsage: number | null } | null {
  const list = (userStatus as {
    userTier?: { availableCredits?: Array<{ creditAmount?: string | number; creditType?: string; minimumCreditAmountForUsage?: string | number }> };
  })?.userTier?.availableCredits;
  if (!Array.isArray(list) || list.length === 0) return null;

  let total = 0;
  let found = false;
  let minForUsage: number | null = null;
  const types = new Set<string>();
  for (const entry of list) {
    const amount = Number(entry?.creditAmount);
    if (Number.isFinite(amount)) {
      total += amount;
      found = true;
      if (entry?.creditType) types.add(String(entry.creditType));
    }
    // The lowest usage floor across credit types drives the "low balance" gate.
    const floor = Number(entry?.minimumCreditAmountForUsage);
    if (Number.isFinite(floor)) minForUsage = minForUsage == null ? floor : Math.min(minForUsage, floor);
  }
  if (!found) return null;
  return { amount: total, type: types.size === 1 ? [...types][0] : null, minForUsage };
}

/**
 * Map a GetUserStatus response to usage limits. Exported for tests.
 */
export function parseAntigravityUserStatus(
  response: unknown,
  defaultModel: string | null
): AntigravityUsageLimits | null {
  const userStatus = (response as {
    userStatus?: {
      cascadeModelConfigData?: {
        clientModelConfigs?: Array<{
          modelName?: string;
          model?: string;
          label?: string;
          quotaInfo?: { remainingFraction?: number; resetTime?: string };
        }>;
      };
    };
  })?.userStatus;
  const configs = userStatus?.cascadeModelConfigData?.clientModelConfigs;
  const credits = parseAvailableCredits(userStatus);

  if (!Array.isArray(configs) || configs.length === 0) {
    // No live per-model quota, but a credit balance may still be reported —
    // surface it alone so the agy credits widget can render.
    if (credits) {
      return {
        model: defaultModel ?? 'antigravity',
        usedPercent: null,
        resetAt: null,
        modelCount: null,
        buckets: [],
        credits,
      };
    }
    return null;
  }

  const buckets = configs.map((config) => ({
    modelId: config.modelName ?? config.model ?? config.label,
    // remainingFraction may be omitted for some entries; treat as unknown
    // instead of rendering a false 100%-used state.
    usedPercent: typeof config.quotaInfo?.remainingFraction === 'number'
      ? Math.round((1 - config.quotaInfo.remainingFraction) * 100)
      : null,
    resetAt: config.quotaInfo?.resetTime ?? null,
  }));

  const activeBucket = buckets.find((bucket) => defaultModel && bucket.modelId === defaultModel)
    ?? buckets.find((bucket) => bucket.usedPercent !== null)
    ?? buckets[0];

  return {
    model: defaultModel ?? activeBucket?.modelId ?? 'antigravity',
    usedPercent: activeBucket?.usedPercent ?? null,
    resetAt: activeBucket?.resetAt ?? null,
    modelCount: buckets.length,
    buckets,
    credits,
  };
}

async function fetchQuotaFromLanguageServer(defaultModel: string | null): Promise<AntigravityUsageLimits | null> {
  let servers: ServerCandidate[];
  try {
    servers = await discoverServers();
  } catch (err) {
    debugLog('antigravity', 'server discovery failed', err);
    return null;
  }

  const probeDeadlineAt = Date.now() + PROBE_DEADLINE_MS;
  for (const server of servers) {
    for (const port of server.ports.slice(0, MAX_PROBE_PORTS)) {
      if (Date.now() >= probeDeadlineAt) {
        debugLog('antigravity', 'probe deadline exceeded');
        return null;
      }
      const response = await postUserStatus(port, server.csrfToken);
      if (!response) continue;
      const parsed = parseAntigravityUserStatus(response, defaultModel);
      if (parsed) {
        debugLog('antigravity', `quota via language server on port ${port}`);
        return parsed;
      }
    }
  }
  return null;
}

async function collectAntigravityUsage(): Promise<AntigravityUsageLimits | null> {
  const settingsModel = await readSettingsModel();

  // Real-time per-model quota while Antigravity (agy or IDE) is running.
  const quota = await fetchQuotaFromLanguageServer(settingsModel);
  if (quota) return quota;

  // Fallback: model-only display (no server running).
  if (settingsModel) {
    return {
      model: settingsModel,
      usedPercent: null,
      resetAt: null,
      modelCount: null,
      buckets: [],
    };
  }

  const executable = await findExecutable(ANTIGRAVITY_EXECUTABLES);
  return executable ? {
    model: 'antigravity',
    usedPercent: null,
    resetAt: null,
    modelCount: null,
    buckets: [],
  } : null;
}

/**
 * Fetch Antigravity usage limits from the local language server, falling back
 * to local settings when no server is running.
 */
export async function fetchAntigravityUsage(ttlSeconds: number = 60): Promise<AntigravityUsageLimits | null> {
  return withUsageCache<AntigravityUsageLimits>({
    key: ANTIGRAVITY_USAGE_CACHE_KEY,
    cacheFile: ANTIGRAVITY_USAGE_CACHE_FILE,
    ttlSeconds,
    memoryCache: antigravityCacheMap,
    pendingRequests,
    debugTag: 'antigravity',
    collect: collectAntigravityUsage,
  });
}

/**
 * Clear cache (for testing).
 */
export function clearAntigravityCache(): void {
  antigravityCacheMap.clear();
  pendingRequests.clear();
}
