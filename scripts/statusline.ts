#!/usr/bin/env node

/**
 * Agent Statusline Status Line
 * Displays model info, context usage, rate limits, and more
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

import type { StdinInput, Config, WidgetContext, UsageLimits } from './types.js';
import { DEFAULT_CONFIG, parsePreset } from './types.js';
import { COLORS, colorize, setTheme, setSeparatorStyle } from './utils/colors.js';
import { ICON } from './utils/emoji.js';
import { fetchUsageLimits } from './utils/api-client.js';
import { fetchAntigravityUsage } from './utils/antigravity-client.js';
import { detectProvider } from './utils/provider.js';
import { isAgyHost } from './utils/agy-stdin.js';
import { streamJsonObjects } from './utils/stdin-stream.js';
import { normalizeStdin } from './utils/normalize-stdin.js';
import { getTranslations } from './utils/i18n.js';
import { getCredentialState } from './utils/credentials.js';
import { formatOutput, getLines } from './widgets/index.js';
import { runRenderLoop } from './render-loop.js';

/**
 * Per-host config path. Each plugin reads its OWN config so the two installs
 * stay fully independent — Antigravity never touches `~/.claude`. An explicit
 * `AGENT_STATUSLINE_CONFIG` env var overrides both when set.
 */
function configPathFor(provider: ReturnType<typeof detectProvider>): string {
  if (process.env.AGENT_STATUSLINE_CONFIG) return process.env.AGENT_STATUSLINE_CONFIG;
  if (provider === 'gemini') {
    return join(homedir(), '.gemini', 'antigravity-cli', 'agent-statusline.local.json');
  }
  return join(homedir(), '.claude', 'agent-statusline.local.json');
}

/**
 * Cached config with path + mtime-based invalidation
 */
let configCache: {
  path: string;
  config: Config;
  mtime: number;
} | null = null;

/**
 * Load user configuration from `configPath` with mtime-based cache and migration.
 */
async function loadConfig(configPath: string): Promise<Config> {
  try {
    // Check mtime for cache invalidation
    const fileStat = await stat(configPath);
    const mtime = fileStat.mtimeMs;

    // Return cached if same path + mtime matches
    if (configCache?.path === configPath && configCache.mtime === mtime) {
      return configCache.config;
    }

    const content = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content);

    // Migrate old config format (add displayMode if missing)
    const config: Config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };

    // Apply preset shorthand if configured
    if (config.preset) {
      const lines = parsePreset(config.preset);
      if (lines.length > 0) {
        config.displayMode = 'custom';
        config.lines = lines;
      }
    }

    // Cache result
    configCache = { path: configPath, config, mtime };
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Convert a single stdin rate limit window (epoch seconds) to UsageLimits field format (ISO string).
 */
function convertStdinLimit(window: { used_percentage: number; resets_at: number }) {
  return {
    utilization: window.used_percentage,
    resets_at: new Date(window.resets_at * 1000).toISOString(),
  };
}

/**
 * Convert stdin rate_limits (Unix epoch seconds) to UsageLimits format (ISO string).
 * Returns null when stdin doesn't provide rate_limits (before first API response or older Claude Code).
 */
function parseStdinRateLimits(stdin: StdinInput): UsageLimits | null {
  const rl = stdin.rate_limits;
  if (!rl) return null;

  return {
    five_hour: rl.five_hour ? convertStdinLimit(rl.five_hour) : null,
    seven_day: rl.seven_day ? convertStdinLimit(rl.seven_day) : null,
    seven_day_sonnet: null, // Not available in stdin
    seven_day_fable: null, // Not available in stdin
  };
}

/**
 * Resolve Anthropic rate limits for a Claude session: prefer the values Claude
 * Code embeds in stdin, falling back to the usage API. Plan-agnostic — windows
 * the account doesn't have simply come back null and their widgets self-hide.
 */
async function resolveAnthropicLimits(stdin: StdinInput, config: Config): Promise<UsageLimits | null> {
  const stdinLimits = parseStdinRateLimits(stdin);

  if (!stdinLimits) {
    // Stdin rate_limits not yet available — full API fallback (includes extra_usage).
    return fetchUsageLimits(config.cache.ttlSeconds);
  }
  // Hybrid: stdin covers 5h/7d, but the model-scoped weekly windows
  // (seven_day_sonnet / seven_day_fable) AND the extra_usage block only come
  // from the API, so fetch when any of them is shown.
  const needsApi = getLines(config).some(
    (line) =>
      line.includes('rateLimit7dSonnet') ||
      line.includes('rateLimit7dFable') ||
      line.includes('extraUsage')
  );
  if (needsApi) {
    const apiLimits = await fetchUsageLimits(config.cache.ttlSeconds);
    return {
      ...stdinLimits,
      seven_day_sonnet: apiLimits?.seven_day_sonnet ?? null,
      seven_day_fable: apiLimits?.seven_day_fable ?? null,
      extra_usage: apiLimits?.extra_usage ?? null,
    };
  }
  return stdinLimits;
}

/**
 * Render one status line from a single raw stdin object.
 *
 * Config/theme are resolved per render (mtime-cached, so it's cheap) so that a
 * long-lived agy process picks up `/setup` changes between updates. Usage data
 * is fetched per host: Anthropic rate limits on Claude, the local
 * language-server quota on Antigravity. Both are TTL-cached, so streaming many
 * updates does not spam either source.
 */
async function renderFromRaw(raw: unknown): Promise<string> {
  const stdin = normalizeStdin(raw);
  if (!stdin) {
    return colorize(ICON.warning, COLORS.yellow);
  }

  // Resolve the host first so we read the correct per-host config file.
  // `product:"antigravity"` is authoritative (set even when agy runs a
  // non-Gemini model); detectProvider is kept only for the model mark/color.
  const agy = isAgyHost(stdin);
  const config = await loadConfig(configPathFor(agy ? 'gemini' : 'claude'));
  setTheme(config.theme);
  setSeparatorStyle(config.separator);
  const translations = getTranslations();

  let rateLimits: UsageLimits | null = null;
  let antigravityUsage = null;
  let isApiAccount = false;
  if (agy) {
    // Quota, agent_state, and subagents all come from stdin directly, so the
    // language-server RPC is no longer needed for them. The only thing stdin
    // omits is the credit balance — fetch that lazily, and ONLY when the
    // agentCredits widget is actually in the layout.
    if (getLines(config).some((line) => line.includes('agentCredits'))) {
      antigravityUsage = await fetchAntigravityUsage(config.cache.ttlSeconds);
    }
  } else {
    rateLimits = await resolveAnthropicLimits(stdin, config);
    // Detect subscription (Pro/Max/Team OAuth) vs. per-token API-key billing so
    // the money zone adapts: subscription → rate-limit/extraUsage widgets;
    // API → cost/forecast/todayCost. An explicit ANTHROPIC_API_KEY means Claude
    // Code bills the API regardless of any stored OAuth login. Otherwise the
    // account is API-only only when a *successfully read* login records no plan
    // AND no usage window is present. A login we could NOT read (missing file,
    // keychain error) is not treated as an API signal — that would transiently
    // flip a real subscriber to API on a cold start and wrongly show notional
    // per-token cost; biasing to subscription keeps the money zone safe.
    const { found, subscriptionType } = await getCredentialState();
    const hasSubscriptionWindow = !!(
      rateLimits &&
      (rateLimits.five_hour ||
        rateLimits.seven_day ||
        rateLimits.seven_day_sonnet ||
        rateLimits.seven_day_fable)
    );
    isApiAccount =
      !!process.env.ANTHROPIC_API_KEY || (found && !subscriptionType && !hasSubscriptionWindow);
  }

  const ctx: WidgetContext = {
    stdin,
    config,
    translations,
    rateLimits,
    antigravityUsage,
    isApiAccount,
  };

  const output = await formatOutput(ctx);

  // Claude Code renders its status line with a 2-space left indent; Antigravity
  // does not. Prepend two spaces per line on the agy host so the same UI lines
  // up identically across both hosts.
  if (agy && output) {
    return output.split('\n').map((line) => `  ${line}`).join('\n');
  }
  return output;
}

/**
 * Main entry point.
 *
 * Consumes stdin as a stream of JSON objects (see streamJsonObjects): on Claude
 * Code that's a single object followed by EOF (render once, exit); on
 * Antigravity it's a live stream of state updates with no EOF (render one fresh
 * line per update until the host closes the pipe).
 */
async function main(): Promise<void> {
  await runRenderLoop(
    streamJsonObjects(process.stdin),
    renderFromRaw,
    (line) => { process.stdout.write(line); },
  );
}

// Run
main().catch(() => {
  process.stdout.write(`${colorize(ICON.warning, COLORS.yellow)}\n`);
});
