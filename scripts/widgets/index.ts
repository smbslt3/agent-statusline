/**
 * Widget registry and orchestrator
 */

import type { Widget, WidgetRenderResult } from './base.js';
import type {
  WidgetId,
  WidgetContext,
  Config,
} from '../types.js';
import { DISPLAY_PRESETS } from '../types.js';
import { getSeparator } from '../utils/colors.js';
import { debugLog } from '../utils/debug.js';
import { wrapSegments } from '../utils/width.js';

// Widget imports
import { modelWidget } from './model.js';
import {
  contextWidget,
  contextBarWidget,
  contextPercentageWidget,
  contextUsageWidget,
} from './context.js';
import { costWidget } from './cost.js';
import { extraUsageWidget } from './extra-usage.js';
import { rateLimit5hWidget, rateLimit7dWidget, rateLimit7dSonnetWidget, rateLimit7dFableWidget } from './rate-limit.js';
import { agentQuotaWidget, agentQuota7dWidget } from './agent-quota.js';
import { agentCreditsWidget } from './agent-credits.js';
import { agentStateWidget } from './agent-state.js';
import { agentSubagentsWidget } from './agent-subagents.js';
import { agentTasksWidget } from './agent-tasks.js';
import { projectInfoWidget } from './project-info.js';
import { configCountsWidget } from './config-counts.js';
import { sessionDurationWidget } from './session-duration.js';
import { toolActivityWidget } from './tool-activity.js';
import { agentStatusWidget } from './agent-status.js';
import { todoProgressWidget } from './todo-progress.js';
import { burnRateWidget } from './burn-rate.js';
import { cacheHitWidget } from './cache-hit.js';
import { sessionIdWidget, sessionIdFullWidget } from './session-id.js';
import { tokenBreakdownWidget } from './token-breakdown.js';
import { forecastWidget } from './forecast.js';
import { budgetWidget } from './budget.js';
import { versionWidget } from './version.js';
import { linesChangedWidget } from './lines-changed.js';
import { outputStyleWidget } from './output-style.js';
import { tokenSpeedWidget } from './token-speed.js';
import { sessionNameWidget } from './session-name.js';
import { todayCostWidget } from './today-cost.js';
import { lastPromptWidget } from './last-prompt.js';
import { vimModeWidget } from './vim-mode.js';
import { apiDurationWidget } from './api-duration.js';
import { tagStatusWidget } from './tag-status.js';
import { slashCommandWidget } from './slash-command.js';
import { agentModeWidget } from './agent-mode.js';

/**
 * Widget registry - maps widget IDs to widget implementations
 */
const widgetRegistry = new Map<WidgetId, Widget>([
  ['model', modelWidget],
  ['context', contextWidget],
  ['contextBar', contextBarWidget],
  ['contextPercentage', contextPercentageWidget],
  ['contextUsage', contextUsageWidget],
  ['cost', costWidget],
  ['extraUsage', extraUsageWidget],
  ['rateLimit5h', rateLimit5hWidget],
  ['rateLimit7d', rateLimit7dWidget],
  ['rateLimit7dSonnet', rateLimit7dSonnetWidget],
  ['rateLimit7dFable', rateLimit7dFableWidget],
  ['agentQuota', agentQuotaWidget],
  ['agentQuota7d', agentQuota7dWidget],
  ['agentCredits', agentCreditsWidget],
  ['agentState', agentStateWidget],
  ['agentSubagents', agentSubagentsWidget],
  ['agentTasks', agentTasksWidget],
  ['projectInfo', projectInfoWidget],
  ['configCounts', configCountsWidget],
  ['sessionDuration', sessionDurationWidget],
  ['toolActivity', toolActivityWidget],
  ['agentStatus', agentStatusWidget],
  ['todoProgress', todoProgressWidget],
  ['burnRate', burnRateWidget],
  ['cacheHit', cacheHitWidget],
  ['sessionId', sessionIdWidget],
  ['sessionIdFull', sessionIdFullWidget],
  ['tokenBreakdown', tokenBreakdownWidget],
  ['forecast', forecastWidget],
  ['budget', budgetWidget],
  ['version', versionWidget],
  ['linesChanged', linesChangedWidget],
  ['outputStyle', outputStyleWidget],
  ['tokenSpeed', tokenSpeedWidget],
  ['sessionName', sessionNameWidget],
  ['todayCost', todayCostWidget],
  ['lastPrompt', lastPromptWidget],
  ['vimMode', vimModeWidget],
  ['apiDuration', apiDurationWidget],
  ['tagStatus', tagStatusWidget],
  ['slashCommand', slashCommandWidget],
  ['agentMode', agentModeWidget],
] as [WidgetId, Widget][]);

/**
 * Get widget by ID
 */
export function getWidget(id: WidgetId): Widget | undefined {
  return widgetRegistry.get(id);
}

/**
 * Get lines configuration based on display mode, with disabled widgets filtered out
 */
export function getLines(config: Config): WidgetId[][] {
  const lines = config.displayMode === 'custom' && config.lines
    ? config.lines
    : DISPLAY_PRESETS[config.displayMode as keyof typeof DISPLAY_PRESETS] || DISPLAY_PRESETS.compact;

  // Filter out disabled widgets
  const disabled = config.disabledWidgets;
  if (!disabled || disabled.length === 0) {
    return lines;
  }

  const disabledSet = new Set(disabled);
  return lines
    .map((line) => line.filter((id) => !disabledSet.has(id)))
    .filter((line) => line.length > 0);
}

/**
 * Render a single widget
 */
async function renderWidget(
  widgetId: WidgetId,
  ctx: WidgetContext
): Promise<WidgetRenderResult | null> {
  const widget = getWidget(widgetId);
  if (!widget) {
    return null;
  }

  try {
    const data = await widget.getData(ctx);
    if (!data) {
      return null;
    }

    const output = widget.render(data, ctx);
    return { id: widgetId, output };
  } catch (error) {
    // Graceful degradation - skip failed widgets, but log for debugging
    debugLog('widget', `Widget '${widgetId}' failed`, error);
    return null;
  }
}

/**
 * Render a line of widgets into its individual (non-empty) segment strings.
 * Joining is deferred to renderAllLines so it can optionally re-pack segments
 * for terminal-width auto-wrapping.
 */
async function renderLineSegments(
  widgetIds: WidgetId[],
  ctx: WidgetContext
): Promise<string[]> {
  const results = await Promise.all(
    widgetIds.map((id) => renderWidget(id, ctx))
  );

  return results
    .filter((r): r is WidgetRenderResult => r !== null && r.output.length > 0)
    .map((r) => r.output);
}

/**
 * Resolve the column budget for `autoWrap`: explicit `maxWidth` wins, then the
 * width agy provides in stdin (`terminal_width`), then the detected terminal
 * columns (undefined when stdout is a pipe), then $COLUMNS, then 80.
 */
function resolveWrapWidth(config: Config, stdin: WidgetContext['stdin']): number {
  if (typeof config.maxWidth === 'number' && config.maxWidth > 0) return config.maxWidth;
  if (typeof stdin.terminal_width === 'number' && stdin.terminal_width > 0) return stdin.terminal_width;
  const cols = process.stdout.columns;
  if (typeof cols === 'number' && cols > 0) return cols;
  const envCols = Number(process.env.COLUMNS);
  if (Number.isFinite(envCols) && envCols > 0) return envCols;
  return 80;
}

/**
 * Render all lines based on configuration. When `autoWrap` is enabled, a
 * logical line that exceeds the resolved width is split across multiple
 * physical lines at separator boundaries.
 */
export async function renderAllLines(ctx: WidgetContext): Promise<string[]> {
  const lines = getLines(ctx.config);
  const separator = getSeparator();
  const perLineSegments = await Promise.all(
    lines.map((lineWidgets) => renderLineSegments(lineWidgets, ctx))
  );

  const wrapWidth = ctx.config.autoWrap ? resolveWrapWidth(ctx.config, ctx.stdin) : null;

  const output: string[] = [];
  for (const segments of perLineSegments) {
    if (segments.length === 0) continue;
    if (wrapWidth !== null) {
      output.push(...wrapSegments(segments, separator, wrapWidth));
    } else {
      output.push(segments.join(separator));
    }
  }
  return output;
}

/**
 * Format final output with multiple lines
 */
export async function formatOutput(ctx: WidgetContext): Promise<string> {
  const lines = await renderAllLines(ctx);
  return lines.join('\n');
}
