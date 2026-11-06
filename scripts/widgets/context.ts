/**
 * Context widgets - full display plus bar/percentage/usage sub-widgets
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, ContextData } from '../types.js';
import { getColorForPercent, colorize, getSeparator } from '../utils/colors.js';
import { formatTokens, calculatePercent } from '../utils/formatters.js';
import { renderProgressBar } from '../utils/progress-bar.js';

/** Coerce a possibly-missing/garbage numeric field to a finite, non-negative number. */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** True only for a real, finite percentage we can render. */
function hasOfficialPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

async function getContextData(ctx: WidgetContext): Promise<ContextData | null> {
  const { context_window } = ctx.stdin;
  const usage = context_window?.current_usage;
  const contextSize = num(context_window?.context_window_size) || 200000;
  const officialPercent = context_window?.used_percentage;

  if (!usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextSize,
      percentage: hasOfficialPercent(officialPercent) ? Math.round(officialPercent) : 0,
    };
  }

  // Defensive: any field may be absent on partial/streaming payloads (e.g. agy
  // mid-stream). num() keeps the math finite so the bar/percent never show NaN.
  const inputTokens =
    num(usage.input_tokens) +
    num(usage.cache_creation_input_tokens) +
    num(usage.cache_read_input_tokens);
  const outputTokens = num(usage.output_tokens);
  const totalTokens = inputTokens + outputTokens;
  const percentage = hasOfficialPercent(officialPercent)
    ? Math.round(officialPercent)
    : calculatePercent(inputTokens, contextSize);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    contextSize,
    percentage,
  };
}

function renderBar(data: ContextData): string {
  return renderProgressBar(data.percentage);
}

function renderPercentage(data: ContextData): string {
  return colorize(`${data.percentage}%`, getColorForPercent(data.percentage));
}

function renderUsage(data: ContextData): string {
  return `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`;
}

export const contextWidget: Widget<ContextData> = {
  id: 'context',
  name: 'Context',
  getData: getContextData,

  render(data: ContextData): string {
    return [renderBar(data), renderPercentage(data), renderUsage(data)].join(getSeparator());
  },
};

export const contextBarWidget: Widget<ContextData> = {
  id: 'contextBar',
  name: 'Context (Bar)',
  getData: getContextData,
  render: renderBar,
};

export const contextPercentageWidget: Widget<ContextData> = {
  id: 'contextPercentage',
  name: 'Context (Percentage)',
  getData: getContextData,
  render: renderPercentage,
};

export const contextUsageWidget: Widget<ContextData> = {
  id: 'contextUsage',
  name: 'Context (Usage)',
  getData: getContextData,
  render: renderUsage,
};
