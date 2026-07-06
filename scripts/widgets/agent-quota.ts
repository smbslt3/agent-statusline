/**
 * Antigravity quota widgets — the agy host's counterpart to Claude's rate-limit
 * widgets. agy streams its quota directly in stdin (`stdin.quota`) with a 5-hour
 * AND a weekly window per model family (gemini-* / 3p-*), so these read straight
 * from stdin — no language-server RPC needed — and render in the same
 * `5h: NN% (reset)` / `7d: NN% (reset)` shape as Claude's windows.
 *
 * Self-gating mirrors the other host-adaptive widgets: they render only on the
 * agy host and only when the matching quota window is present, so on Claude they
 * hide exactly as the rate-limit widgets hide on agy.
 *
 * @tested scripts/__tests__/agy-stdin.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, RateLimitData } from '../types.js';
import { renderUsageWindow } from '../utils/formatters.js';
import { isAgyHost, agyQuotaWindow } from '../utils/agy-stdin.js';

function render(data: RateLimitData, ctx: WidgetContext, labelKey: '5h' | '7d_all'): string {
  return renderUsageWindow(
    ctx.translations.labels[labelKey],
    data.utilization,
    data.resetsAt,
    ctx.config.rateLimitResetDisplay,
    ctx.translations,
  );
}

/** agy 5-hour quota window. */
export const agentQuotaWidget: Widget<RateLimitData> = {
  id: 'agentQuota',
  name: 'Antigravity Quota',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (!isAgyHost(ctx.stdin)) return null;
    const w = agyQuotaWindow(ctx.stdin, '5h');
    return w ? { utilization: w.utilization, resetsAt: w.resetsAt } : null;
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return render(data, ctx, '5h');
  },
};

/** agy weekly (7-day) quota window — the agy counterpart to rateLimit7d. */
export const agentQuota7dWidget: Widget<RateLimitData> = {
  id: 'agentQuota7d',
  name: 'Antigravity Quota (7d)',

  async getData(ctx: WidgetContext): Promise<RateLimitData | null> {
    if (!isAgyHost(ctx.stdin)) return null;
    const w = agyQuotaWindow(ctx.stdin, 'weekly');
    return w ? { utilization: w.utilization, resetsAt: w.resetsAt } : null;
  },

  render(data: RateLimitData, ctx: WidgetContext): string {
    return render(data, ctx, '7d_all');
  },
};
