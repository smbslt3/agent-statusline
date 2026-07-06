/**
 * @covers scripts/widgets/model.ts
 * @covers scripts/widgets/context.ts
 * @covers scripts/widgets/cost.ts
 * @covers scripts/widgets/todo-progress.ts
 * @covers scripts/widgets/agent-status.ts
 * @covers scripts/widgets/tool-activity.ts
 * @covers scripts/widgets/project-info.ts
 * @covers scripts/widgets/burn-rate.ts
 * @covers scripts/widgets/cache-hit.ts
 * @covers scripts/widgets/config-counts.ts
 * @covers scripts/widgets/session-duration.ts
 * @covers scripts/widgets/version.ts
 * @covers scripts/widgets/lines-changed.ts
 * @covers scripts/widgets/output-style.ts
 * @covers scripts/widgets/token-speed.ts
 * @covers scripts/widgets/session-name.ts
 * @covers scripts/widgets/today-cost.ts
 * @covers scripts/widgets/budget.ts
 * @covers scripts/widgets/forecast.ts
 * @covers scripts/widgets/token-breakdown.ts
 * @covers scripts/widgets/last-prompt.ts
 * @covers scripts/widgets/vim-mode.ts
 * @covers scripts/widgets/api-duration.ts
 * @covers scripts/widgets/tag-status.ts
 * @covers scripts/widgets/slash-command.ts
 * @covers scripts/widgets/agent-mode.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { modelWidget, getDefaultEffort } from '../widgets/model.js';
import {
  contextWidget,
  contextBarWidget,
  contextPercentageWidget,
  contextUsageWidget,
} from '../widgets/context.js';
import { costWidget } from '../widgets/cost.js';
import { extraUsageWidget } from '../widgets/extra-usage.js';
import { agentCreditsWidget } from '../widgets/agent-credits.js';
import { agentStateWidget } from '../widgets/agent-state.js';
import { agentSubagentsWidget } from '../widgets/agent-subagents.js';
import { agentTasksWidget } from '../widgets/agent-tasks.js';
import { todoProgressWidget } from '../widgets/todo-progress.js';
import { agentStatusWidget } from '../widgets/agent-status.js';
import { toolActivityWidget } from '../widgets/tool-activity.js';
import { projectInfoWidget, clearGitCacheForTest } from '../widgets/project-info.js';
import { burnRateWidget } from '../widgets/burn-rate.js';
import { cacheHitWidget } from '../widgets/cache-hit.js';
import { configCountsWidget } from '../widgets/config-counts.js';
import { sessionDurationWidget } from '../widgets/session-duration.js';
import { versionWidget } from '../widgets/version.js';
import { linesChangedWidget, clearDiffCacheForTest } from '../widgets/lines-changed.js';
import { outputStyleWidget } from '../widgets/output-style.js';
import { tokenSpeedWidget } from '../widgets/token-speed.js';
import { sessionNameWidget } from '../widgets/session-name.js';
import { todayCostWidget } from '../widgets/today-cost.js';
import { budgetWidget } from '../widgets/budget.js';
import { forecastWidget } from '../widgets/forecast.js';
import { tokenBreakdownWidget } from '../widgets/token-breakdown.js';
import { lastPromptWidget } from '../widgets/last-prompt.js';
import { slashCommandWidget } from '../widgets/slash-command.js';
import { agentModeWidget } from '../widgets/agent-mode.js';
import { vimModeWidget } from '../widgets/vim-mode.js';
import { apiDurationWidget } from '../widgets/api-duration.js';
import { tagStatusWidget, clearTagCacheForTest } from '../widgets/tag-status.js';
import { ICON } from '../utils/emoji.js';
import * as historyParser from '../utils/history-parser.js';
import * as gitUtils from '../utils/git.js';
import * as sessionUtils from '../utils/session.js';
import * as budgetUtils from '../utils/budget.js';
import * as transcriptParser from '../utils/transcript-parser.js';
import type { WidgetContext, StdinInput, ModelData } from '../types.js';
import { MOCK_TRANSLATIONS, MOCK_CONFIG, MOCK_STDIN } from './fixtures.js';

// Mock version module (consumed transitively by api-client).
vi.mock('../version.js', () => ({
  VERSION: '1.0.0-test',
}));

function createStdin(overrides: Partial<StdinInput> = {}): StdinInput {
  return { ...MOCK_STDIN, ...overrides };
}

function createContext(
  stdinOverrides: Partial<StdinInput> = {},
  ctxOverrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: createStdin(stdinOverrides),
    config: MOCK_CONFIG,
    translations: MOCK_TRANSLATIONS,
    rateLimits: null,
    // Default mock account is a subscription (rate-limit/extraUsage widgets show).
    // The cost widgets (cost/forecast/todayCost) are API-only — those tests pass
    // { isApiAccount: true } to exercise the API path.
    isApiAccount: false,
    ...ctxOverrides,
  };
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function createModelData(overrides: Partial<ModelData> = {}): ModelData {
  return {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    effortLevel: 'high',
    fastMode: false,
    ...overrides,
  };
}

describe('widgets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearGitCacheForTest();
    clearDiffCacheForTest();
    clearTagCacheForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('modelWidget', () => {
    it('should have correct id and name', () => {
      expect(modelWidget.id).toBe('model');
      expect(modelWidget.name).toBe('Model');
    });

    it('should return default values when model data is missing', async () => {
      const ctx = createContext({ model: undefined as any });
      const data = await modelWidget.getData(ctx);
      expect(data).toEqual({
        id: '',
        displayName: '-',
        effortLevel: expect.stringMatching(/^(xhigh|high|medium|low)$/),
        fastMode: expect.any(Boolean),
      });
    });

    it('should extract model data', async () => {
      const ctx = createContext();
      const data = await modelWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.id).toBe('claude-sonnet-3.5');
      expect(data?.displayName).toBe('Claude 3.5 Sonnet');
    });

    it('should render shortened model name with effort for Sonnet', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet', displayName: 'Claude 3.5 Sonnet' }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('✽'); // Claude provider mark (heavy asterisk)
      expect(result).toContain('(H)');
    });

    it('should shorten Opus model name with effort', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-opus', displayName: 'Claude Opus 4' }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(H)');
    });

    it('should show medium effort for Opus 4.6 when set', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', effortLevel: 'medium' }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(M)');
    });

    it('should show medium effort for Sonnet 4.6 by default', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', effortLevel: 'medium' }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('(M)');
    });

    it('should show effort level for Sonnet', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', effortLevel: 'low' }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('(L)');
    });

    it('should show xhigh effort as (xH) for Opus', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-opus-4-7', displayName: 'Claude Opus 4.7', effortLevel: 'xhigh' }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(xH)');
      expect(result).not.toContain('(X)');
    });

    it('should clamp xhigh to (H) on Sonnet, which has no xhigh tier', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', effortLevel: 'xhigh' }),
        ctx,
      );

      // Global xhigh setting falls back to the high the model actually runs at.
      expect(result).toContain('Sonnet');
      expect(result).toContain('(H)');
      expect(result).not.toContain('(xH)');
    });

    it('should show xhigh effort as (xH) for Sonnet 5', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5', effortLevel: 'xhigh' }),
        ctx,
      );

      // Sonnet 5 gained the xhigh tier, so it must NOT be clamped to (H).
      expect(result).toContain('Sonnet');
      expect(result).toContain('(xH)');
      expect(result).not.toContain('(H)');
    });

    it('should not show effort level for Haiku', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-haiku', displayName: 'Claude 4.5 Haiku' }),
        ctx,
      );

      expect(result).toContain('Haiku');
      expect(result).not.toContain('(H)');
      expect(result).not.toContain('(M)');
      expect(result).not.toContain('(L)');
    });

    it('should shorten Fable name and show effort', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-fable-5', displayName: 'Fable 5', effortLevel: 'high' }),
        ctx,
      );

      expect(result).toContain('Fable');
      expect(result).not.toContain('Fable 5'); // version dropped
      expect(result).toContain('✽'); // Claude provider mark
      expect(result).toContain('(H)');
    });

    it('should show xhigh effort as (xH) for Fable (not clamped)', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-fable-5', displayName: 'Fable 5', effortLevel: 'xhigh' }),
        ctx,
      );

      expect(result).toContain('Fable');
      expect(result).toContain('(xH)');
      expect(result).not.toContain('(H)');
    });

    it('should not show fast mode indicator for Fable', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-fable-5', displayName: 'Fable 5', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Fable');
      expect(result).not.toContain('↯');
    });

    it('should compact a gemini (agy) reasoning level into a (H) badge', () => {
      const ctx = createContext({ product: 'antigravity' });
      const result = stripAnsi(modelWidget.render(
        createModelData({ id: 'gemini-3-flash', displayName: 'Gemini 3.5 Flash (High)' }),
        ctx,
      ));

      expect(result).toContain('Λ'); // agy provider mark
      expect(result).toContain('Gemini 3.5 Flash (H)');
      expect(result).not.toContain('(High)');
    });

    it('uses the agy mark/color (not Claude ✽) for a Claude model on the agy host', () => {
      // The status line must always show which HOST you're in: on agy, even an
      // Opus model keeps the Antigravity Λ mark + gradient; only the name changes.
      const ctx = createContext({ product: 'antigravity' });
      const thinking = stripAnsi(modelWidget.render(
        createModelData({ id: 'claude-opus', displayName: 'Claude Opus 4.6 (Thinking)' }), ctx));
      expect(thinking).toContain('Λ');
      expect(thinking).not.toContain('✽');
      expect(thinking).toContain('Opus');
      expect(thinking).not.toContain('Claude Opus 4.6');

      // An agy-supplied effort parenthetical still compacts to a badge.
      const high = stripAnsi(modelWidget.render(
        createModelData({ id: 'claude-opus', displayName: 'Claude Opus 4.6 (High)' }), ctx));
      expect(high).toContain('Opus (H)');
      expect(high).not.toContain('✽');
    });

    it('should map gemini medium/low reasoning levels to (M)/(L)', () => {
      const ctx = createContext({ product: 'antigravity' });
      const med = stripAnsi(modelWidget.render(createModelData({ id: 'g', displayName: 'Gemini 3 Pro (Medium)' }), ctx));
      const low = stripAnsi(modelWidget.render(createModelData({ id: 'g', displayName: 'Gemini 3 Pro (Low)' }), ctx));

      expect(med).toContain('Gemini 3 Pro (M)');
      expect(low).toContain('Gemini 3 Pro (L)');
    });

    it('should leave a gemini name without a known effort parenthetical unchanged', () => {
      const ctx = createContext({ product: 'antigravity' });
      const result = stripAnsi(modelWidget.render(
        createModelData({ id: 'gemini-3-pro', displayName: 'Gemini 3 Pro' }),
        ctx,
      ));

      expect(result).toContain('Gemini 3 Pro');
      expect(result).not.toContain('()');
    });

    it('should show fast mode indicator for Opus', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ effortLevel: 'medium', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Opus');
      expect(result).toContain('(M)');
      expect(result).toContain('↯');
    });

    it('should not show fast mode indicator for Sonnet', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Sonnet');
      expect(result).toContain('(H)');
      expect(result).not.toContain('↯');
    });

    it('should not show fast mode indicator for Haiku', () => {
      const ctx = createContext();
      const result = modelWidget.render(
        createModelData({ id: 'claude-haiku', displayName: 'Claude 4.5 Haiku', fastMode: true }),
        ctx,
      );

      expect(result).toContain('Haiku');
      expect(result).not.toContain('↯');
    });

    it('should not show fast mode indicator when fast mode is off', () => {
      const ctx = createContext();
      const result = modelWidget.render(createModelData(), ctx);

      expect(result).toContain('Opus');
      expect(result).toContain('(H)');
      expect(result).not.toContain('↯');
    });
  });

  describe('getDefaultEffort', () => {
    it('should return xhigh for opus models', () => {
      expect(getDefaultEffort('claude-opus-4-7')).toBe('xhigh');
      expect(getDefaultEffort('claude-opus-4-6')).toBe('xhigh');
    });

    it('should return medium for sonnet models', () => {
      expect(getDefaultEffort('claude-sonnet-4-6')).toBe('medium');
      expect(getDefaultEffort('claude-sonnet-3.5')).toBe('medium');
    });

    it('should return xhigh for fable models', () => {
      expect(getDefaultEffort('claude-fable-5')).toBe('xhigh');
    });

    it('should return high as safety net for unknown models', () => {
      expect(getDefaultEffort('unknown-model')).toBe('high');
      expect(getDefaultEffort('')).toBe('high');
    });
  });

  describe('contextWidget', () => {
    it('should have correct id and name', () => {
      expect(contextWidget.id).toBe('context');
      expect(contextWidget.name).toBe('Context');
    });

    it('should return default values when usage is missing', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
      });
      const data = await contextWidget.getData(ctx);
      expect(data).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextSize: 200000,
        percentage: 0,
      });
    });

    it('should calculate context data correctly', async () => {
      const ctx = createContext();
      const data = await contextWidget.getData(ctx);

      expect(data).not.toBeNull();
      // input_tokens(5000) + cache_creation(1000) + cache_read(500) = 6500
      expect(data?.inputTokens).toBe(6500);
      expect(data?.outputTokens).toBe(2000);
      expect(data?.totalTokens).toBe(8500);
      expect(data?.contextSize).toBe(200000);
      // 6500 / 200000 * 100 = 3.25% -> 3%
      expect(data?.percentage).toBe(3);
    });

    it('should use official used_percentage when available', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 2000,
          context_window_size: 200000,
          used_percentage: 42,
          current_usage: {
            input_tokens: 5000,
            output_tokens: 2000,
            cache_creation_input_tokens: 1000,
            cache_read_input_tokens: 500,
          },
        },
      });
      const data = await contextWidget.getData(ctx);

      expect(data?.percentage).toBe(42);
    });

    it('should fall back to calculated percentage when used_percentage is null', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 2000,
          context_window_size: 200000,
          used_percentage: null,
          current_usage: {
            input_tokens: 5000,
            output_tokens: 2000,
            cache_creation_input_tokens: 1000,
            cache_read_input_tokens: 500,
          },
        },
      });
      const data = await contextWidget.getData(ctx);

      // Fallback: calculatePercent(6500, 200000) = 3%
      expect(data?.percentage).toBe(3);
    });

    it('should fall back to calculated percentage when used_percentage is undefined', async () => {
      const ctx = createContext();
      const data = await contextWidget.getData(ctx);

      // No used_percentage in MOCK_STDIN, so fallback
      expect(data?.percentage).toBe(3);
    });

    it('should use used_percentage even when current_usage is null', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          used_percentage: 15,
          current_usage: null,
        },
      });
      const data = await contextWidget.getData(ctx);

      expect(data?.percentage).toBe(15);
    });

    it('should render progress bar and percentage', () => {
      const ctx = createContext();
      const data = {
        inputTokens: 50000,
        outputTokens: 10000,
        totalTokens: 60000,
        contextSize: 200000,
        percentage: 25,
      };
      const result = contextWidget.render(data, ctx);

      expect(result).toContain('25%');
      expect(result).toContain('50K/200K');
    });
  });

  describe('context sub-widgets', () => {
    const sampleData = {
      inputTokens: 50000,
      outputTokens: 10000,
      totalTokens: 60000,
      contextSize: 200000,
      percentage: 25,
    };

    it('contextBarWidget has correct id and name', () => {
      expect(contextBarWidget.id).toBe('contextBar');
      expect(contextBarWidget.name).toBe('Context (Bar)');
    });

    it('contextBarWidget renders only the progress bar (no percent, no tokens)', () => {
      const ctx = createContext();
      const result = contextBarWidget.render(sampleData, ctx);
      expect(result).not.toContain('25%');
      expect(result).not.toContain('50K/200K');
      expect(result.length).toBeGreaterThan(0);
    });

    it('contextPercentageWidget has correct id and name', () => {
      expect(contextPercentageWidget.id).toBe('contextPercentage');
      expect(contextPercentageWidget.name).toBe('Context (Percentage)');
    });

    it('contextPercentageWidget renders only the percentage', () => {
      const ctx = createContext();
      const result = contextPercentageWidget.render(sampleData, ctx);
      expect(result).toContain('25%');
      expect(result).not.toContain('50K/200K');
    });

    it('contextUsageWidget has correct id and name', () => {
      expect(contextUsageWidget.id).toBe('contextUsage');
      expect(contextUsageWidget.name).toBe('Context (Usage)');
    });

    it('contextUsageWidget renders only the token count', () => {
      const ctx = createContext();
      const result = contextUsageWidget.render(sampleData, ctx);
      expect(result).toContain('50K/200K');
      expect(result).not.toContain('25%');
    });

    it('sub-widgets share the same getData reference as contextWidget', () => {
      expect(contextBarWidget.getData).toBe(contextWidget.getData);
      expect(contextPercentageWidget.getData).toBe(contextWidget.getData);
      expect(contextUsageWidget.getData).toBe(contextWidget.getData);
    });
  });

  describe('costWidget', () => {
    it('should have correct id and name', () => {
      expect(costWidget.id).toBe('cost');
      expect(costWidget.name).toBe('Cost');
    });

    it('should return default values when cost is missing', async () => {
      const ctx = createContext({ cost: undefined as any }, { isApiAccount: true });
      const data = await costWidget.getData(ctx);
      expect(data).toEqual({ totalCostUsd: 0 });
    });

    it('should extract cost data', async () => {
      const ctx = createContext({}, { isApiAccount: true });
      const data = await costWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.totalCostUsd).toBe(0.75);
    });

    it('should hide on a subscription account (cost is notional there)', async () => {
      expect(await costWidget.getData(createContext({}, { isApiAccount: false }))).toBeNull();
    });

    it('should render formatted cost', () => {
      const ctx = createContext();
      const data = { totalCostUsd: 1.5 };
      const result = costWidget.render(data, ctx);

      expect(result).toContain('$1.50');
    });
  });

  describe('extraUsageWidget', () => {
    const xu = (over: Record<string, unknown> = {}) => ({
      five_hour: null, seven_day: null, seven_day_sonnet: null,
      extra_usage: { is_enabled: true, used_credits: 3.2, monthly_limit: 50, utilization: 6, currency: 'USD', ...over },
    });

    it('should have correct id and name', () => {
      expect(extraUsageWidget.id).toBe('extraUsage');
      expect(extraUsageWidget.name).toBe('Extra Usage');
    });

    it('hides when extra_usage is absent', async () => {
      const ctx = createContext();
      ctx.rateLimits = { five_hour: null, seven_day: null, seven_day_sonnet: null };
      expect(await extraUsageWidget.getData(ctx)).toBeNull();
    });

    it('hides when extra usage is not enabled', async () => {
      const ctx = createContext();
      ctx.rateLimits = xu({ is_enabled: false }) as any;
      expect(await extraUsageWidget.getData(ctx)).toBeNull();
    });

    it('hides when enabled but no monthly cap', async () => {
      const ctx = createContext();
      ctx.rateLimits = xu({ monthly_limit: null }) as any;
      expect(await extraUsageWidget.getData(ctx)).toBeNull();
    });

    it('shows used/limit when extra usage is active', async () => {
      const ctx = createContext();
      ctx.rateLimits = xu() as any;
      const data = await extraUsageWidget.getData(ctx);
      expect(data).toEqual({ usedCredits: 3.2, monthlyLimit: 50, currency: 'USD', utilization: 6 });
      const out = stripAnsi(extraUsageWidget.render(data!, ctx));
      expect(out).toContain('extra');
      expect(out).toContain('$3.20/$50.00');
    });

    it('hides on the agy (gemini) host', async () => {
      const ctx = createContext({ model: { id: 'gemini-3', display_name: 'Gemini 3.5 Flash (High)' } });
      ctx.rateLimits = xu() as any;
      expect(await extraUsageWidget.getData(ctx)).toBeNull();
    });
  });

  describe('agentCreditsWidget', () => {
    const agyStdin = { model: { id: 'gemini-3', display_name: 'Gemini 3.5 Flash (High)' }, product: 'antigravity' } as Partial<StdinInput>;
    const usage = (credits: unknown) => ({
      model: 'Gemini 3.5 Flash (High)', usedPercent: 30, resetAt: null, modelCount: 8, buckets: [], credits,
    });

    it('should have correct id and name', () => {
      expect(agentCreditsWidget.id).toBe('agentCredits');
      expect(agentCreditsWidget.name).toBe('Antigravity Credits');
    });

    it('hides on the Claude host even when the balance is low', async () => {
      const ctx = createContext();
      ctx.antigravityUsage = usage({ amount: 20, type: 'GOOGLE_ONE_AI', minForUsage: 50 }) as any;
      expect(await agentCreditsWidget.getData(ctx)).toBeNull();
    });

    it('hides on agy when no credit balance is reported', async () => {
      const ctx = createContext(agyStdin);
      ctx.antigravityUsage = usage(null) as any;
      expect(await agentCreditsWidget.getData(ctx)).toBeNull();
    });

    it('hides on agy when the balance is healthy (above the low threshold)', async () => {
      const ctx = createContext(agyStdin);
      ctx.antigravityUsage = usage({ amount: 1000, type: 'GOOGLE_ONE_AI', minForUsage: 50 }) as any;
      expect(await agentCreditsWidget.getData(ctx)).toBeNull(); // 1000 > 50*2
    });

    it('shows a low-balance warning on agy when the balance is at/below the threshold', async () => {
      const ctx = createContext(agyStdin);
      ctx.antigravityUsage = usage({ amount: 80, type: 'GOOGLE_ONE_AI', minForUsage: 50 }) as any; // 80 <= 100
      const data = await agentCreditsWidget.getData(ctx);
      expect(data).toEqual({ amount: 80, type: 'GOOGLE_ONE_AI' });
      expect(stripAnsi(agentCreditsWidget.render(data!, ctx))).toBe('credits: 80');
    });

    it('respects a configured agentCreditsThreshold', async () => {
      const ctx = createContext(agyStdin);
      ctx.config = { ...ctx.config, agentCreditsThreshold: 500 };
      ctx.antigravityUsage = usage({ amount: 300, type: 'GOOGLE_ONE_AI', minForUsage: 50 }) as any; // 300 <= 500
      expect(await agentCreditsWidget.getData(ctx)).toEqual({ amount: 300, type: 'GOOGLE_ONE_AI' });
    });
  });

  describe('agentStateWidget', () => {
    const agy = (extra: Partial<StdinInput> = {}) =>
      createContext({ model: { id: 'gemini-3', display_name: 'Gemini 3.5 Flash (High)' }, product: 'antigravity', ...extra });

    it('has correct id and name', () => {
      expect(agentStateWidget.id).toBe('agentState');
      expect(agentStateWidget.name).toBe('Antigravity State');
    });
    it('shows the working indicator on agy when agent_state is working', async () => {
      const ctx = agy({ agent_state: 'working' });
      const data = await agentStateWidget.getData(ctx);
      expect(data).toEqual({ state: 'working' });
      expect(stripAnsi(agentStateWidget.render(data!, ctx))).toContain('working');
    });
    it('hides when idle', async () => {
      expect(await agentStateWidget.getData(agy({ agent_state: 'idle' }))).toBeNull();
    });
    it('hides on the Claude host', async () => {
      expect(await agentStateWidget.getData(createContext({ agent_state: 'working' }))).toBeNull();
    });
  });

  describe('agentSubagentsWidget', () => {
    const agy = (extra: Partial<StdinInput> = {}) =>
      createContext({ model: { id: 'gemini-3', display_name: 'Gemini 3.5 Flash (High)' }, product: 'antigravity', ...extra });

    it('has correct id', () => {
      expect(agentSubagentsWidget.id).toBe('agentSubagents');
    });
    it('shows the running subagent count on agy', async () => {
      const ctx = agy({ subagents: [{ status: 'running' }, { status: 'running' }, { status: 'done' }] });
      const data = await agentSubagentsWidget.getData(ctx);
      expect(data).toEqual({ running: 2, total: 3 });
      expect(stripAnsi(agentSubagentsWidget.render(data!, ctx))).toContain('2 subagent');
    });
    it('hides when no subagents are running', async () => {
      expect(await agentSubagentsWidget.getData(agy({ subagents: [{ status: 'done' }] }))).toBeNull();
    });
    it('hides on the Claude host', async () => {
      expect(await agentSubagentsWidget.getData(createContext({ subagents: [{ status: 'running' }] }))).toBeNull();
    });
  });

  describe('agentTasksWidget', () => {
    const agy = (extra: Partial<StdinInput> = {}) =>
      createContext({ model: { id: 'gemini-3', display_name: 'Gemini 3.5 Flash (High)' }, product: 'antigravity', ...extra });

    it('has correct id', () => {
      expect(agentTasksWidget.id).toBe('agentTasks');
    });
    it('shows the running task count when tasks are present', async () => {
      const ctx = agy({ tasks: [{ status: 'running' }, { status: 'completed' }] });
      const data = await agentTasksWidget.getData(ctx);
      expect(data).toEqual({ running: 1, total: 2 });
      expect(stripAnsi(agentTasksWidget.render(data!, ctx))).toContain('1 task');
    });
    it('hides when there is no tasks field', async () => {
      expect(await agentTasksWidget.getData(agy({}))).toBeNull();
    });
    it('hides on the Claude host', async () => {
      expect(await agentTasksWidget.getData(createContext({ tasks: [{ status: 'running' }] }))).toBeNull();
    });
  });

  describe('projectInfoWidget', () => {
    it('should have correct id and name', () => {
      expect(projectInfoWidget.id).toBe('projectInfo');
      expect(projectInfoWidget.name).toBe('Project Info');
    });

    it('should return null when workspace is missing', async () => {
      const ctx = createContext({ workspace: undefined as any });
      const data = await projectInfoWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should extract directory name', async () => {
      const ctx = createContext();
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dirName).toBe('project');
    });

    it('should render directory with folder icon', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project', gitBranch: 'main' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain(ICON.folder);
      expect(result).toContain('my-project');
      expect(result).toContain('main');
    });

    it('should render without git branch if not available', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain('my-project');
      expect(result).not.toContain('(');
    });

    it('should use project_dir for dirName when available', async () => {
      const ctx = createContext({
        workspace: { current_dir: '/project/src/components', project_dir: '/project' },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dirName).toBe('project');
      expect(data?.subPath).toBe('src/components');
    });

    it('should normalize Windows project_dir subPath separators', async () => {
      const ctx = createContext({
        workspace: {
          current_dir: 'C:\\repo\\project\\src\\components',
          project_dir: 'C:\\repo\\project',
        },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dirName).toBe('project');
      expect(data?.subPath).toBe('src/components');
    });

    it('should not set subPath when current_dir equals project_dir', async () => {
      const ctx = createContext({
        workspace: { current_dir: '/project', project_dir: '/project' },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.subPath).toBeUndefined();
    });

    it('should not set subPath when project_dir is missing', async () => {
      const ctx = createContext();
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.subPath).toBeUndefined();
    });

    it('should not set subPath when current_dir is a sibling with same prefix', async () => {
      const ctx = createContext({
        workspace: { current_dir: '/home/user/proj-backup/src', project_dir: '/home/user/proj' },
      });
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.subPath).toBeUndefined();
    });

    it('should render subPath in parentheses', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project', gitBranch: 'main', subPath: 'src/components' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain('my-project (src/components)');
    });

    it('should extract worktree name from stdin', async () => {
      const ctx = createContext({
        worktree: { name: 'my-feature', path: '/tmp/wt', original_cwd: '/project' },
      } as any);
      const data = await projectInfoWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.worktreeName).toBe('my-feature');
    });

    it('should not set worktreeName when worktree is missing', async () => {
      const ctx = createContext();
      const data = await projectInfoWidget.getData(ctx);

      expect(data?.worktreeName).toBeUndefined();
    });

    it('should render worktree indicator', () => {
      const ctx = createContext();
      const data = { dirName: 'my-project', gitBranch: 'main', worktreeName: 'my-feature' };
      const result = projectInfoWidget.render(data, ctx);

      expect(result).toContain(ICON.tree);
      expect(result).toContain('wt:my-feature');
    });

    it('should re-fetch after clearGitCacheForTest()', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'rev-parse') return 'main\n';
        if (args[0] === 'status') return '';
        if (args[0] === 'rev-list') return '0\t0\n';
        if (args[0] === 'remote') return '';
        return '';
      });
      const ctx = createContext();

      await projectInfoWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      await projectInfoWidget.getData(ctx);
      expect(spy.mock.calls.length).toBe(callsAfterFirst); // cached

      clearGitCacheForTest();
      await projectInfoWidget.getData(ctx);
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // re-fetched
    });
  });

  describe('todoProgressWidget', () => {
    it('should have correct id and name', () => {
      expect(todoProgressWidget.id).toBe('todoProgress');
      expect(todoProgressWidget.name).toBe('Todo Progress');
    });

    it('should return null when no transcript path', async () => {
      const ctx = createContext();
      const data = await todoProgressWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should hide widget (return null) when transcript has no todos', async () => {
      const ctx = createContext({ transcript_path: '/nonexistent/path.jsonl' });
      const data = await todoProgressWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render current task with progress', () => {
      const ctx = createContext();
      const data = {
        current: { content: 'Fix bug', status: 'in_progress' as const },
        completed: 2,
        total: 5,
      };
      const result = todoProgressWidget.render(data, ctx);

      expect(result).toContain('Fix bug');
      expect(result).toContain('[2/5]');
      expect(result).toContain('✓');
    });

    it('should truncate long task names', () => {
      const ctx = createContext();
      const data = {
        current: { content: 'This is a very long task name that should be truncated', status: 'in_progress' as const },
        completed: 1,
        total: 3,
      };
      const result = todoProgressWidget.render(data, ctx);

      expect(result).toContain('…');
    });

    it('should render completed state', () => {
      const ctx = createContext();
      const data = { completed: 5, total: 5 };
      const result = todoProgressWidget.render(data, ctx);

      expect(result).toContain('Tasks');
      expect(result).toContain('5/5');
    });
  });

  describe('agentStatusWidget', () => {
    it('should have correct id and name', () => {
      expect(agentStatusWidget.id).toBe('agentStatus');
      expect(agentStatusWidget.name).toBe('Agent Status');
    });

    it('should return null when no transcript path', async () => {
      const ctx = createContext();
      const data = await agentStatusWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render active agent', () => {
      const ctx = createContext();
      const data = {
        active: [{ name: 'Explore', description: 'Searching codebase' }],
        completed: 2,
      };
      const result = agentStatusWidget.render(data, ctx);

      expect(result).toContain('Agent');
      expect(result).toContain('Explore');
      expect(result).toContain(ICON.robot);
    });

    it('should truncate long descriptions', () => {
      const ctx = createContext();
      const data = {
        active: [{ name: 'Explore', description: 'This is a very long description that needs truncation' }],
        completed: 0,
      };
      const result = agentStatusWidget.render(data, ctx);

      expect(result).toContain('…');
    });

    it('should show completed count when no active agents', () => {
      const ctx = createContext();
      const data = { active: [], completed: 5 };
      const result = agentStatusWidget.render(data, ctx);

      expect(result).toContain('Agent');
      expect(result).toContain('5');
      expect(result).toContain('done');
    });
  });

  describe('toolActivityWidget', () => {
    it('should have correct id and name', () => {
      expect(toolActivityWidget.id).toBe('toolActivity');
      expect(toolActivityWidget.name).toBe('Tool Activity');
    });

    it('should return null when no transcript path', async () => {
      const ctx = createContext();
      const data = await toolActivityWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render running tools', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Bash', startTime: Date.now() },
          { name: 'Read', startTime: Date.now() },
        ],
        completed: 10,
      };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Bash');
      expect(result).toContain('Read');
      expect(result).toContain('10');
      expect(result).toContain(ICON.gear);
    });

    it('should limit displayed running tools', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Bash', startTime: Date.now() },
          { name: 'Read', startTime: Date.now() },
          { name: 'Write', startTime: Date.now() },
          { name: 'Edit', startTime: Date.now() },
        ],
        completed: 5,
      };
      const result = toolActivityWidget.render(data, ctx);

      // Should show first 2 and "+2"
      expect(result).toContain('+2');
    });

    it('should show completed count when no running tools', () => {
      const ctx = createContext();
      const data = { running: [], completed: 15 };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Tools');
      expect(result).toContain('15');
      expect(result).toContain('done');
    });

    it('should render tool targets when present', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Read', startTime: Date.now(), target: 'app.ts' },
          { name: 'Bash', startTime: Date.now(), target: 'npm test' },
        ],
        completed: 3,
      };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Read(app.ts)');
      expect(result).toContain('Bash(npm test)');
    });

    it('should render tool name only when target is absent', () => {
      const ctx = createContext();
      const data = {
        running: [
          { name: 'Agent', startTime: Date.now() },
        ],
        completed: 2,
      };
      const result = toolActivityWidget.render(data, ctx);

      expect(result).toContain('Agent');
      expect(result).not.toContain('Agent(');
    });
  });

  describe('burnRateWidget', () => {
    it('should have correct id and name', () => {
      expect(burnRateWidget.id).toBe('burnRate');
      expect(burnRateWidget.name).toBe('Burn Rate');
    });

    it('should return 0 when usage is missing', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
      });
      const data = await burnRateWidget.getData(ctx);
      expect(data).toEqual({ tokensPerMinute: 0 });
    });

    it('should render burn rate with tokens per minute', () => {
      const ctx = createContext();
      const data = { tokensPerMinute: 5500 };
      const result = burnRateWidget.render(data, ctx);

      expect(result).toContain(ICON.fire);
      expect(result).toContain('5.5K');
      expect(result).toContain('/min');
    });

    it('should format large burn rates correctly', () => {
      const ctx = createContext();
      const data = { tokensPerMinute: 1500000 };
      const result = burnRateWidget.render(data, ctx);

      expect(result).toContain('1.5M');
    });

    it('shows 0/min while the session is too young to compute a meaningful rate', async () => {
      // A freshly-started session (well under a minute) with real tokens would
      // otherwise divide by ~0 and explode (e.g. 6120M/min) — common on agy. We
      // show 0/min instead of hiding so the widget stays put and just updates.
      vi.spyOn(sessionUtils, 'getSessionElapsedMinutes').mockResolvedValue(0.02);
      const ctx = createContext({
        context_window: {
          total_input_tokens: 90000,
          total_output_tokens: 12000,
          context_window_size: 200000,
          current_usage: { input_tokens: 90000, output_tokens: 12000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      });
      expect(await burnRateWidget.getData(ctx)).toEqual({ tokensPerMinute: 0 });
    });

    it('computes tokens/min once enough time has elapsed', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMinutes').mockResolvedValue(2); // 2 min
      const ctx = createContext({
        context_window: {
          total_input_tokens: 90000,
          total_output_tokens: 12000,
          context_window_size: 200000,
          current_usage: { input_tokens: 90000, output_tokens: 12000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      });
      // (90000 + 12000) / 2 min = 51000 tokens/min
      expect(await burnRateWidget.getData(ctx)).toEqual({ tokensPerMinute: 51000 });
    });
  });

  describe('cacheHitWidget', () => {
    it('should have correct id and name', () => {
      expect(cacheHitWidget.id).toBe('cacheHit');
      expect(cacheHitWidget.name).toBe('Cache Hit Rate');
    });

    it('should return 0% when usage is missing', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
      });
      const data = await cacheHitWidget.getData(ctx);
      expect(data).toEqual({ hitPercentage: 0 });
    });

    it('should return 0% when no input tokens', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 0,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        },
      });
      const data = await cacheHitWidget.getData(ctx);
      expect(data).toEqual({ hitPercentage: 0 });
    });

    it('should calculate cache hit rate correctly', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 10000,
          total_output_tokens: 5000,
          context_window_size: 200000,
          current_usage: {
            input_tokens: 3000,
            output_tokens: 5000,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 7000,
          },
        },
      });
      const data = await cacheHitWidget.getData(ctx);

      expect(data).not.toBeNull();
      // cache_read(7000) / (cache_read(7000) + input(3000) + cache_creation(0)) = 70%
      expect(data?.hitPercentage).toBe(70);
    });

    it('should include cache_creation_input_tokens in denominator', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 14000,
          total_output_tokens: 5000,
          context_window_size: 200000,
          current_usage: {
            input_tokens: 0,
            output_tokens: 5000,
            cache_creation_input_tokens: 7000,
            cache_read_input_tokens: 7000,
          },
        },
      });
      const data = await cacheHitWidget.getData(ctx);

      expect(data).not.toBeNull();
      // cache_read(7000) / (cache_read(7000) + input(0) + cache_creation(7000)) = 50%
      expect(data?.hitPercentage).toBe(50);
    });

    it('should render cache hit percentage', () => {
      const ctx = createContext();
      const data = { hitPercentage: 67 };
      const result = cacheHitWidget.render(data, ctx);

      expect(result).toContain(ICON.package);
      expect(result).toContain('67%');
    });
  });

  describe('configCountsWidget', () => {
    it('should have correct id and name', () => {
      expect(configCountsWidget.id).toBe('configCounts');
      expect(configCountsWidget.name).toBe('Config Counts');
    });

    it('should return null when workspace is missing', async () => {
      const ctx = createContext({ workspace: undefined as any });
      const data = await configCountsWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render claudeMd count', () => {
      const ctx = createContext();
      const data = { claudeMd: 2, agentsMd: 0, rules: 0, mcps: 0, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('2');
    });

    it('should render rules count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, agentsMd: 0, rules: 5, mcps: 0, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('Rules');
      expect(result).toContain('5');
    });

    it('should render mcps count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 3, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('MCP');
      expect(result).toContain('3');
    });

    it('should render hooks count', () => {
      const ctx = createContext();
      const data = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 0, hooks: 2, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('Hooks');
      expect(result).toContain('2');
    });

    it('should render multiple counts', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 0, rules: 3, mcps: 2, hooks: 1, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md: 1');
      expect(result).toContain('Rules: 3');
      expect(result).toContain('MCP: 2');
      expect(result).toContain('Hooks: 1');
    });

    it('should only render non-zero counts', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 0, rules: 0, mcps: 2, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('MCP');
      expect(result).not.toContain('Rules');
      expect(result).not.toContain('Hooks');
    });

    it('should render agentsMd count', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 2, rules: 0, mcps: 0, hooks: 0, addedDirs: 0 };
      const result = configCountsWidget.render(data, ctx);
      expect(result).toContain('AGENTS.md');
      expect(result).toContain('2');
    });

    it('should render addedDirs count', () => {
      const ctx = createContext();
      const data = { claudeMd: 1, agentsMd: 0, rules: 0, mcps: 0, hooks: 0, addedDirs: 3 };
      const result = configCountsWidget.render(data, ctx);
      expect(result).toContain('+Dirs');
      expect(result).toContain('3');
    });
  });

  describe('sessionDurationWidget', () => {
    it('should have correct id and name', () => {
      expect(sessionDurationWidget.id).toBe('sessionDuration');
      expect(sessionDurationWidget.name).toBe('Session Duration');
    });

    it('should use total_duration_ms from stdin when available', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 600000 },
      });
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(600000); // 10 minutes from stdin
    });

    it('should fall back to file-based duration when total_duration_ms is missing', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(120000);

      const ctx = createContext(); // MOCK_STDIN has no total_duration_ms
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(120000);
    });

    it('should fall back to file-based duration when total_duration_ms is 0', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(60000);

      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 0 },
      });
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(60000);
    });

    it('should return elapsed time data', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(3600000); // 1 hour

      const ctx = createContext();
      const data = await sessionDurationWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.elapsedMs).toBe(3600000);
    });

    it('should use session_id from stdin if available', async () => {
      const mockGetSessionElapsedMs = vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(1000);

      const ctx = createContext();
      ctx.stdin.session_id = 'test-session-123';
      await sessionDurationWidget.getData(ctx);

      expect(mockGetSessionElapsedMs).toHaveBeenCalledWith('test-session-123');
    });

    it('should use default session_id when not provided', async () => {
      const mockGetSessionElapsedMs = vi.spyOn(sessionUtils, 'getSessionElapsedMs').mockResolvedValue(1000);

      const ctx = createContext();
      ctx.stdin.session_id = undefined;
      await sessionDurationWidget.getData(ctx);

      expect(mockGetSessionElapsedMs).toHaveBeenCalledWith('default');
    });

    it('should render duration with timer icon', () => {
      const ctx = createContext();
      const data = { elapsedMs: 3661000 }; // 1h 1m 1s
      const result = sessionDurationWidget.render(data, ctx);

      expect(result).toContain(ICON.stopwatch);
      expect(result).toContain('1h');
    });

    it('should format short durations', () => {
      const ctx = createContext();
      const data = { elapsedMs: 300000 }; // 5 minutes
      const result = sessionDurationWidget.render(data, ctx);

      expect(result).toContain('5m');
    });

    it('should format long durations', () => {
      const ctx = createContext();
      const data = { elapsedMs: 90000000 }; // 25 hours
      const result = sessionDurationWidget.render(data, ctx);

      expect(result).toContain('25h');
    });
  });

  describe('versionWidget', () => {
    it('should have correct id and name', () => {
      expect(versionWidget.id).toBe('version');
      expect(versionWidget.name).toBe('Version');
    });

    it('should use stdin version when available', async () => {
      const ctx = createContext({ version: '1.0.80' });
      const data = await versionWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.version).toBe('1.0.80');
    });

    it('should return null when stdin version is missing', async () => {
      const ctx = createContext(); // No version in MOCK_STDIN
      const data = await versionWidget.getData(ctx);

      expect(data).toBeNull();
    });

    it('should render version with v prefix', () => {
      const ctx = createContext();
      const data = { version: '1.0.80' };
      const result = versionWidget.render(data, ctx);

      expect(result).toContain('v1.0.80');
    });
  });

  describe('linesChangedWidget', () => {
    it('should have correct id and name', () => {
      expect(linesChangedWidget.id).toBe('linesChanged');
      expect(linesChangedWidget.name).toBe('Lines Changed');
    });

    it('should return data from git diff when changes exist', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 3 files changed, 156 insertions(+), 23 deletions(-)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(156);
      expect(data?.removed).toBe(23);
      expect(data?.untracked).toBe(0);
    });

    it('should include untracked file lines in added count', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 1 file changed, 10 insertions(+)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(50);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(60);
      expect(data?.removed).toBe(0);
      expect(data?.untracked).toBe(50);
    });

    it('should return data when only untracked files exist', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue('');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(30);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(30);
      expect(data?.removed).toBe(0);
      expect(data?.untracked).toBe(30);
    });

    it('should return null when git diff is empty and no untracked', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue('');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());
      expect(data).toBeNull();
    });

    it('should return null when git diff fails', async () => {
      vi.spyOn(gitUtils, 'execGit').mockRejectedValue(new Error('not a git repo'));
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());
      expect(data).toBeNull();
    });

    it('should return data with only insertions', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 1 file changed, 42 insertions(+)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(42);
      expect(data?.removed).toBe(0);
    });

    it('should return data with only deletions', async () => {
      vi.spyOn(gitUtils, 'execGit').mockResolvedValue(' 1 file changed, 15 deletions(-)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);

      const data = await linesChangedWidget.getData(createContext());

      expect(data).not.toBeNull();
      expect(data?.added).toBe(0);
      expect(data?.removed).toBe(15);
    });

    it('should render only removed part when added is 0', () => {
      const ctx = createContext();
      const data = { added: 0, removed: 15, untracked: 0 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('-15');
      expect(result).not.toContain('+');
    });

    it('should render only added part when removed is 0', () => {
      const ctx = createContext();
      const data = { added: 100, removed: 0, untracked: 30 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('+100');
      expect(result).not.toContain('-');
    });

    it('should render both added and removed', () => {
      const ctx = createContext();
      const data = { added: 156, removed: 23, untracked: 0 };
      const result = linesChangedWidget.render(data, ctx);

      expect(result).toContain('+156');
      expect(result).toContain('-23');
    });

    it('should re-fetch after clearDiffCacheForTest()', async () => {
      const spy = vi
        .spyOn(gitUtils, 'execGit')
        .mockResolvedValue(' 1 file changed, 7 insertions(+)\n');
      vi.spyOn(gitUtils, 'countUntrackedLines').mockResolvedValue(0);
      const ctx = createContext();

      await linesChangedWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      await linesChangedWidget.getData(ctx);
      expect(spy.mock.calls.length).toBe(callsAfterFirst); // cached

      clearDiffCacheForTest();
      await linesChangedWidget.getData(ctx);
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // re-fetched
    });
  });

  describe('tagStatusWidget', () => {
    function tagCtx(config: Partial<WidgetContext['config']> = {}): WidgetContext {
      return {
        ...createContext(),
        config: { ...MOCK_CONFIG, ...config },
      };
    }

    it('should have correct id and name', () => {
      expect(tagStatusWidget.id).toBe('tagStatus');
      expect(tagStatusWidget.name).toBe('Tag Status');
    });

    it('should resolve default v* pattern when tagPatterns unset', async () => {
      vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'describe') return 'v1.25.1\n';
        if (args[0] === 'rev-list') return '0\n';
        return '';
      });

      const data = await tagStatusWidget.getData(tagCtx());

      expect(data).not.toBeNull();
      expect(data?.tags).toEqual([{ name: 'v1.25.1', count: 0 }]);
    });

    it('should resolve multiple patterns and preserve order', async () => {
      vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        const matchIdx = args.indexOf('--match');
        const pattern = matchIdx >= 0 ? args[matchIdx + 1] : null;
        if (args[0] === 'describe') {
          if (pattern === 'v*') return 'v1.25.1\n';
          if (pattern === 'sync-*') return 'sync-handbook\n';
          return '';
        }
        if (args[0] === 'rev-list') {
          const spec = args[args.length - 1];
          if (spec?.startsWith('v1.25.1')) return '0\n';
          if (spec?.startsWith('sync-handbook')) return '12\n';
        }
        return '';
      });

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: ['v*', 'sync-*'] }),
      );

      expect(data?.tags).toEqual([
        { name: 'v1.25.1', count: 0 },
        { name: 'sync-handbook', count: 12 },
      ]);
    });

    it('should skip patterns that do not match any tag', async () => {
      vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        const matchIdx = args.indexOf('--match');
        const pattern = matchIdx >= 0 ? args[matchIdx + 1] : null;
        if (args[0] === 'describe') {
          if (pattern === 'v*') return 'v1.25.1\n';
          throw new Error('no matching tags');
        }
        if (args[0] === 'rev-list') return '3\n';
        return '';
      });

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: ['v*', 'nonexistent-*'] }),
      );

      expect(data?.tags).toEqual([{ name: 'v1.25.1', count: 3 }]);
    });

    it('should return null when all patterns fail to match', async () => {
      vi.spyOn(gitUtils, 'execGit').mockRejectedValue(new Error('no matching tags'));

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: ['nope-*'] }),
      );

      expect(data).toBeNull();
    });

    it('should return null when tagPatterns is explicitly empty', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit');

      const data = await tagStatusWidget.getData(
        tagCtx({ tagPatterns: [] }),
      );

      expect(data).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should return null when cwd is missing', async () => {
      const data = await tagStatusWidget.getData(
        createContext({ workspace: { current_dir: '' } }),
      );
      expect(data).toBeNull();
    });

    it('should omit +N when count is 0', () => {
      const ctx = createContext();
      const result = tagStatusWidget.render({ tags: [{ name: 'v1.25.1', count: 0 }] }, ctx);

      expect(result).toContain('v1.25.1');
      expect(result).not.toContain('+0');
    });

    it('should render +N when count is positive', () => {
      const ctx = createContext();
      const result = tagStatusWidget.render(
        { tags: [{ name: 'sync-handbook', count: 12 }] },
        ctx,
      );

      expect(result).toContain('sync-handbook');
      expect(result).toContain('+12');
    });

    it('should render multiple tags separated by space', () => {
      const ctx = createContext();
      const result = tagStatusWidget.render(
        { tags: [{ name: 'v1.25.1', count: 0 }, { name: 'sync-handbook', count: 3 }] },
        ctx,
      );

      expect(result).toContain('v1.25.1');
      expect(result).toContain('sync-handbook');
      expect(result).toContain('+3');
    });

    it('should reuse cached result on repeated calls with same ctx', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'describe') return 'v1.25.1\n';
        if (args[0] === 'rev-list') return '0\n';
        return '';
      });

      const ctx = tagCtx();
      const first = await tagStatusWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      const second = await tagStatusWidget.getData(ctx);

      expect(first).toEqual(second);
      expect(spy.mock.calls.length).toBe(callsAfterFirst);
    });

    it('should re-fetch after clearTagCacheForTest()', async () => {
      const spy = vi.spyOn(gitUtils, 'execGit').mockImplementation(async (args: string[]) => {
        if (args[0] === 'describe') return 'v1.25.1\n';
        if (args[0] === 'rev-list') return '0\n';
        return '';
      });
      const ctx = tagCtx();

      await tagStatusWidget.getData(ctx);
      const callsAfterFirst = spy.mock.calls.length;
      await tagStatusWidget.getData(ctx);
      expect(spy.mock.calls.length).toBe(callsAfterFirst); // cached

      clearTagCacheForTest();
      await tagStatusWidget.getData(ctx);
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // re-fetched
    });
  });

  describe('outputStyleWidget', () => {
    it('should have correct id and name', () => {
      expect(outputStyleWidget.id).toBe('outputStyle');
      expect(outputStyleWidget.name).toBe('Output Style');
    });

    it('should return data when style is non-default', async () => {
      const ctx = createContext({ output_style: { name: 'concise' } });
      const data = await outputStyleWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.styleName).toBe('concise');
    });

    it('should return null when style is default', async () => {
      const ctx = createContext({ output_style: { name: 'default' } });
      const data = await outputStyleWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when output_style is missing', async () => {
      const ctx = createContext();
      const data = await outputStyleWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render style name', () => {
      const ctx = createContext();
      const data = { styleName: 'explanatory' };
      const result = outputStyleWidget.render(data, ctx);

      expect(result).toContain('explanatory');
    });
  });

  describe('tokenSpeedWidget', () => {
    it('should have correct id and name', () => {
      expect(tokenSpeedWidget.id).toBe('tokenSpeed');
      expect(tokenSpeedWidget.name).toBe('Token Speed');
    });

    it('should return data when output tokens and api duration are present', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 3000,
          context_window_size: 200000,
          current_usage: null,
        },
        cost: { total_cost_usd: 0.5, total_api_duration_ms: 10000 },
      });
      const data = await tokenSpeedWidget.getData(ctx);

      expect(data).not.toBeNull();
      // 3000 / (10000 / 1000) = 300
      expect(data?.tokensPerSecond).toBe(300);
    });

    it('should return null when total_api_duration_ms is missing', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5 },
      });
      const data = await tokenSpeedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when total_api_duration_ms is 0', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_api_duration_ms: 0 },
      });
      const data = await tokenSpeedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when total_output_tokens is missing or 0', async () => {
      const ctx = createContext({
        context_window: {
          total_input_tokens: 5000,
          total_output_tokens: 0,
          context_window_size: 200000,
          current_usage: null,
        },
        cost: { total_cost_usd: 0.5, total_api_duration_ms: 5000 },
      });
      const data = await tokenSpeedWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should render token speed with lightning icon', () => {
      const ctx = createContext();
      const data = { tokensPerSecond: 150 };
      const result = tokenSpeedWidget.render(data, ctx);

      expect(result).toContain(ICON.zap);
      expect(result).toContain('150 tok/s');
    });

    it('should round tokensPerSecond in render', () => {
      const ctx = createContext();
      const data = { tokensPerSecond: 123.7 };
      const result = tokenSpeedWidget.render(data, ctx);

      expect(result).toContain('124 tok/s');
    });
  });

  describe('sessionNameWidget', () => {
    it('should have correct id and name', () => {
      expect(sessionNameWidget.id).toBe('sessionName');
      expect(sessionNameWidget.name).toBe('Session Name');
    });

    it('should return null when transcript_path is missing', async () => {
      const ctx = createContext();
      const data = await sessionNameWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when transcript has no sessionName', async () => {
      vi.spyOn(transcriptParser, 'getTranscript').mockResolvedValue({
        toolUses: new Map(),
        completedToolCount: 0,
        runningToolIds: new Set(),
        lastTodoWriteInput: null,
        activeAgentIds: new Set(),
        completedAgentCount: 0,
        tasks: new Map(),
        nextTaskId: 1,
        pendingTaskCreates: new Map(),
        pendingTaskUpdates: new Map(),
        activeSlashCommand: null,
      });

      const ctx = createContext({ transcript_path: '/tmp/transcript.jsonl' });
      const data = await sessionNameWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should prefer stdin session_name over transcript', async () => {
      const ctx = createContext({ session_name: 'stdin-session', transcript_path: '/tmp/transcript.jsonl' });
      const data = await sessionNameWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(data?.name).toBe('stdin-session');
    });

    it('should return session name from transcript', async () => {
      vi.spyOn(transcriptParser, 'getTranscript').mockResolvedValue({
        toolUses: new Map(),
        completedToolCount: 0,
        runningToolIds: new Set(),
        lastTodoWriteInput: null,
        activeAgentIds: new Set(),
        completedAgentCount: 0,
        tasks: new Map(),
        nextTaskId: 1,
        pendingTaskCreates: new Map(),
        pendingTaskUpdates: new Map(),
        activeSlashCommand: null,
        sessionName: 'my-feature-work',
      });

      const ctx = createContext({ transcript_path: '/tmp/transcript.jsonl' });
      const data = await sessionNameWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.name).toBe('my-feature-work');
    });

    it('should render session name with arrow prefix', () => {
      const ctx = createContext();
      const data = { name: 'bug-fix-session' };
      const result = sessionNameWidget.render(data, ctx);

      expect(result).toContain('»');
      expect(result).toContain('bug-fix-session');
    });

    it('should truncate long session names to 20 chars', () => {
      const ctx = createContext();
      const data = { name: 'this-is-a-very-long-session-name-that-exceeds-limit' };
      const result = sessionNameWidget.render(data, ctx);

      expect(result).toContain('»');
      expect(result).toContain('…');
    });
  });

  describe('todayCostWidget', () => {
    it('should hide on a subscription account (cost is notional there)', async () => {
      expect(await todayCostWidget.getData(createContext({}, { isApiAccount: false }))).toBeNull();
    });

    it('should have correct id and name', () => {
      expect(todayCostWidget.id).toBe('todayCost');
      expect(todayCostWidget.name).toBe('Today Cost');
    });

    it('should return data when dailyTotal is positive', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(2.5);

      const ctx = createContext({}, { isApiAccount: true });
      const data = await todayCostWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dailyTotal).toBe(2.5);
    });

    it('should return null when dailyTotal is 0', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(0);

      const ctx = createContext({}, { isApiAccount: true });
      const data = await todayCostWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when dailyTotal is negative', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(-1);

      const ctx = createContext({}, { isApiAccount: true });
      const data = await todayCostWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should pass session_id and cost to recordCostAndGetDaily', async () => {
      const mockRecord = vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(1.0);

      const ctx = createContext({
        session_id: 'test-session-456',
        cost: { total_cost_usd: 0.75 },
      }, { isApiAccount: true });
      await todayCostWidget.getData(ctx);

      expect(mockRecord).toHaveBeenCalledWith('test-session-456', 0.75);
    });

    it('should use default session_id when not provided', async () => {
      const mockRecord = vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(1.0);

      const ctx = createContext({}, { isApiAccount: true });
      ctx.stdin.session_id = undefined;
      await todayCostWidget.getData(ctx);

      expect(mockRecord).toHaveBeenCalledWith('default', 0.75);
    });

    it('should render daily total with Today label', () => {
      const ctx = createContext();
      const data = { dailyTotal: 3.5 };
      const result = todayCostWidget.render(data, ctx);

      expect(result).toContain(ICON.moneyBag);
      expect(result).toContain('Today');
      expect(result).toContain('$3.50');
    });

    it('should format small daily totals correctly', () => {
      const ctx = createContext();
      const data = { dailyTotal: 0.05 };
      const result = todayCostWidget.render(data, ctx);

      expect(result).toContain('$0.05');
    });
  });

  describe('budgetWidget', () => {
    it('should have correct id and name', () => {
      expect(budgetWidget.id).toBe('budget');
      expect(budgetWidget.name).toBe('Budget');
    });

    it('should return null when dailyBudget is not configured', async () => {
      const ctx = createContext();
      const data = await budgetWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return budget data when configured', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(5.0);

      const ctx = { ...createContext(), config: { ...MOCK_CONFIG, dailyBudget: 20 } };
      const data = await budgetWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.dailyTotal).toBe(5.0);
      expect(data?.dailyBudget).toBe(20);
      expect(data?.utilization).toBe(0.25);
    });

    it('should cap utilization at 1', async () => {
      vi.spyOn(budgetUtils, 'recordCostAndGetDaily').mockResolvedValue(30.0);

      const ctx = { ...createContext(), config: { ...MOCK_CONFIG, dailyBudget: 20 } };
      const data = await budgetWidget.getData(ctx);

      expect(data?.utilization).toBe(1);
    });

    it('should render safe icon for low utilization', () => {
      const ctx = createContext();
      const data = { dailyTotal: 5, dailyBudget: 20, utilization: 0.25 };
      const result = budgetWidget.render(data, ctx);
      expect(result).toContain(ICON.banknote);
      expect(result).toContain('$5.00');
      expect(result).toContain('$20.00');
    });

    it('should render warning icon for high utilization', () => {
      const ctx = createContext();
      const data = { dailyTotal: 17, dailyBudget: 20, utilization: 0.85 };
      const result = budgetWidget.render(data, ctx);
      expect(result).toContain(ICON.warning);
    });

    it('should render danger icon for critical utilization', () => {
      const ctx = createContext();
      const data = { dailyTotal: 19.5, dailyBudget: 20, utilization: 0.975 };
      const result = budgetWidget.render(data, ctx);
      expect(result).toContain(ICON.alarm);
    });
  });

  describe('forecastWidget', () => {
    it('should hide on a subscription account (cost is notional there)', async () => {
      expect(await forecastWidget.getData(createContext({}, { isApiAccount: false }))).toBeNull();
    });

    it('should have correct id and name', () => {
      expect(forecastWidget.id).toBe('forecast');
      expect(forecastWidget.name).toBe('Cost Forecast');
    });

    it('should return null when cost is 0', async () => {
      const ctx = createContext({ cost: { total_cost_usd: 0 } }, { isApiAccount: true });
      const data = await forecastWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return forecast data when cost and session time available', async () => {
      vi.spyOn(sessionUtils, 'getSessionElapsedMinutes').mockResolvedValue(30);

      const ctx = createContext({ cost: { total_cost_usd: 1.5 } }, { isApiAccount: true });
      const data = await forecastWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.currentCost).toBe(1.5);
      expect(data?.hourlyCost).toBe(3.0);
    });

    it('should render with arrow and hourly rate', () => {
      const ctx = createContext();
      const data = { currentCost: 1.5, hourlyCost: 3.0 };
      const result = forecastWidget.render(data, ctx);
      expect(result).toContain(ICON.chartUp);
      expect(result).toContain('$1.50');
      expect(result).toContain('~$3.00/h');
    });
  });

  describe('tokenBreakdownWidget', () => {
    it('should have correct id and name', () => {
      expect(tokenBreakdownWidget.id).toBe('tokenBreakdown');
      expect(tokenBreakdownWidget.name).toBe('Token Breakdown');
    });

    it('should return null when no usage data', async () => {
      const ctx = createContext({
        context_window: { ...MOCK_STDIN.context_window, current_usage: null },
      });
      const data = await tokenBreakdownWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when all tokens are 0', async () => {
      const ctx = createContext({
        context_window: {
          ...MOCK_STDIN.context_window,
          current_usage: {
            input_tokens: 0, output_tokens: 0,
            cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
          },
        },
      });
      const data = await tokenBreakdownWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return token breakdown data', async () => {
      const ctx = createContext();
      const data = await tokenBreakdownWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.inputTokens).toBe(5000);
      expect(data?.outputTokens).toBe(2000);
      expect(data?.cacheWriteTokens).toBe(1000);
      expect(data?.cacheReadTokens).toBe(500);
    });

    it('should render with chart icon and labels', () => {
      const ctx = createContext();
      const data = { inputTokens: 5000, outputTokens: 2000, cacheWriteTokens: 1000, cacheReadTokens: 500 };
      const result = tokenBreakdownWidget.render(data, ctx);
      expect(result).toContain(ICON.chart);
      expect(result).toContain('In');
      expect(result).toContain('Out');
    });

    it('should omit zero-value parts', () => {
      const ctx = createContext();
      const data = { inputTokens: 5000, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
      const result = tokenBreakdownWidget.render(data, ctx);
      expect(result).toContain('In');
      expect(result).not.toContain('Out');
    });
  });

  describe('lastPromptWidget', () => {
    it('should have correct id and name', () => {
      expect(lastPromptWidget.id).toBe('lastPrompt');
      expect(lastPromptWidget.name).toBe('Last Prompt');
    });

    it('should return null when no session_id', async () => {
      const ctx = createContext({ session_id: undefined });
      const data = await lastPromptWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return prompt data from history', async () => {
      vi.spyOn(historyParser, 'getLastUserPrompt').mockResolvedValue({
        text: 'Fix the login bug',
        timestamp: '2024-01-01T12:30:00Z',
      });

      const ctx = createContext();
      const data = await lastPromptWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.text).toBe('Fix the login bug');
    });

    it('should render with time and text', () => {
      const ctx = createContext();
      const data = { text: 'Fix the login bug', timestamp: '2024-01-01T12:30:00Z' };
      const result = lastPromptWidget.render(data, ctx);
      expect(result).toContain(ICON.speech);
      expect(result).toContain('Fix the login bug');
    });

    it('should truncate long prompts to 60 chars', () => {
      const ctx = createContext();
      const longText = 'A'.repeat(80);
      const data = { text: longText, timestamp: '2024-01-01T12:30:00Z' };
      const result = lastPromptWidget.render(data, ctx);
      expect(result).toContain('…');
    });
  });

  describe('slashCommandWidget', () => {
    it('should have correct id and name', () => {
      expect(slashCommandWidget.id).toBe('slashCommand');
      expect(slashCommandWidget.name).toBe('Slash Command');
    });

    it('should return null when transcript has no active slash command', async () => {
      vi.spyOn(transcriptParser, 'getTranscript').mockResolvedValue({
        toolUses: new Map(),
        completedToolCount: 0,
        runningToolIds: new Set(),
        lastTodoWriteInput: null,
        activeAgentIds: new Set(),
        completedAgentCount: 0,
        tasks: new Map(),
        nextTaskId: 1,
        pendingTaskCreates: new Map(),
        pendingTaskUpdates: new Map(),
        activeSlashCommand: null,
      });

      const ctx = createContext({ transcript_path: '/tmp/transcript.jsonl' });
      const data = await slashCommandWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return active slash command from transcript', async () => {
      vi.spyOn(transcriptParser, 'getTranscript').mockResolvedValue({
        toolUses: new Map(),
        completedToolCount: 0,
        runningToolIds: new Set(),
        lastTodoWriteInput: null,
        activeAgentIds: new Set(),
        completedAgentCount: 0,
        tasks: new Map(),
        nextTaskId: 1,
        pendingTaskCreates: new Map(),
        pendingTaskUpdates: new Map(),
        activeSlashCommand: { name: '/superpowers:brainstorming', startTime: 1234567890 },
      });

      const ctx = createContext({ transcript_path: '/tmp/transcript.jsonl' });
      const data = await slashCommandWidget.getData(ctx);

      expect(data).not.toBeNull();
      expect(data?.name).toBe('/superpowers:brainstorming');
    });

    it('should render command name with target icon', () => {
      const ctx = createContext();
      const data = { name: '/foo:bar', startTime: 0 };
      const result = slashCommandWidget.render(data, ctx);
      expect(result).toContain(ICON.target);
      expect(result).toContain('/foo:bar');
    });

    it('should return null when stdin has no transcript_path', async () => {
      const ctx = createContext();
      const data = await slashCommandWidget.getData(ctx);
      expect(data).toBeNull();
    });
  });

  describe('agentModeWidget', () => {
    it('should have correct id and name', () => {
      expect(agentModeWidget.id).toBe('agentMode');
      expect(agentModeWidget.name).toBe('Agent Mode');
    });

    it('should return null when neither agent fields are present', async () => {
      const ctx = createContext();
      const data = await agentModeWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return data when stdin.agent.name is present', async () => {
      const ctx = createContext({ agent: { name: 'my-coder' } });
      const data = await agentModeWidget.getData(ctx);
      expect(data).toEqual({ agentName: 'my-coder', agentType: undefined });
    });

    it('should return data when stdin.agent_type is present', async () => {
      const ctx = createContext({ agent_type: 'code-explorer' });
      const data = await agentModeWidget.getData(ctx);
      expect(data).toEqual({ agentName: undefined, agentType: 'code-explorer' });
    });

    it('should render both name and type joined with separator', () => {
      const ctx = createContext();
      const data = { agentName: 'my-coder', agentType: 'code-explorer' };
      const result = agentModeWidget.render(data, ctx);
      expect(result).toContain(`${ICON.person} my-coder`);
      expect(result).toContain(`${ICON.robot} code-explorer`);
      expect(result).toContain('·');
    });

    it('should render only name when type is absent', () => {
      const ctx = createContext();
      const result = agentModeWidget.render({ agentName: 'solo' }, ctx);
      expect(result).toBe(`${ICON.person} solo`);
    });

    it('should render only type when name is absent', () => {
      const ctx = createContext();
      const result = agentModeWidget.render({ agentType: 'code-explorer' }, ctx);
      expect(result).toBe(`${ICON.robot} code-explorer`);
    });

    it('should return null when agent.name trims to empty string', async () => {
      const ctx = createContext({ agent: { name: '   ' } });
      const data = await agentModeWidget.getData(ctx);
      expect(data).toBeNull();
    });
  });

  describe('vimModeWidget', () => {
    it('should have correct id and name', () => {
      expect(vimModeWidget.id).toBe('vimMode');
      expect(vimModeWidget.name).toBe('Vim Mode');
    });

    it('should return null when vim is not enabled', async () => {
      const ctx = createContext();
      const data = await vimModeWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return mode when vim is enabled', async () => {
      const ctx = createContext({ vim: { mode: 'NORMAL' } });
      const data = await vimModeWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(data?.mode).toBe('NORMAL');
    });

    it('should return INSERT mode', async () => {
      const ctx = createContext({ vim: { mode: 'INSERT' } });
      const data = await vimModeWidget.getData(ctx);
      expect(data?.mode).toBe('INSERT');
    });

    it('should render NORMAL with dim color', () => {
      const ctx = createContext();
      const result = vimModeWidget.render({ mode: 'NORMAL' }, ctx);
      expect(result).toContain('NORMAL');
    });

    it('should render INSERT with safe color', () => {
      const ctx = createContext();
      const result = vimModeWidget.render({ mode: 'INSERT' }, ctx);
      expect(result).toContain('INSERT');
    });
  });

  describe('apiDurationWidget', () => {
    it('should have correct id and name', () => {
      expect(apiDurationWidget.id).toBe('apiDuration');
      expect(apiDurationWidget.name).toBe('API Duration');
    });

    it('should return null when duration data is missing', async () => {
      const ctx = createContext({ cost: { total_cost_usd: 0.5 } });
      const data = await apiDurationWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should return null when total_duration_ms is 0', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 0, total_api_duration_ms: 100 },
      });
      const data = await apiDurationWidget.getData(ctx);
      expect(data).toBeNull();
    });

    it('should calculate percentage correctly', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 10000, total_api_duration_ms: 4500 },
      });
      const data = await apiDurationWidget.getData(ctx);
      expect(data).not.toBeNull();
      expect(data?.percentage).toBe(45);
    });

    it('should cap percentage at 100', async () => {
      const ctx = createContext({
        cost: { total_cost_usd: 0.5, total_duration_ms: 1000, total_api_duration_ms: 1500 },
      });
      const data = await apiDurationWidget.getData(ctx);
      expect(data?.percentage).toBe(100);
    });

    it('should render with API prefix', () => {
      const ctx = createContext();
      const result = apiDurationWidget.render({ percentage: 45 }, ctx);
      expect(result).toContain('API');
      expect(result).toContain('45%');
    });
  });
});
