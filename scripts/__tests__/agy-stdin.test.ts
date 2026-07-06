/**
 * @covers scripts/utils/agy-stdin.ts
 */
import { describe, it, expect } from 'vitest';
import { isAgyHost, agyQuotaWindow, summarizeSubagents, summarizeTasks } from '../utils/agy-stdin.js';
import type { StdinInput } from '../types.js';

const base = (o: Record<string, unknown> = {}): StdinInput =>
  ({ model: { id: '', display_name: '' }, ...o } as unknown as StdinInput);

describe('isAgyHost', () => {
  it('true when product is antigravity (even for a non-Gemini model)', () => {
    expect(isAgyHost(base({ product: 'antigravity', model: { id: 'Claude Opus 4.6', display_name: 'Claude Opus 4.6' } }))).toBe(true);
  });
  it('true for a Gemini model without product (fallback)', () => {
    expect(isAgyHost(base({ model: { id: 'g', display_name: 'Gemini 3.5 Flash' } }))).toBe(true);
  });
  it('false for a Claude model without product', () => {
    expect(isAgyHost(base({ model: { id: 'c', display_name: 'Claude Opus 4.6' } }))).toBe(false);
  });
});

describe('agyQuotaWindow', () => {
  const gem = base({
    product: 'antigravity',
    model: { id: 'g', display_name: 'Gemini 3.5 Flash' },
    quota: {
      'gemini-5h': { remaining_fraction: 0.8, reset_time: 'T5', reset_in_seconds: 1 },
      'gemini-weekly': { remaining_fraction: 0.5, reset_time: 'TW', reset_in_seconds: 1 },
    },
  });

  it('reads the gemini 5h window (used = 1 - remaining)', () => {
    expect(agyQuotaWindow(gem, '5h')).toEqual({ utilization: 20, resetsAt: 'T5' });
  });
  it('reads the gemini weekly window', () => {
    expect(agyQuotaWindow(gem, 'weekly')).toEqual({ utilization: 50, resetsAt: 'TW' });
  });
  it('uses the 3p family for a third-party model', () => {
    const cl = base({
      product: 'antigravity',
      model: { id: 'c', display_name: 'Claude Opus 4.6' },
      quota: { '3p-5h': { remaining_fraction: 0.9, reset_time: 'X', reset_in_seconds: 1 } },
    });
    expect(agyQuotaWindow(cl, '5h')).toEqual({ utilization: 10, resetsAt: 'X' });
  });
  it('returns null when quota is absent', () => {
    expect(agyQuotaWindow(base({}), '5h')).toBeNull();
  });
});

describe('summarizeSubagents', () => {
  it('counts running and total', () => {
    expect(summarizeSubagents(base({ subagents: [{ status: 'running' }, { status: 'running' }, { status: 'done' }] })))
      .toEqual({ running: 2, total: 3 });
  });
  it('returns null when empty or absent', () => {
    expect(summarizeSubagents(base({ subagents: [] }))).toBeNull();
    expect(summarizeSubagents(base({}))).toBeNull();
  });
});

describe('summarizeTasks', () => {
  it('counts running (case-insensitive) and total', () => {
    expect(summarizeTasks(base({ tasks: [{ status: 'RUNNING' }, { status: 'completed' }] })))
      .toEqual({ running: 1, total: 2 });
  });
  it('returns null when absent', () => {
    expect(summarizeTasks(base({}))).toBeNull();
  });
});
