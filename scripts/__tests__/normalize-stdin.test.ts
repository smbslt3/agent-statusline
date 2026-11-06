/**
 * @covers scripts/utils/normalize-stdin.ts
 */
import { describe, it, expect } from 'vitest';
import { normalizeStdin } from '../utils/normalize-stdin.js';
import { contextWidget } from '../widgets/context.js';
import { MOCK_STDIN, MOCK_CONFIG, MOCK_TRANSLATIONS } from './fixtures.js';
import type { WidgetContext } from '../types.js';

describe('normalizeStdin', () => {
  it('returns null for non-object input', () => {
    expect(normalizeStdin(null)).toBeNull();
    expect(normalizeStdin('string')).toBeNull();
    expect(normalizeStdin(42)).toBeNull();
  });

  it('is a structural no-op for a Claude Code payload', () => {
    const result = normalizeStdin(MOCK_STDIN);
    expect(result?.model).toEqual({ id: 'claude-sonnet-3.5', display_name: 'Claude 3.5 Sonnet' });
    expect(result?.workspace).toEqual(MOCK_STDIN.workspace);
    expect(result?.context_window.current_usage).toEqual(MOCK_STDIN.context_window.current_usage);
    expect(result?.session_id).toBe(MOCK_STDIN.session_id);
  });

  describe('agy payload', () => {
    const agyRaw = {
      model: 'Gemini 3.5 Flash (High)',
      cwd: '/home/u/proj',
      conversation_id: 'conv-123',
      context_window: {
        remaining_percentage: 70,
        total_input_tokens: 350000,
        total_output_tokens: 1200,
      },
      agent_state: 'idle',
      sandbox: { enabled: true },
    };

    it('wraps a bare string model into { id, display_name }', () => {
      const result = normalizeStdin(agyRaw);
      expect(result?.model).toEqual({
        id: 'Gemini 3.5 Flash (High)',
        display_name: 'Gemini 3.5 Flash (High)',
      });
    });

    it('maps top-level cwd into a workspace object', () => {
      const result = normalizeStdin(agyRaw);
      expect(result?.workspace).toEqual({ current_dir: '/home/u/proj', project_dir: '/home/u/proj' });
    });

    it('derives used_percentage from remaining_percentage', () => {
      const result = normalizeStdin(agyRaw);
      expect(result?.context_window.used_percentage).toBe(30);
    });

    it('synthesizes current_usage from token totals', () => {
      const result = normalizeStdin(agyRaw);
      expect(result?.context_window.current_usage).toEqual({
        input_tokens: 350000,
        output_tokens: 1200,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      });
    });

    it('back-derives a context window size consistent with the utilization', () => {
      const result = normalizeStdin(agyRaw);
      // 350000 / (30/100) ≈ 1,166,667 → keeps "X/Y" reconciled with the bar.
      expect(result?.context_window.context_window_size).toBe(Math.round(350000 / 0.3));
    });

    it('falls back to conversation_id for the session id', () => {
      expect(normalizeStdin(agyRaw)?.session_id).toBe('conv-123');
    });

    it('prefers an explicit session_id over conversation_id', () => {
      expect(normalizeStdin({ ...agyRaw, session_id: 'sess-9' })?.session_id).toBe('sess-9');
    });

    it('feeds the context widget cleanly with no NaN', async () => {
      const stdin = normalizeStdin(agyRaw)!;
      const ctx: WidgetContext = {
        stdin,
        config: MOCK_CONFIG,
        translations: MOCK_TRANSLATIONS,
      };
      const data = await contextWidget.getData(ctx);
      expect(data?.percentage).toBe(30);
      expect(Number.isNaN(data?.percentage)).toBe(false);
      expect(Number.isNaN(data?.inputTokens)).toBe(false);
    });
  });

  it('guards the context widget against partial usage (no NaN%)', async () => {
    // Only input_tokens present — the other usage fields are missing.
    const stdin = normalizeStdin({
      model: { id: 'gemini-x', display_name: 'Gemini X' },
      cwd: '/x',
      context_window: { current_usage: { input_tokens: 1000 } },
    })!;
    const ctx: WidgetContext = {
      stdin,
      config: MOCK_CONFIG,
      translations: MOCK_TRANSLATIONS,
    };
    const data = await contextWidget.getData(ctx);
    expect(Number.isNaN(data?.percentage)).toBe(false);
    expect(Number.isNaN(data?.inputTokens)).toBe(false);
    expect(data?.inputTokens).toBe(1000);
  });
});
