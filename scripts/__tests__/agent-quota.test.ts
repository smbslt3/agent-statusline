/**
 * @covers scripts/widgets/agent-quota.ts
 */
import { describe, it, expect } from 'vitest';
import { agentQuotaWidget, agentQuota7dWidget } from '../widgets/agent-quota.js';
import { rateLimit5hWidget } from '../widgets/rate-limit.js';
import { MOCK_CONFIG, MOCK_TRANSLATIONS } from './fixtures.js';
import type { WidgetContext, StdinInput } from '../types.js';

const QUOTA = {
  'gemini-5h': { remaining_fraction: 0.74, reset_time: '2099-01-01T00:00:00Z', reset_in_seconds: 14000 },
  'gemini-weekly': { remaining_fraction: 0.94, reset_time: '2099-01-05T00:00:00Z', reset_in_seconds: 400000 },
  '3p-5h': { remaining_fraction: 1, reset_time: '2099-01-01T00:00:00Z', reset_in_seconds: 14000 },
  '3p-weekly': { remaining_fraction: 1, reset_time: '2099-01-05T00:00:00Z', reset_in_seconds: 400000 },
};

function ctxFor(overrides: Partial<StdinInput> = {}): WidgetContext {
  const stdin = {
    model: { id: 'Gemini 3.5 Flash (High)', display_name: 'Gemini 3.5 Flash (High)' },
    workspace: { current_dir: '/x' },
    context_window: { total_input_tokens: 0, total_output_tokens: 0, context_window_size: 200000, current_usage: null },
    cost: { total_cost_usd: 0 },
    product: 'antigravity',
    quota: QUOTA,
    ...overrides,
  } as unknown as StdinInput;
  return { stdin, config: MOCK_CONFIG, translations: MOCK_TRANSLATIONS };
}

const CLAUDE = {
  product: undefined,
  model: { id: 'claude-opus-4-6', display_name: 'Claude Opus 4.6' },
} as Partial<StdinInput>;

describe('agentQuotaWidget (5h, from stdin.quota)', () => {
  it('has correct id and name', () => {
    expect(agentQuotaWidget.id).toBe('agentQuota');
    expect(agentQuotaWidget.name).toBe('Antigravity Quota');
  });

  it('renders 5h used% + reset on agy, no provider tag', async () => {
    const ctx = ctxFor();
    const data = await agentQuotaWidget.getData(ctx);
    expect(data).toEqual({ utilization: 26, resetsAt: '2099-01-01T00:00:00Z' }); // (1-0.74)*100
    const out = agentQuotaWidget.render(data!, ctx);
    expect(out).toContain('5h:');
    expect(out).toContain('26%');
    expect(out).not.toContain('agy:');
  });

  it('hides on the Claude host', async () => {
    expect(await agentQuotaWidget.getData(ctxFor(CLAUDE))).toBeNull();
  });

  it('hides when no quota is present', async () => {
    expect(await agentQuotaWidget.getData(ctxFor({ quota: undefined } as Partial<StdinInput>))).toBeNull();
  });

  it('uses the 3p window for a third-party (Claude) model on agy', async () => {
    const ctx = ctxFor({ model: { id: 'Claude Opus 4.6 (Thinking)', display_name: 'Claude Opus 4.6 (Thinking)' } });
    const data = await agentQuotaWidget.getData(ctx);
    expect(data).toEqual({ utilization: 0, resetsAt: '2099-01-01T00:00:00Z' }); // 3p-5h remaining 1 -> 0%
  });
});

describe('agentQuota7dWidget (weekly)', () => {
  it('has correct id', () => {
    expect(agentQuota7dWidget.id).toBe('agentQuota7d');
  });

  it('renders the weekly window with a 7d label', async () => {
    const ctx = ctxFor();
    const data = await agentQuota7dWidget.getData(ctx);
    expect(data).toEqual({ utilization: 6, resetsAt: '2099-01-05T00:00:00Z' }); // (1-0.94)*100
    const out = agentQuota7dWidget.render(data!, ctx);
    expect(out).toContain('7d:');
    expect(out).toContain('6%');
  });

  it('hides on the Claude host', async () => {
    expect(await agentQuota7dWidget.getData(ctxFor(CLAUDE))).toBeNull();
  });
});

describe('rate-limit widgets are gated to the Claude host', () => {
  it('rateLimit5h hides (no error) on the agy host', async () => {
    const ctx = ctxFor();
    ctx.rateLimits = null;
    expect(await rateLimit5hWidget.getData(ctx)).toBeNull();
  });

  it('rateLimit5h still surfaces an error on the Claude host when the API failed', async () => {
    const ctx = ctxFor(CLAUDE);
    ctx.rateLimits = null;
    expect(await rateLimit5hWidget.getData(ctx)).toEqual({ utilization: 0, resetsAt: null, isError: true });
  });
});
