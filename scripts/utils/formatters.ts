/**
 * @tested scripts/__tests__/formatters.test.ts
 */
import type { Translations, RateLimitResetDisplay } from '../types.js';
import { getColorForPercent, colorize } from './colors.js';

/**
 * Format token count in K/M format
 * Examples: 1500 -> "1.5K", 150000 -> "150K", 1500000 -> "1.5M"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    return value >= 10 ? `${Math.round(value)}M` : `${value.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000;
    return value >= 10 ? `${Math.round(value)}K` : `${value.toFixed(1)}K`;
  }
  return String(tokens);
}

/**
 * Format cost in USD
 * Examples: 0.5 -> "$0.50", 1.234 -> "$1.23"
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Format time remaining until reset
 * Examples: 3d2h, 2h30m, 45m, 5m
 */
export function formatTimeRemaining(resetAt: string | Date, t: Translations): string {
  const reset = typeof resetAt === 'string' ? new Date(resetAt) : resetAt;
  // Guard unparseable timestamps: NaN propagates through the arithmetic below
  // (and `NaN <= 0` is false), so without this the widget would render "NaNm".
  // Degrade to the same well-formed zero as a past reset, matching formatResetClock.
  if (Number.isNaN(reset.getTime())) return `0${t.time.minutes}`;
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) return `0${t.time.minutes}`;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}${t.time.days}${hours}${t.time.hours}`;
  }
  if (hours > 0) {
    return `${hours}${t.time.hours}${minutes}${t.time.minutes}`;
  }
  return `${minutes}${t.time.minutes}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format the absolute reset clock time. Same-day resets show `HH:MM`; resets on
 * a different calendar day are prefixed with the weekday (e.g. `Tue 15:30`) so
 * multi-day windows (7d) are unambiguous about *when* they reset.
 */
export function formatResetClock(resetAt: string | Date): string {
  const reset = typeof resetAt === 'string' ? new Date(resetAt) : resetAt;
  if (Number.isNaN(reset.getTime())) return typeof resetAt === 'string' ? resetAt : '';
  const hh = String(reset.getHours()).padStart(2, '0');
  const mm = String(reset.getMinutes()).padStart(2, '0');
  const now = new Date();
  const sameDay =
    reset.getFullYear() === now.getFullYear() &&
    reset.getMonth() === now.getMonth() &&
    reset.getDate() === now.getDate();
  return sameDay ? `${hh}:${mm}` : `${WEEKDAYS[reset.getDay()]} ${hh}:${mm}`;
}

/**
 * Render a reset window per the configured display mode:
 *   - `remaining` (default): time left, e.g. `4h42m`
 *   - `resetTime`: absolute reset clock, e.g. `15:30` (or `Tue 15:30` if not today)
 *   - `both`: `4h42m, 15:30`
 */
export function formatResetDisplay(
  resetAt: string | Date,
  mode: RateLimitResetDisplay,
  t: Translations,
): string {
  if (mode === 'resetTime') return formatResetClock(resetAt);
  const remaining = formatTimeRemaining(resetAt, t);
  if (mode === 'both') return `${remaining}, ${formatResetClock(resetAt)}`;
  return remaining;
}

/**
 * Render a usage/quota window as `Label: NN% (reset)` with the percentage
 * colored by severity. Shared by the Anthropic rate-limit widgets (Claude) and
 * the Antigravity quota widgets (agy) so both hosts render identically.
 */
export function renderUsageWindow(
  label: string,
  utilization: number,
  resetsAt: string | null,
  resetMode: RateLimitResetDisplay | undefined,
  t: Translations,
): string {
  const colored = `${label}: ${colorize(`${utilization}%`, getColorForPercent(utilization))}`;
  if (!resetsAt) return colored;
  return `${colored} (${formatResetDisplay(resetsAt, resetMode ?? 'remaining', t)})`;
}

/**
 * Shorten model name
 * Examples: "Claude 3.5 Sonnet" -> "Sonnet", "Claude Opus 4.5" -> "Opus",
 * "Fable 5" -> "Fable"
 */
export function shortenModelName(displayName: string): string {
  const lower = displayName.toLowerCase();

  if (lower.includes('opus')) return 'Opus';
  if (lower.includes('sonnet')) return 'Sonnet';
  if (lower.includes('haiku')) return 'Haiku';
  if (lower.includes('fable')) return 'Fable';

  // Fallback: return first word after "Claude" or the original
  const parts = displayName.split(/\s+/);
  if (parts.length > 1 && parts[0].toLowerCase() === 'claude') {
    return parts[1];
  }

  return displayName;
}

/**
 * Calculate percentage
 */
export function calculatePercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

/**
 * Format duration in milliseconds to human readable format
 * Examples: 3600000 -> "1h", 5400000 -> "1h30m", 300000 -> "5m"
 */
export function formatDuration(ms: number, t: { hours: string; minutes: string }): string {
  if (ms <= 0) return `0${t.minutes}`;

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}${t.hours}${minutes}${t.minutes}`;
  }
  if (hours > 0) {
    return `${hours}${t.hours}`;
  }
  return `${minutes}${t.minutes}`;
}

/**
 * Strip terminal control characters from externally-sourced text so untrusted
 * values (git branch/tag names, prompts, file paths, session/model names, tool
 * targets, todo/agent text) cannot smuggle ANSI/OSC escape sequences into the
 * status line — which would otherwise allow terminal spoofing, cursor
 * manipulation, or window-title hijack.
 *
 * Tab/newline/CR collapse to a single space; all other C0 controls (including
 * ESC 0x1B), DEL (0x7F), and the C1 range (0x80–0x9F) are removed. The plugin's
 * own color/OSC8 escapes are added by colorize()/osc8Link() AFTER sanitization,
 * so legitimate styling is never affected — only injected escapes are removed.
 */
export function sanitizeText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\t\n\r]+/g, ' ').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

/**
 * Truncate string to maxLen characters, appending '…' if truncated.
 *
 * Sanitizes first (so injected escapes can never survive truncation) and counts
 * by Unicode code points, so a surrogate pair (e.g. an emoji) is never bisected.
 */
export function truncate(str: string, maxLen: number): string {
  const clean = sanitizeText(str);
  const chars = Array.from(clean);
  return chars.length <= maxLen ? clean : chars.slice(0, maxLen).join('') + '…';
}

/**
 * Wrap text in OSC8 hyperlink escape sequence.
 * Terminals that don't support OSC8 simply display the text without the link.
 * The URL is sanitized so a hostile git remote URL cannot inject its own escape
 * sequences through the hyperlink.
 * @see https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
 */
export function osc8Link(url: string, text: string): string {
  return `\x1b]8;;${sanitizeText(url)}\x1b\\${text}\x1b]8;;\x1b\\`;
}
