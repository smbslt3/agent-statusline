/**
 * Cost widget - displays session cost in USD
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, CostData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatCost } from '../utils/formatters.js';
import { isAgyHost } from '../utils/agy-stdin.js';

export const costWidget: Widget<CostData> = {
  id: 'cost',
  name: 'Cost',

  async getData(ctx: WidgetContext): Promise<CostData | null> {
    // Antigravity doesn't report session cost, so hide the widget there rather
    // than implying a misleading $0.00 (Claude always carries a cost field).
    if (isAgyHost(ctx.stdin)) return null;
    // Real money only for API (per-token) accounts; subscription cost is notional.
    if (!ctx.isApiAccount) return null;

    const { cost } = ctx.stdin;

    return {
      totalCostUsd: cost?.total_cost_usd ?? 0,
    };
  },

  render(data: CostData): string {
    return colorize(formatCost(data.totalCostUsd), getTheme().accent);
  },
};
