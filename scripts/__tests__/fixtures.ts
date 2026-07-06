/**
 * Shared test fixtures for widget and formatter tests.
 * Values match en.json locale to keep tests consistent with production.
 */

import type { Translations, Config, StdinInput } from '../types.js';

export const MOCK_TRANSLATIONS: Translations = {
  labels: { '5h': '5h', '7d_all': '7d', '7d_sonnet': '7d-S', '7d_fable': '7d-F', extra: 'extra', credits: 'credits' },
  time: { days: 'd', hours: 'h', minutes: 'm' },
  widgets: {
    tools: 'Tools',
    done: 'done',
    running: 'running',
    agent: 'Agent',
    todos: 'Tasks',
    claudeMd: 'CLAUDE.md',
    agentsMd: 'AGENTS.md',
    addedDirs: '+Dirs',
    rules: 'Rules',
    mcps: 'MCP',
    hooks: 'Hooks',
    todayCost: 'Today',
    apiDuration: 'API',
    working: 'working',
    subagents: 'subagent',
    bgTask: 'task',
  },
};

export const MOCK_CONFIG: Config = {
  plan: 'max',
  displayMode: 'compact',
  cache: { ttlSeconds: 60 },
};

export const MOCK_STDIN: StdinInput = {
  model: { id: 'claude-sonnet-3.5', display_name: 'Claude 3.5 Sonnet' },
  workspace: { current_dir: '/test/project' },
  context_window: {
    total_input_tokens: 5000,
    total_output_tokens: 2000,
    context_window_size: 200000,
    current_usage: {
      input_tokens: 5000,
      output_tokens: 2000,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 500,
    },
  },
  cost: { total_cost_usd: 0.75 },
  session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};
