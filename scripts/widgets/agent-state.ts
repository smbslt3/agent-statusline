/**
 * Antigravity agent-state widget — surfaces `stdin.agent_state` while agy is
 * actively working. Hidden when idle/authenticating (those add no signal) and
 * on the Claude host. agy-host only.
 *
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentStateData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { isAgyHost } from '../utils/agy-stdin.js';

export const agentStateWidget: Widget<AgentStateData> = {
  id: 'agentState',
  name: 'Antigravity State',

  async getData(ctx: WidgetContext): Promise<AgentStateData | null> {
    if (!isAgyHost(ctx.stdin)) return null;
    // Only surface active work — idle/authenticating would just be noise.
    if (ctx.stdin.agent_state !== 'working') return null;
    return { state: 'working' };
  },

  render(_data: AgentStateData, ctx: WidgetContext): string {
    return `${ICON.gear} ${colorize(ctx.translations.widgets.working, getTheme().info)}`;
  },
};
