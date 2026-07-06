/**
 * Antigravity (agy) stdin helpers.
 *
 * Live capture (2026-06-14) confirmed agy streams a rich payload to a custom
 * status-line command: a `product:"antigravity"` marker, a `quota` map with 5h
 * AND weekly windows for gemini and third-party (`3p`) models, `agent_state`,
 * and a `subagents` array (and, when present, background `tasks`). These let the
 * agy widgets read everything from stdin — no language-server RPC needed for
 * quota/activity (the RPC remains only for the credit balance, which stdin omits).
 *
 * @tested scripts/__tests__/agy-stdin.test.ts
 */

import type { StdinInput } from '../types.js';
import { detectProvider } from './provider.js';

/**
 * Whether the status line is running on the Antigravity (agy) host. Prefer the
 * authoritative `product` marker (set even when agy runs a non-Gemini model);
 * fall back to the model name so older payloads / tests still resolve.
 */
export function isAgyHost(stdin: StdinInput): boolean {
  if (stdin.product === 'antigravity') return true;
  return detectProvider(stdin.model?.display_name || stdin.model?.id || '') === 'gemini';
}

/**
 * Resolve a quota window from `stdin.quota`. agy keys windows by model family:
 * `gemini-*` for Gemini models, `3p-*` for third-party (Claude/GPT) models.
 * Returns used percentage (0-100) + reset, or null when unavailable.
 */
export function agyQuotaWindow(
  stdin: StdinInput,
  window: '5h' | 'weekly'
): { utilization: number; resetsAt: string | null } | null {
  const quota = stdin.quota;
  if (!quota) return null;
  const family = detectProvider(stdin.model?.display_name || stdin.model?.id || '') === 'gemini' ? 'gemini' : '3p';
  const w = quota[`${family}-${window}`];
  if (!w || typeof w.remaining_fraction !== 'number') return null;
  return {
    utilization: Math.max(0, Math.min(100, Math.round((1 - w.remaining_fraction) * 100))),
    resetsAt: typeof w.reset_time === 'string' ? w.reset_time : null,
  };
}

/**
 * Summarize the running/total subagents from `stdin.subagents`.
 * Returns null when there are none.
 */
export function summarizeSubagents(stdin: StdinInput): { running: number; total: number } | null {
  const subs = stdin.subagents;
  if (!Array.isArray(subs) || subs.length === 0) return null;
  const running = subs.filter((s) => s && s.status === 'running').length;
  return { running, total: subs.length };
}

/**
 * Summarize running/total background tasks from `stdin.tasks` (shape is treated
 * defensively — confirmed to exist as `%d task(s)` in agy, exact fields may vary).
 * Returns null when there are none.
 */
export function summarizeTasks(stdin: StdinInput): { running: number; total: number } | null {
  const tasks = stdin.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const running = tasks.filter((t) => t && /^running$/i.test(String(t.status ?? ''))).length;
  return { running, total: tasks.length };
}
