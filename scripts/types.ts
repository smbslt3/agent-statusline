/**
 * Core type definitions and display presets
 */

/**
 * Stdin JSON input from Claude Code
 */
export interface StdinInput {
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    /** Directory where Claude Code was launched (may differ from current_dir) */
    project_dir?: string;
    /** Directories added via /add-dir (since v2.1.77) */
    added_dirs?: string[];
  };
  /** Worktree info (present only during --worktree sessions) */
  worktree?: {
    name: string;
    path: string;
    branch?: string;
    original_cwd: string;
    original_branch?: string;
  };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    /** Official usage percentage from Claude Code stdin (0-100) */
    used_percentage?: number | null;
    /** Official remaining percentage from Claude Code stdin (0-100) */
    remaining_percentage?: number | null;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  cost: {
    total_cost_usd: number;
    /** Total session duration in milliseconds from Claude Code stdin */
    total_duration_ms?: number;
    /** Total time spent in API calls in ms (excludes user/tool time) */
    total_api_duration_ms?: number;
    /** Total lines added in the session */
    total_lines_added?: number;
    /** Total lines removed in the session */
    total_lines_removed?: number;
  };
  /** Output style configuration */
  output_style?: { name: string };
  /** Path to transcript.jsonl file (if available) */
  transcript_path?: string;
  /** Claude Code version string */
  version?: string;
  /** Whether total tokens from most recent API response exceeds 200k (fixed threshold) */
  exceeds_200k_tokens?: boolean;
  /**
   * Rate limits from Claude Code stdin (Pro/Max subscribers, after first API response).
   * Each window may be independently absent.
   */
  rate_limits?: {
    five_hour?: {
      used_percentage: number;
      /** Unix epoch seconds */
      resets_at: number;
    };
    seven_day?: {
      used_percentage: number;
      /** Unix epoch seconds */
      resets_at: number;
    };
  };
  /** Vim mode info (present only when vim mode is enabled) */
  vim?: { mode: 'NORMAL' | 'INSERT' };
  /** Agent info (present only when running with --agent flag) */
  agent?: { name: string };
  /** Session ID for duration tracking */
  session_id?: string;
  /** Session name set via /rename command (since v2.1.77) */
  session_name?: string;
  /** Current permission mode (base hook field) */
  permission_mode?: string;
  /** Remote session info (present only in remote/bridge mode) */
  remote?: { session_id: string };
  /** Subagent identifier (present only in subagent context) */
  agent_id?: string;
  /** Subagent type name (present only in subagent context) */
  agent_type?: string;

  // --- Antigravity (agy) host fields (absent on Claude Code) ---
  /** Host marker; "antigravity" on the agy host. */
  product?: string;
  /** agy agent state, e.g. "idle" | "working" | "authenticating". */
  agent_state?: string;
  /** agy subscription tier label, e.g. "Google AI Pro". */
  plan_tier?: string;
  /** Terminal width in columns (agy provides this; used by autoWrap). */
  terminal_width?: number;
  /**
   * agy quota windows. Keys are model-family + window, e.g. "gemini-5h",
   * "gemini-weekly", "3p-5h", "3p-weekly" (`3p` = third-party Claude/GPT models).
   */
  quota?: Record<string, { remaining_fraction: number; reset_time: string; reset_in_seconds: number }>;
  /** agy running subagents (parallel sub-tasks). */
  subagents?: Array<{ name?: string; role?: string; status?: string }>;
  /** agy backgrounded shell/agent tasks (shape treated defensively). */
  tasks?: Array<{ status?: string; command?: string }>;
}

/**
 * Widget identifiers
 */
export type WidgetId =
  | 'model'
  | 'context'
  | 'contextBar'
  | 'contextPercentage'
  | 'contextUsage'
  | 'cost'
  | 'extraUsage'
  | 'rateLimit5h'
  | 'rateLimit7d'
  | 'rateLimit7dSonnet'
  | 'rateLimit7dFable'
  | 'agentQuota'
  | 'agentQuota7d'
  | 'agentCredits'
  | 'agentState'
  | 'agentSubagents'
  | 'agentTasks'
  | 'projectInfo'
  | 'configCounts'
  | 'sessionDuration'
  | 'sessionId'
  | 'sessionIdFull'
  | 'toolActivity'
  | 'agentStatus'
  | 'todoProgress'
  | 'burnRate'
  | 'cacheHit'
  | 'tokenBreakdown'
  | 'forecast'
  | 'budget'
  | 'version'
  | 'linesChanged'
  | 'outputStyle'
  | 'tokenSpeed'
  | 'sessionName'
  | 'todayCost'
  | 'lastPrompt'
  | 'vimMode'
  | 'apiDuration'
  | 'tagStatus'
  | 'slashCommand'
  | 'agentMode';

/**
 * Display mode for status line output
 */
export type DisplayMode = 'compact' | 'normal' | 'detailed' | 'custom';

/**
 * Preset configurations for each display mode
 *
 * compact: Essential metrics - 1 line
 * normal: Essential + project/session/todo - 2 lines
 * detailed: Normal + config/tools/agents (additive) - 5 lines
 */
export const DISPLAY_PRESETS: Record<Exclude<DisplayMode, 'custom'>, WidgetId[][]> = {
  compact: [
    ['model', 'context', 'rateLimit5h', 'rateLimit7dSonnet', 'rateLimit7dFable', 'rateLimit7d', 'extraUsage', 'cost', 'forecast', 'todayCost', 'agentQuota', 'agentQuota7d', 'agentCredits', 'agentSubagents', 'agentState', 'agentTasks'],
  ],
  normal: [
    ['model', 'context', 'rateLimit5h', 'rateLimit7dSonnet', 'rateLimit7dFable', 'rateLimit7d', 'extraUsage', 'cost', 'forecast', 'todayCost', 'agentQuota', 'agentQuota7d', 'agentCredits', 'agentSubagents', 'agentState', 'agentTasks'],
    ['projectInfo', 'sessionId', 'sessionDuration', 'burnRate', 'todoProgress'],
  ],
  detailed: [
    ['model', 'context', 'rateLimit5h', 'rateLimit7dSonnet', 'rateLimit7dFable', 'rateLimit7d', 'extraUsage', 'cost', 'forecast', 'todayCost', 'agentQuota', 'agentQuota7d', 'agentCredits', 'agentSubagents', 'agentState', 'agentTasks'],
    ['projectInfo', 'sessionName', 'sessionId', 'sessionDuration', 'burnRate', 'tokenSpeed', 'todoProgress'],
    ['configCounts', 'toolActivity', 'agentStatus', 'cacheHit', 'tokenBreakdown'],
    ['linesChanged', 'outputStyle', 'version'],
    ['lastPrompt', 'vimMode', 'apiDuration', 'tagStatus'],
  ],
};

/**
 * Theme identifiers
 */
export type ThemeId = 'default' | 'minimal' | 'catppuccin' | 'catppuccinLatte' | 'dracula' | 'gruvbox' | 'nord' | 'tokyoNight' | 'solarized';

/**
 * Separator styles for widget dividers
 */
export type SeparatorStyle = 'pipe' | 'space' | 'dot' | 'arrow';

/**
 * How rate-limit reset times are displayed.
 */
export type RateLimitResetDisplay = 'remaining' | 'resetTime' | 'both';

/**
 * User configuration stored in ~/.claude/agent-statusline.local.json
 */
export interface Config {
  /**
   * @deprecated Ignored. Rate-limit widgets render whichever windows the
   * usage API returns for the logged-in account, so the plan is auto-detected.
   * Kept only so older config files still parse.
   */
  plan?: 'pro' | 'max';
  /** Display mode: preset (compact/normal/detailed) or custom */
  displayMode: DisplayMode;
  /** Custom line configuration (only used when displayMode is 'custom') */
  lines?: WidgetId[][];
  /** Widget IDs to disable from display presets */
  disabledWidgets?: WidgetId[];
  /** Color theme */
  theme?: ThemeId;
  /** Separator style between widgets. Default: 'pipe' */
  separator?: SeparatorStyle;
  /** Rate-limit reset display style. Default: 'remaining' */
  rateLimitResetDisplay?: RateLimitResetDisplay;
  /**
   * Preset shorthand string for quick widget layout.
   * Each character maps to a widget, '|' separates lines.
   * Example: "MC$R|PID" → Line 1: Model, Context, Cost, RateLimit5h; Line 2: ProjectInfo, SessionId, SessionDuration
   * When set, overrides displayMode with 'custom' and generates lines from the string.
   */
  preset?: string;
  /** Daily budget limit in USD. Enables budget tracking widget. */
  dailyBudget?: number;
  /**
   * Low-balance threshold for the agy `agentCredits` widget. The widget stays
   * hidden while the credit balance is healthy and only appears (as a depletion
   * warning) once the balance is at or below this value. Defaults to
   * `minimumCreditAmountForUsage * 2` (≈two minimum-uses left), or 100 when the
   * floor is unknown. agy has no Claude-style overage flag, so this heuristic
   * stands in for "show only when credits are running out".
   */
  agentCreditsThreshold?: number;
  /**
   * When true, lines whose rendered width exceeds the available terminal
   * width are repacked across multiple physical lines at separator
   * boundaries (instead of letting the terminal hard-wrap mid-segment).
   * Off by default to keep the deterministic preset layout. The width is
   * taken from `maxWidth` when set, else the detected terminal columns,
   * else 80.
   */
  autoWrap?: boolean;
  /**
   * Explicit width budget (columns) for `autoWrap`. Useful when the status
   * line runs through a pipe (no TTY), so auto-detection can't read the
   * terminal width. Ignored when `autoWrap` is off.
   */
  maxWidth?: number;
  /**
   * Glob patterns for tagStatus widget. Each pattern resolves to at most one
   * tag (the most recent reachable from HEAD). Defaults to ['v*'].
   */
  tagPatterns?: string[];
  cache: {
    ttlSeconds: number;
  };
}

/**
 * Mapping of single characters to widget IDs for preset shortcuts.
 * Used to convert compact preset strings like "MC$R" into widget arrays.
 */
export const PRESET_CHAR_MAP: Record<string, WidgetId> = {
  M: 'model',
  C: 'context',
  b: 'contextBar',
  '%': 'contextPercentage',
  '#': 'contextUsage',
  $: 'cost',
  x: 'extraUsage',
  R: 'rateLimit5h',
  '7': 'rateLimit7d',
  S: 'rateLimit7dSonnet',
  F: 'rateLimit7dFable',
  q: 'agentQuota',
  w: 'agentQuota7d',
  c: 'agentCredits',
  u: 'agentSubagents',
  s: 'agentState',
  z: 'agentTasks',
  P: 'projectInfo',
  I: 'sessionId',
  D: 'sessionDuration',
  T: 'toolActivity',
  A: 'agentStatus',
  O: 'todoProgress',
  B: 'burnRate',
  H: 'cacheHit',
  K: 'configCounts',
  N: 'tokenBreakdown',
  W: 'forecast',
  U: 'budget',
  V: 'version',
  L: 'linesChanged',
  Y: 'outputStyle',
  Q: 'tokenSpeed',
  J: 'sessionName',
  '@': 'todayCost',
  '?': 'lastPrompt',
  m: 'vimMode',
  a: 'apiDuration',
  t: 'tagStatus',
  '/': 'slashCommand',
  g: 'agentMode',
};

/**
 * Parse a preset shorthand string into widget line arrays.
 * Characters are mapped via PRESET_CHAR_MAP, '|' separates lines.
 * Unknown characters are silently skipped.
 */
export function parsePreset(preset: string): WidgetId[][] {
  return preset
    .split('|')
    .map((line) =>
      [...line]
        .map((ch) => PRESET_CHAR_MAP[ch])
        .filter((id): id is WidgetId => id !== undefined)
    )
    .filter((line) => line.length > 0);
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Config = {
  displayMode: 'normal',
  rateLimitResetDisplay: 'remaining',
  cache: {
    ttlSeconds: 300,
  },
};

/**
 * Translations interface
 */
export interface Translations {
  labels: {
    '5h': string;
    /** Plain 7-day label, shared by the all-models 7d window. */
    '7d_all': string;
    '7d_sonnet': string;
    /** 7-day Fable-specific window label (7d-F). */
    '7d_fable': string;
    /** Prefix for the paid extra-usage widget, e.g. `extra $4/$10`. */
    extra: string;
    /** Antigravity (agy) available-credits balance label */
    credits: string;
  };
  time: {
    days: string;
    hours: string;
    minutes: string;
  };
  /** Widget-specific labels (only those actually rendered by a widget). */
  widgets: {
    tools: string;
    done: string;
    running: string;
    agent: string;
    todos: string;
    claudeMd: string;
    agentsMd: string;
    addedDirs: string;
    rules: string;
    mcps: string;
    hooks: string;
    todayCost: string;
    apiDuration: string;
    /** agy agent_state "working" indicator label */
    working: string;
    /** agy running-subagents label */
    subagents: string;
    /** agy background-tasks label */
    bgTask: string;
  };
}

/**
 * API Rate Limits from the oauth/usage endpoint, normalized into a stable
 * internal shape regardless of which wire format the API returned.
 *
 * The API is mid-migration: newer responses carry a canonical `limits[]`
 * array (per-window `{kind, group, percent, resets_at}` entries) and a
 * `spend` object (paid overage), while older/dual-write responses carry
 * these same values as flat `five_hour`/`seven_day`/`seven_day_sonnet`/
 * `extra_usage` fields. `scripts/utils/api-client.ts`'s parseAndCacheLimits
 * prefers `limits[]`/`spend` and falls back to the flat fields, so every
 * downstream reader (widgets, statusline.ts) only ever sees this shape.
 */
export interface UsageLimits {
  /** 5h/session window. Sourced from limits[] (group/kind 'session'), else flat `five_hour`. */
  five_hour: {
    utilization: number;
    resets_at: string | null;
  } | null;
  /** 7d all-models window. Sourced from limits[] (kind 'weekly_all'), else flat `seven_day`. */
  seven_day: {
    utilization: number;
    resets_at: string | null;
  } | null;
  /**
   * 7d Sonnet-specific window (7d-S). Sourced from limits[] (a `weekly_scoped`
   * entry whose scope model is Sonnet), else the flat `seven_day_sonnet` field.
   * Most accounts have neither (null).
   */
  seven_day_sonnet: {
    utilization: number;
    resets_at: string | null;
  } | null;
  /**
   * 7d Fable-specific window (7d-F), the Fable counterpart to
   * `seven_day_sonnet`. Sourced from limits[] (a `weekly_scoped` entry whose
   * scope model is Fable). Optional because most accounts/responses (and the
   * stdin-only path) omit it — the widget then self-hides.
   */
  seven_day_fable?: {
    utilization: number;
    resets_at: string | null;
  } | null;
  /**
   * Paid extra-usage (overage credits beyond the plan limits). Sourced from
   * the usage API's `spend` object, else the legacy flat `extra_usage`
   * block. Absent on the stdin-only path (Claude Code stdin never carries
   * it); present only when the API is fetched.
   */
  extra_usage?: ExtraUsage | null;
}

/**
 * Extra-usage / overage credits, normalized from the usage API's `spend`
 * object (preferred) or the legacy flat `extra_usage` block (fallback).
 * Only meaningful when `is_enabled` (the account opted into paid overage).
 */
export interface ExtraUsage {
  /** Whether the account has paid extra-usage enabled. */
  is_enabled: boolean;
  /** Credits spent so far this cycle (account currency), or null. */
  used_credits: number | null;
  /** Configured monthly extra-usage cap (account currency), or null. */
  monthly_limit: number | null;
  /** Percent of the monthly cap used (0-100), or null. */
  utilization: number | null;
  /** ISO 4217 currency code (e.g. "USD"), or null. */
  currency: string | null;
}

/**
 * Negative cache TTL in seconds.
 * After an API failure, suppress retries for this duration.
 * Shared across all usage clients.
 */
export const NEGATIVE_CACHE_SECONDS = 30;

/**
 * Cache entry for API responses (discriminated union).
 * Success entries hold data of type T; error entries hold null.
 */
export type CacheEntry<T> =
  | { data: T; timestamp: number; isError?: false }
  | {
      data: null;
      timestamp: number;
      isError: true;
      /**
       * Seconds the server asked us to wait (HTTP 429 `retry-after`), when it
       * said so. Overrides NEGATIVE_CACHE_SECONDS for this entry so we don't
       * retry sooner than allowed and keep the account rate-limited.
       */
      retryAfterSeconds?: number;
    };

/**
 * Widget context passed to all widgets
 */
export interface WidgetContext {
  stdin: StdinInput;
  config: Config;
  translations: Translations;
  /** Cached Anthropic API rate limits (Claude host) */
  rateLimits?: UsageLimits | null;
  /** Cached Antigravity (agy) per-model quota (agy host) */
  antigravityUsage?: AntigravityUsageLimits | null;
  /**
   * True when the Claude account bills per-token via an API key rather than a
   * subscription plan. The cost widgets (`cost`/`forecast`/`todayCost`) render
   * only for API accounts — on a subscription the session cost is notional, and
   * on the agy host this is always false.
   */
  isApiAccount?: boolean;
}

/**
 * Widget data types for each widget
 */
export type EffortLevel = 'xhigh' | 'high' | 'medium' | 'low';

export interface ModelData {
  id: string;
  displayName: string;
  effortLevel: EffortLevel;
  fastMode: boolean;
}

export interface ContextData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextSize: number;
  percentage: number;
}

export interface CostData {
  totalCostUsd: number;
}

/**
 * Extra-usage widget data — paid overage credits used vs the monthly cap.
 * Only produced when the account has extra usage enabled and active.
 */
export interface ExtraUsageData {
  usedCredits: number;
  monthlyLimit: number | null;
  currency: string | null;
  /** Percent of the monthly cap used (0-100). */
  utilization: number;
}

export interface RateLimitData {
  utilization: number;
  resetsAt: string | null;
  isError?: boolean;
}

/**
 * Antigravity (agy) available-credits widget data — the agy counterpart to
 * Claude's extra-usage credits. Produced only when the language-server
 * GetUserStatus response reports a positive credit balance.
 */
export interface AgentCreditsData {
  /** Total available credits across credit types. */
  amount: number;
  /** Single credit type label when only one type is present, else null. */
  type: string | null;
}

/** Antigravity (agy) agent activity state (rendered only while working). */
export interface AgentStateData {
  state: string;
}

/** Antigravity (agy) running subagents summary (from stdin.subagents). */
export interface AgentSubagentsData {
  running: number;
  total: number;
}

/** Antigravity (agy) running background tasks summary (from stdin.tasks). */
export interface AgentTasksData {
  running: number;
  total: number;
}

export interface ProjectInfoData {
  dirName: string;
  gitBranch?: string;
  /** Commits ahead of upstream */
  ahead?: number;
  /** Commits behind upstream */
  behind?: number;
  /** Relative path from project_dir when CWD differs */
  subPath?: string;
  /** Worktree name when in --worktree session */
  worktreeName?: string;
  /** Git remote HTTPS URL for OSC8 hyperlink (includes /tree/{branch}) */
  remoteUrl?: string;
}

/**
 * Tag status data - distance (commits ahead) from each matched tag.
 * Patterns with no matching tag are omitted; widget hidden when empty.
 */
export interface TagStatusData {
  tags: Array<{ name: string; count: number }>;
}

export interface ConfigCountsData {
  claudeMd: number;
  agentsMd: number;
  rules: number;
  mcps: number;
  hooks: number;
  addedDirs: number;
}

export interface SessionDurationData {
  elapsedMs: number;
}

export interface ToolActivityData {
  running: Array<{ name: string; startTime: number; target?: string }>;
  completed: number;
}

export interface AgentStatusData {
  active: Array<{ name: string; description?: string }>;
  completed: number;
}

export interface TodoProgressData {
  current?: { content: string; status: 'in_progress' | 'pending' };
  completed: number;
  total: number;
}

/**
 * Burn rate data - tokens consumed per minute
 * @invariant tokensPerMinute >= 0 (enforced in widget)
 */
export interface BurnRateData {
  /** Tokens consumed per minute (session average). Always >= 0. */
  tokensPerMinute: number;
}

/**
 * Cache hit rate data - percentage of tokens served from cache
 * @invariant hitPercentage is in range [0, 100] (enforced in widget)
 */
export interface CacheHitData {
  /** Cache hit percentage (0-100). Higher is better (more cache reuse). */
  hitPercentage: number;
}

/**
 * Antigravity CLI usage limits from the local language-server quota API.
 */
export interface AntigravityUsageLimits {
  /** Current/default model from settings or CLI output */
  model: string;
  /** Used percentage (0-100) for current/default model */
  usedPercent: number | null;
  /** Reset time as ISO string */
  resetAt: string | null;
  /** Number of model buckets parsed from CLI output */
  modelCount: number | null;
  /** Parsed model buckets from CLI output */
  buckets: Array<{
    modelId?: string;
    usedPercent: number | null;
    resetAt: string | null;
  }>;
  /**
   * Available credit balance from `userTier.availableCredits` (e.g. Google
   * One AI credits). Summed across credit types; `type` is set only when a
   * single credit type is present. Absent/null when the tier reports none —
   * the agy credits widget then hides. Optional so the settings-only and
   * executable-only fallbacks (no live RPC) need not carry it.
   */
  credits?: { amount: number; type: string | null; minForUsage?: number | null } | null;
}

/**
 * Session ID widget data
 */
export interface SessionIdData {
  sessionId: string;
  shortId: string;
}

/**
 * Token breakdown data - input/output/cache_write/cache_read
 */
export interface TokenBreakdownData {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

/**
 * Cost forecast data - estimated hourly cost
 */
export interface ForecastData {
  /** Current session total cost */
  currentCost: number;
  /** Estimated hourly cost extrapolated from session rate */
  hourlyCost: number;
}

/**
 * Budget tracking data - daily spending vs limit
 * @invariant utilization is in range [0, 1]
 */
export interface BudgetData {
  /** Total cost accumulated today */
  dailyTotal: number;
  /** User-configured daily budget limit */
  dailyBudget: number;
  /** Utilization ratio (0-1) */
  utilization: number;
}

/**
 * Version widget data
 */
export interface VersionData {
  version: string;
}

/**
 * Lines changed widget data - coding productivity metric
 */
export interface LinesChangedData {
  added: number;
  removed: number;
  untracked: number;
}

/**
 * Output style widget data - current output style display
 */
export interface OutputStyleData {
  styleName: string;
}

/**
 * Token speed data - output generation speed during API calls
 * @invariant tokensPerSecond >= 0 (enforced in widget)
 */
export interface TokenSpeedData {
  /** Output tokens per second of API time. Always >= 0. */
  tokensPerSecond: number;
}

/**
 * Session name data - custom session label from /rename command
 */
export interface SessionNameData {
  /** Session name set by user via /rename */
  name: string;
}

/**
 * Today cost data - total spending across all sessions today
 */
export interface TodayCostData {
  /** Total cost accumulated today across all sessions */
  dailyTotal: number;
}

/**
 * API duration data - percentage of session time spent in API calls
 */
export interface ApiDurationData {
  /** API time as percentage of total session time (0-100) */
  percentage: number;
}

/**
 * Vim mode data - current vim mode when enabled
 */
export interface VimModeData {
  /** Vim mode */
  mode: 'NORMAL' | 'INSERT';
}

/**
 * Last prompt data - most recent user prompt in this session
 */
export interface LastPromptData {
  /** Last user prompt text */
  text: string;
  /** Prompt timestamp (ISO string) */
  timestamp: string;
}

/**
 * Agent mode - identity of the current session (custom agent and/or subagent type).
 * Distinct from `agentStatus` which tracks subagents spawned BY this session.
 */
export interface AgentModeData {
  /** Custom agent activated via /agent <name>, from stdin.agent.name */
  agentName?: string;
  /** Subagent type when this session was dispatched as a subagent, from stdin.agent_type */
  agentType?: string;
}

/**
 * Slash command activity - name of the slash command that started the current turn.
 * Cleared when the user sends a new plain-text message.
 */
export interface SlashCommandData {
  /** Full command name including leading slash, e.g. '/superpowers:brainstorming' */
  name: string;
  /**
   * Unix ms timestamp of when the command was issued. Captured for future
   * elapsed-time rendering (e.g. "🎯 /skill (42s)"); not consumed by the current renderer.
   */
  startTime: number;
}

/**
 * Union type of all widget data
 */
export type WidgetData =
  | ModelData
  | ContextData
  | CostData
  | ExtraUsageData
  | RateLimitData
  | AgentCreditsData
  | AgentStateData
  | AgentSubagentsData
  | AgentTasksData
  | ProjectInfoData
  | ConfigCountsData
  | SessionDurationData
  | SessionIdData
  | ToolActivityData
  | AgentStatusData
  | TodoProgressData
  | BurnRateData
  | CacheHitData
  | TokenBreakdownData
  | ForecastData
  | BudgetData
  | VersionData
  | LinesChangedData
  | OutputStyleData
  | TokenSpeedData
  | SessionNameData
  | TodayCostData
  | LastPromptData
  | VimModeData
  | ApiDurationData
  | TagStatusData
  | SlashCommandData
  | AgentModeData;

/**
 * Transcript entry from JSONL file
 */
export interface TranscriptEntry {
  type: 'assistant' | 'user' | 'tool_result' | 'system';
  timestamp?: string;
  /** Session name set by /rename command */
  customTitle?: string;
  message?: {
    /**
     * Block array (assistant + most user entries) or bare string
     * (legacy short-form user entries). Consumers must guard with
     * Array.isArray / typeof === 'string' before iterating.
     */
    content?: string | Array<{
      type: 'tool_use' | 'tool_result' | 'text';
      id?: string;
      tool_use_id?: string; // For tool_result blocks
      name?: string;
      input?: unknown;
      /** Text content for 'text' type blocks */
      text?: string;
    }>;
  };
}

/**
 * Parsed transcript data.
 * Incrementally tracked fields (running tools, agents, tasks, lastTodoWrite)
 * are updated in processEntries() so extract functions read O(1).
 */
export interface ParsedTranscript {
  toolUses: Map<string, { name: string; timestamp?: string; input?: unknown }>;
  /** Count of completed tools (replaces unbounded Set for memory efficiency) */
  completedToolCount: number;
  sessionStartTime?: number;
  /** Session name set by /rename command */
  sessionName?: string;

  // --- Incremental tracking (updated in processEntries) ---

  /** Tool IDs that have been dispatched but not yet returned */
  runningToolIds: Set<string>;
  /** Last completed TodoWrite input (for extractTodoProgress) */
  lastTodoWriteInput: unknown;
  /** Active agent (Task) tool IDs */
  activeAgentIds: Set<string>;
  /** Completed agent count */
  completedAgentCount: number;
  /** Tasks from TaskCreate/TaskUpdate, keyed by sequential ID */
  tasks: Map<string, { subject: string; status: string }>;
  /** Next sequential task ID for TaskCreate */
  nextTaskId: number;
  /** Pending TaskCreate tool_use IDs that haven't received results yet */
  pendingTaskCreates: Map<string, { subject: string; status: string; seqId: string }>;
  /** Pending TaskUpdate tool_use IDs */
  pendingTaskUpdates: Map<string, { taskId: string; status?: string; subject?: string }>;
  /** Slash command name + start time, cleared when a plain user message arrives */
  activeSlashCommand: SlashCommandData | null;
}
