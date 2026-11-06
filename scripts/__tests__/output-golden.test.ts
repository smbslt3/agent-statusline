/**
 * @covers scripts/widgets/index.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatOutput } from '../widgets/index.js';
import type { WidgetContext } from '../types.js';
import { MOCK_CONFIG, MOCK_STDIN, MOCK_TRANSLATIONS } from './fixtures.js';

function stripAnsi(value: string): string {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function createContext(overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    stdin: {
      ...MOCK_STDIN,
      model: { id: 'claude-haiku-4-5', display_name: 'Claude 4.5 Haiku' },
    },
    config: MOCK_CONFIG,
    translations: MOCK_TRANSLATIONS,
    rateLimits: {
      five_hour: { utilization: 42, resets_at: null },
      seven_day: { utilization: 69, resets_at: null },
      seven_day_sonnet: { utilization: 12, resets_at: null },
      seven_day_fable: { utilization: 5, resets_at: null },
    },
    ...overrides,
  };
}

describe('public Claude output', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps compact output stable', async () => {
    const output = stripAnsi(await formatOutput(createContext()));

    expect(output).toBe('✽ Haiku │ ░░░░░░░░░░ │ 3% │ 6.5K/200K │ 5h: 42% │ 7d-S: 12% │ 7d-F: 5% │ 7d: 69%');
  });

  it('does not wrap by default even when the line is long', async () => {
    const output = stripAnsi(await formatOutput(createContext()));
    expect(output).not.toContain('\n');
  });

  it('wraps the compact line across multiple physical lines when autoWrap + maxWidth set', async () => {
    const ctx = createContext({ config: { ...MOCK_CONFIG, autoWrap: true, maxWidth: 30 } });
    const output = stripAnsi(await formatOutput(ctx));
    const lines = output.split('\n');

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(30);
    }
    // No content is lost: the model segment still leads, the last window trails.
    expect(lines[0]).toContain('✽ Haiku');
    expect(output).toContain('7d: 69%');
  });

  it('keeps normal output stable with project and session widgets', async () => {
    const ctx = createContext({
      stdin: {
        ...MOCK_STDIN,
        model: { id: 'claude-haiku-4-5', display_name: 'Claude 4.5 Haiku' },
        workspace: { current_dir: '/tmp/project', project_dir: '/tmp/project' },
        cost: { total_cost_usd: 0.75, total_duration_ms: 30 * 60 * 1000 },
      },
      config: { ...MOCK_CONFIG, displayMode: 'normal' },
    });
    const output = stripAnsi(await formatOutput(ctx));

    expect(output).toContain('✽ Haiku │ ░░░░░░░░░░ │ 3% │ 6.5K/200K │ 5h: 42% │ 7d-S: 12% │ 7d-F: 5% │ 7d: 69%');
    expect(output).toContain('project');
    expect(output).toContain('a1b2c3d4');
    expect(output).toContain('30m');
  });
});
