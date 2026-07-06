/**
 * Antigravity subagents widget — shows the number of running subagents from
 * `stdin.subagents` (agy spawns these for parallel sub-tasks, e.g. "research X
 * with subagents in parallel"). The agy counterpart to Claude's agentStatus.
 * Hidden when none are running and on the Claude host. agy-host only.
 *
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentSubagentsData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { isAgyHost, summarizeSubagents } from '../utils/agy-stdin.js';

export const agentSubagentsWidget: Widget<AgentSubagentsData> = {
  id: 'agentSubagents',
  name: 'Antigravity Subagents',

  async getData(ctx: WidgetContext): Promise<AgentSubagentsData | null> {
    if (!isAgyHost(ctx.stdin)) return null;
    const s = summarizeSubagents(ctx.stdin);
    // Show only while subagents are actively running.
    if (!s || s.running === 0) return null;
    return s;
  },

  render(data: AgentSubagentsData, ctx: WidgetContext): string {
    const text = `${data.running} ${ctx.translations.widgets.subagents}`;
    return `${ICON.robot} ${colorize(text, getTheme().info)}`;
  },
};
