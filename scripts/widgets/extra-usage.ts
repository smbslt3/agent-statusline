/**
 * Extra-usage widget — paid overage credits (beyond the plan limits), shown as
 * "used / monthly cap" in the account currency.
 *
 * Hidden by default: it renders ONLY when the account has extra usage enabled
 * with a configured monthly cap (`extra_usage.is_enabled` + `monthly_limit`
 * from the usage API), i.e. when real money beyond the subscription is in play.
 * On a plain subscription with no extra usage it stays hidden — unlike the
 * `cost` widget, it never shows the session's notional API cost.
 *
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ExtraUsageData } from '../types.js';
import { colorize, getColorForPercent } from '../utils/colors.js';
import { formatCost } from '../utils/formatters.js';
import { isAgyHost } from '../utils/agy-stdin.js';

function formatAmount(amount: number, currency: string | null): string {
  if (!currency || currency.toUpperCase() === 'USD') return formatCost(amount); // $X.XX
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

export const extraUsageWidget: Widget<ExtraUsageData> = {
  id: 'extraUsage',
  name: 'Extra Usage',

  async getData(ctx: WidgetContext): Promise<ExtraUsageData | null> {
    // Anthropic-only concept; never shown on the agy host.
    if (isAgyHost(ctx.stdin)) return null;
    // Overage is a subscription concept; on a per-token API account it's N/A.
    if (ctx.isApiAccount) return null;

    const xu = ctx.rateLimits?.extra_usage;
    // Hidden unless the account has paid extra usage enabled with a cap.
    if (!xu || !xu.is_enabled || xu.monthly_limit == null) return null;

    const usedCredits = xu.used_credits ?? 0;
    const utilization = typeof xu.utilization === 'number'
      ? Math.round(xu.utilization)
      : xu.monthly_limit > 0
        ? Math.round((usedCredits / xu.monthly_limit) * 100)
        : 0;

    return { usedCredits, monthlyLimit: xu.monthly_limit, currency: xu.currency, utilization };
  },

  render(data: ExtraUsageData, ctx: WidgetContext): string {
    const used = formatAmount(data.usedCredits, data.currency);
    const limit = data.monthlyLimit != null ? `/${formatAmount(data.monthlyLimit, data.currency)}` : '';
    // `extra $used/$total` — the label stays uncolored (like the rate-limit
    // window labels) while the amount is colored by utilization.
    const label = ctx.translations.labels.extra;
    return `${label} ${colorize(`${used}${limit}`, getColorForPercent(data.utilization))}`;
  },
};
