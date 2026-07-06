/**
 * Normalize host stdin payloads into the canonical Claude-Code shape.
 *
 * The widget layer is written against Claude Code's stdin schema. Antigravity
 * (`agy`) sends a Claude-compatible-but-not-identical payload (verified against
 * 60ke/antigravity-statusline): a top-level `cwd` instead of `workspace`, a
 * `model` that may be a bare string, a `context_window` carrying
 * `remaining_percentage` + token totals with no `current_usage` object, and a
 * `conversation_id` in place of `session_id`. This adapter folds those into the
 * canonical shape so every widget renders identically on both hosts.
 *
 * For genuine Claude Code payloads this is a structural no-op.
 *
 * @tested scripts/__tests__/normalize-stdin.test.ts
 */

import type { StdinInput } from '../types.js';

type AnyRecord = Record<string, unknown>;

function normalizeModel(model: unknown): StdinInput['model'] {
  if (typeof model === 'string') {
    return { id: model, display_name: model };
  }
  if (model && typeof model === 'object') {
    const m = model as AnyRecord;
    const id = typeof m.id === 'string' ? m.id : '';
    const displayName = typeof m.display_name === 'string' ? m.display_name : id || '-';
    return { id, display_name: displayName };
  }
  return { id: '', display_name: '-' };
}

function normalizeWorkspace(r: AnyRecord): StdinInput['workspace'] {
  if (r.workspace && typeof r.workspace === 'object') {
    return r.workspace as StdinInput['workspace'];
  }
  // agy sends a top-level `cwd` rather than a workspace object.
  if (typeof r.cwd === 'string') {
    return { current_dir: r.cwd, project_dir: r.cwd };
  }
  return { current_dir: '' };
}

function normalizeContextWindow(cw: unknown): StdinInput['context_window'] {
  if (!cw || typeof cw !== 'object') {
    return {
      total_input_tokens: 0,
      total_output_tokens: 0,
      context_window_size: 200000,
      current_usage: null,
    };
  }

  const c = cw as AnyRecord;

  // Claude Code already provides a `current_usage` breakdown — pass through.
  if (c.current_usage != null) {
    return c as unknown as StdinInput['context_window'];
  }

  // agy shape: remaining_percentage + token totals, no usage breakdown.
  const remaining = typeof c.remaining_percentage === 'number' ? c.remaining_percentage : null;
  const usedPercentage =
    remaining != null
      ? Math.max(0, Math.min(100, Math.round(100 - remaining)))
      : typeof c.used_percentage === 'number'
        ? c.used_percentage
        : null;

  const inputTokens = typeof c.total_input_tokens === 'number' ? c.total_input_tokens : 0;
  const outputTokens = typeof c.total_output_tokens === 'number' ? c.total_output_tokens : 0;

  // agy doesn't report the window size. Derive it from the authoritative
  // utilization so the "X/Y" token readout reconciles with the bar/percentage
  // instead of contradicting it; otherwise keep any provided size or default.
  let contextSize = typeof c.context_window_size === 'number' ? c.context_window_size : null;
  if (contextSize == null && usedPercentage != null && usedPercentage > 0 && inputTokens > 0) {
    contextSize = Math.round(inputTokens / (usedPercentage / 100));
  }

  return {
    ...c,
    total_input_tokens: inputTokens,
    total_output_tokens: outputTokens,
    context_window_size: contextSize ?? 200000,
    used_percentage: usedPercentage,
    current_usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as StdinInput['context_window'];
}

/**
 * Fold a raw host stdin object into the canonical Claude-Code StdinInput shape.
 * Returns null when the payload is not an object at all.
 */
export function normalizeStdin(raw: unknown): StdinInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as AnyRecord;

  return {
    ...r,
    model: normalizeModel(r.model),
    workspace: normalizeWorkspace(r),
    context_window: normalizeContextWindow(r.context_window),
    session_id: (r.session_id ?? r.conversation_id) as string | undefined,
  } as StdinInput;
}
