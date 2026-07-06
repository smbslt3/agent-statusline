/**
 * Rate limit widgets - displays 5h and 7d usage limits
 * @tested scripts/__tests__/rate-limit.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, RateLimitData, UsageLimits } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { renderUsageWindow } from '../utils/formatters.js';
import { isAgyHost } from '../utils/agy-stdin.js';

type LabelKey = '5h' | '7d_all' | '7d_sonnet' | '7d_fable';
// Only the rate-limit window keys (NOT extra_usage, which is a different shape).
type LimitKey = 'five_hour' | 'seven_day' | 'seven_day_sonnet' | 'seven_day_fable';

/**
 * Anthropic 5h/7d windows exist only for a Claude *subscription* (Pro/Max/Team).
 * Hide them on the Antigravity host (the agentQuota widgets cover agy's quota)
 * AND on a per-token API-key account, which has no session windows — there the
 * cost/forecast/todayCost widgets show the real spend instead. This keeps the
 * money zone mutually exclusive: subscription → rate limits; API → cost.
 */
function isAnthropicHost(ctx: WidgetContext): boolean {
  return !isAgyHost(ctx.stdin) && !ctx.isApiAccount;
}

function renderRateLimit(data: RateLimitData, ctx: WidgetContext, labelKey: LabelKey): string {
  if (data.isError) {
    return colorize(ICON.warning, getTheme().warning);
  }
  return renderUsageWindow(
    ctx.translations.labels[labelKey],
    data.utilization,
    data.resetsAt,
    ctx.config.rateLimitResetDisplay,
    ctx.translations,
  );
}

function getLimitData(limits: UsageLimits | null | undefined, key: LimitKey): RateLimitData | null {
  const limit = limits?.[key];
  if (!limit) return null;

  return {
    utilization: Math.round(limit.utilization),
    resetsAt: limit.resets_at,
  };
}

/**
 * 5-hour rate limit widget
 */
export const rateLimit5hWidget: Widget<RateLimitData> = {
  id: 'rateLimit5h',
  name: '5h Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (!isAnthropicHost(ctx)) return null;
    const data = getLimitData(ctx.rateLimits, 'five_hour');
    // Show warning if API failed (only in this widget to avoid duplicates)
    return data ?? { utilization: 0, resetsAt: null, isError: true };
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '5h');
  },
};

/**
 * 7-day rate limit widget (Pro and Max plans)
 */
export const rateLimit7dWidget: Widget<RateLimitData> = {
  id: 'rateLimit7d',
  name: '7d Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (!isAnthropicHost(ctx)) return null;
    return getLimitData(ctx.rateLimits, 'seven_day');
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '7d_all');
  },
};

/**
 * 7-day Sonnet-only rate limit widget.
 * Plan-agnostic: renders whenever the usage API returns a seven_day_sonnet
 * window, so the plan never needs to be configured manually.
 */
export const rateLimit7dSonnetWidget: Widget<RateLimitData> = {
  id: 'rateLimit7dSonnet',
  name: '7d Sonnet Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (!isAnthropicHost(ctx)) return null;
    return getLimitData(ctx.rateLimits, 'seven_day_sonnet');
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '7d_sonnet');
  },
};

/**
 * 7-day Fable-only rate limit widget (7d-F), the Fable counterpart to
 * `rateLimit7dSonnet`. Plan-agnostic: renders whenever the usage API returns a
 * Fable-scoped weekly window (`seven_day_fable`), so the plan never needs to be
 * configured manually.
 */
export const rateLimit7dFableWidget: Widget<RateLimitData> = {
  id: 'rateLimit7dFable',
  name: '7d Fable Rate Limit',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (!isAnthropicHost(ctx)) return null;
    return getLimitData(ctx.rateLimits, 'seven_day_fable');
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return renderRateLimit(data, ctx, '7d_fable');
  },
};
