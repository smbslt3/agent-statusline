/**
 * Antigravity background-tasks widget — shows the number of running background
 * tasks from `stdin.tasks` (agy's `/tasks` "Agent Backgrounded" jobs, e.g.
 * `python check_subtitles.py`). This is agy's analog to a background-shell
 * tracker, NOT a TodoWrite-style plan checklist.
 *
 * Defensive: the `tasks` field was confirmed to drive agy's native `N task(s)`
 * but its exact shape wasn't captured (no background task ran during capture),
 * so this renders only when a non-empty `tasks` array with running items is
 * present. agy-host only; hidden on Claude.
 *
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentTasksData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { isAgyHost, summarizeTasks } from '../utils/agy-stdin.js';

export const agentTasksWidget: Widget<AgentTasksData> = {
  id: 'agentTasks',
  name: 'Antigravity Tasks',

  async getData(ctx: WidgetContext): Promise<AgentTasksData | null> {
    if (!isAgyHost(ctx.stdin)) return null;
    const t = summarizeTasks(ctx.stdin);
    if (!t || t.running === 0) return null;
    return t;
  },

  render(data: AgentTasksData, ctx: WidgetContext): string {
    const text = `${data.running} ${ctx.translations.widgets.bgTask}`;
    return `${ICON.package} ${colorize(text, getTheme().info)}`;
  },
};
