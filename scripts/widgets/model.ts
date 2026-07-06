/**
 * Model widget - displays the active model name with effort level and fast mode.
 *
 * The mark + name color are **HOST-branded**, not model-branded: on the agy host
 * it is always the Antigravity mark `Λ` + blue→red gradient, even when agy runs
 * a Claude/GPT model (so the terminal status line always tells you which host
 * you're in); on Claude Code it is always `✽` coral. Only the model NAME follows
 * the model (e.g. `Λ Opus`, `Λ Gemini 3.5 Flash (H)`, `✽ Opus (xH)`).
 *
 * Effort level: Shown for Opus, Sonnet, and Fable as (xH/H/M/L), hidden for
 * Haiku. The `xhigh` tier is available on Opus, Sonnet 5+, and Fable, so on
 * older Sonnet a global xhigh setting is shown as the (H) it actually runs at
 * (see effectiveEffort / supportsXhigh).
 * Fast mode: Opus 4.6 exclusive feature, indicated by ↯ symbol
 * @tested scripts/__tests__/widgets.test.ts
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, ModelData, EffortLevel } from '../types.js';
import { shortenModelName, sanitizeText } from '../utils/formatters.js';
import { providerMark, providerName } from '../utils/provider.js';
import { isAgyHost } from '../utils/agy-stdin.js';

const EFFORT_LEVELS = new Set<string>(['xhigh', 'high', 'medium', 'low']);

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value);
}

/**
 * Short badge per effort tier. `xhigh` is shown as `xH` so it's distinct from
 * `high` (`H`) at a glance. Shared by both hosts: Claude's settings effort and
 * the reasoning level agy bakes into the model name map to the same badge.
 */
const EFFORT_BADGE: Record<EffortLevel, string> = {
  xhigh: 'xH',
  high: 'H',
  medium: 'M',
  low: 'L',
};

/**
 * Whether a model can actually reach the `xhigh` effort tier. Every current
 * Opus supports it, as does Fable; on Sonnet the tier arrived with Sonnet 5, so
 * older Sonnet (4.x and earlier) still tops out at `high`. The Sonnet major
 * version is read from the model id (e.g. `claude-sonnet-5` → 5); the older
 * `claude-3-5-sonnet` naming doesn't match `claude-sonnet-N` and is treated as
 * pre-5 (clamped).
 */
function supportsXhigh(shortName: string, modelId: string): boolean {
  if (shortName === 'Opus' || shortName === 'Fable') return true;
  if (shortName === 'Sonnet') {
    const major = modelId.match(/claude-sonnet-(\d+)/)?.[1];
    return major !== undefined && parseInt(major, 10) >= 5;
  }
  return false;
}

/**
 * Resolve the effort tier a model actually runs at. A global `xhigh` setting is
 * displayed as the real `high` a model falls back to when that model has no
 * xhigh tier (see supportsXhigh), rather than a tier it can't reach.
 */
export function effectiveEffort(shortName: string, effort: EffortLevel, modelId: string): EffortLevel {
  if (effort === 'xhigh' && !supportsXhigh(shortName, modelId)) return 'high';
  return effort;
}

/**
 * Antigravity encodes the reasoning level inside the model display name, e.g.
 * "Gemini 3.5 Flash (High)". Compact that trailing parenthetical into the same
 * `(xH/H/M/L)` badge Claude uses so the two hosts read consistently. Only
 * recognized effort words are compacted; any other parenthetical (or none) is
 * left untouched.
 */
export function compactGeminiName(displayName: string): { name: string; badge: string } {
  const match = displayName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const level = match[2].trim().toLowerCase();
    if (isEffortLevel(level)) return { name: match[1].trim(), badge: `(${EFFORT_BADGE[level]})` };
  }
  return { name: displayName, badge: '' };
}

interface ModelSettings {
  effortLevel: EffortLevel;
  fastMode: boolean;
}

/**
 * Fallback effort when settings.json is absent or lacks `effortLevel`.
 * Mirrors Claude Code's runtime defaults so the badge matches actual behavior
 * for users who never ran `/effort`. Keep in sync with upstream:
 *   Opus → xhigh, Fable → xhigh, Sonnet → medium.
 * Haiku has no effort tier (render() hides the badge); the `'high'` fallback
 * is a safety net for unknown model IDs.
 */
export function getDefaultEffort(modelId: string): EffortLevel {
  if (modelId.includes('opus')) return 'xhigh';
  if (modelId.includes('fable')) return 'xhigh';
  if (modelId.includes('sonnet')) return 'medium';
  return 'high';
}

let settingsCache: { rawEffort: unknown; fastMode: boolean; mtime: number } | null = null;

/**
 * Reads ~/.claude/settings.json for the effort/fast-mode badge. The mtime-keyed
 * in-process cache makes this free after the first read within a process (and
 * across renders on the long-lived agy host — though agy never reaches here).
 * On the one-shot Claude host it is a single small-file read per render, which
 * is cheap relative to the git/keychain subprocesses on the same path.
 */
async function getModelSettings(modelId: string): Promise<ModelSettings> {
  const defaultEffort = getDefaultEffort(modelId);
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  try {
    const fileStat = await stat(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return {
        effortLevel: isEffortLevel(settingsCache.rawEffort) ? settingsCache.rawEffort : defaultEffort,
        fastMode: settingsCache.fastMode,
      };
    }
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const rawEffort = settings.effortLevel;
    const fastMode = settings.fastMode === true;
    settingsCache = { mtime: fileStat.mtimeMs, rawEffort, fastMode };
    return {
      effortLevel: isEffortLevel(rawEffort) ? rawEffort : defaultEffort,
      fastMode,
    };
  } catch {
    settingsCache = null;
  }

  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return { effortLevel: envEffort, fastMode: false };
  }

  return { effortLevel: defaultEffort, fastMode: false };
}

export const modelWidget: Widget<ModelData> = {
  id: 'model',
  name: 'Model',

  async getData(ctx: WidgetContext): Promise<ModelData | null> {
    const { model } = ctx.stdin;
    const modelId = model?.id || '';
    // display_name is host-supplied (and on agy could be spoofed); strip control
    // characters so it cannot inject terminal escapes via the always-on widget.
    const displayName = sanitizeText(model?.display_name || '-') || '-';

    // On the agy host we must NEVER touch ~/.claude — regardless of which model
    // agy runs (Gemini OR Claude/GPT). agy bakes its reasoning level into the
    // display name, so settings.json effort/fastMode are unused there.
    if (isAgyHost(ctx.stdin)) {
      return { id: modelId, displayName, effortLevel: 'high', fastMode: false };
    }

    const { effortLevel, fastMode } = await getModelSettings(modelId);
    return {
      id: modelId,
      displayName,
      effortLevel,
      fastMode,
    };
  },

  render(data: ModelData, ctx: WidgetContext): string {
    // Mark + color follow the HOST, not the model — so an agy session running a
    // Claude model still shows the agy identity (Λ + gradient), and you can tell
    // at a glance which host the status line belongs to.
    const styleProvider = isAgyHost(ctx.stdin) ? 'gemini' : 'claude';
    const mark = providerMark(styleProvider);

    if (styleProvider === 'gemini') {
      // agy host: reasoning level is baked into the name ("(High)" etc.) — compact
      // it to a badge, then shorten ("Claude Opus 4.6" → "Opus") so only the model
      // name shows while the mark/color stay Antigravity's.
      const { name, badge } = compactGeminiName(data.displayName);
      const shortName = shortenModelName(name);
      return `${mark} ${providerName('gemini', badge ? `${shortName} ${badge}` : shortName)}`;
    }

    // Claude host: ✽ coral, effort badge from settings, fast mode.
    const shortName = shortenModelName(data.displayName);

    // Haiku excluded from effort badge. A space separates the name from the badge.
    const supportsEffort =
      shortName === 'Opus' || shortName === 'Sonnet' || shortName === 'Fable';
    const effortSuffix = supportsEffort
      ? ` (${EFFORT_BADGE[effectiveEffort(shortName, data.effortLevel, data.id)]})`
      : '';

    // Fast mode indicator (Opus 4.6 exclusive)
    const fastIndicator = shortName === 'Opus' && data.fastMode ? ' ↯' : '';

    return `${mark} ${providerName('claude', `${shortName}${effortSuffix}${fastIndicator}`)}`;
  },
};
