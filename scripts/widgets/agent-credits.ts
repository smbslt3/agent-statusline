/**
 * Antigravity credits widget — a low-balance warning for the agy credit balance
 * (e.g. Google One AI credits), read from the local language-server
 * GetUserStatus RPC (`userTier.availableCredits`) via ctx.antigravityUsage.credits.
 *
 * agy has no Claude-style overage flag, so we can't "show only on overage" the
 * way `extraUsage` does. Instead this stays HIDDEN while the balance is healthy
 * and only appears once it drops to/below a low-balance threshold (a depletion
 * warning) — so a static Pro-perk balance like 1,000 isn't shown by default.
 * Threshold = `config.agentCreditsThreshold` or `minForUsage * 2` (else 100).
 * agy-host only; hidden on Claude.
 *
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentCreditsData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { isAgyHost } from '../utils/agy-stdin.js';

const DEFAULT_LOW_THRESHOLD = 100;

export const agentCreditsWidget: Widget<AgentCreditsData> = {
  id: 'agentCredits',
  name: 'Antigravity Credits',

  async getData(ctx: WidgetContext): Promise<AgentCreditsData | null> {
    // Antigravity-only concept; never shown on the Claude host.
    if (!isAgyHost(ctx.stdin)) return null;

    const credits = ctx.antigravityUsage?.credits;
    // Hide when no balance is reported (or it's zero) — nothing useful to show.
    if (!credits || !(credits.amount > 0)) return null;

    // Only surface as a depletion warning when the balance is low; a healthy
    // balance stays hidden (agy gives no overage flag to gate on instead).
    const minForUsage = typeof credits.minForUsage === 'number' ? credits.minForUsage : null;
    const threshold = ctx.config.agentCreditsThreshold
      ?? (minForUsage != null ? minForUsage * 2 : DEFAULT_LOW_THRESHOLD);
    if (credits.amount > threshold) return null;

    return { amount: credits.amount, type: credits.type ?? null };
  },

  render(data: AgentCreditsData, ctx: WidgetContext): string {
    // Antigravity credits are unit-based (e.g. Google One AI), not currency, so
    // they render bare. If a credit type ever denotes a USD/dollar balance,
    // append a trailing "$" to mark the unit. Colored as a warning since the
    // widget only appears when the balance is running low.
    const isDollar = /usd|dollar|\$/i.test(data.type ?? '');
    const value = `${data.amount.toLocaleString('en-US')}${isDollar ? '$' : ''}`;
    return `${ctx.translations.labels.credits}: ${colorize(value, getTheme().danger)}`;
  },
};
