---
description: Configure agent-statusline status line settings
argument-hint: "[displayMode] | custom \"widgets\""
allowed-tools: Read, Write, Bash(node:*), Bash(cat:*), Bash(mkdir:*), Bash(ls:*), Bash(sort:*), Bash(tail:*), AskUserQuestion
---

# Agent Statusline Setup

Configure the agent-statusline status line plugin with widget system support.

## Arguments

- **No arguments**: Interactive mode (asks questions)
- **With arguments**: Direct configuration mode

### Direct Mode Arguments

- `$1`: Display mode
  - `compact`: 1 line (model, context, rateLimit5h, rateLimit7dSonnet, rateLimit7dFable, rateLimit7d, extraUsage, cost, forecast, todayCost, agentQuota, agentQuota7d, agentCredits, agentSubagents, agentState, agentTasks). The money-zone widgets render by account type: rate limits on a subscription, cost/forecast/todayCost on an API-key account (auto-detected).
  - `normal` (default): 2 lines (+ projectInfo, sessionId, sessionDuration, burnRate, todoProgress)
  - `detailed`: 5 lines (+ sessionName, tokenSpeed, configCounts, toolActivity, agentStatus, cacheHit, tokenBreakdown, linesChanged, outputStyle, version, lastPrompt, vimMode, apiDuration, tagStatus)
  - `custom`: Custom widget configuration (requires `$2`)

- `$2`: Custom lines (only for `custom` mode)
  - Format: `"widget1,widget2|widget3,widget4"`
  - `|` separates lines
  - Example: `"model,context,cost|projectInfo,todoProgress"`

### Available Widgets

| Widget | Description |
|--------|-------------|
| `model` | Model name with emoji, effort level (Opus/Sonnet), fast mode (Opus) |
| `context` | Progress bar, percentage, tokens |
| `contextBar` | Progress bar only (sub-widget of `context`) |
| `contextPercentage` | Percentage only (sub-widget of `context`) |
| `contextUsage` | Token count only, e.g. `42K/200K` (sub-widget of `context`) |
| `cost` | Session per-token cost in USD. API-account only (auto-detected); hidden on a subscription plan |
| `extraUsage` | Paid overage credits, rendered `extra $used/$cap`; shown only when extra usage is enabled with a cap (sits alongside `cost` in the line-1 money zone) |
| `rateLimit5h` | 5-hour rate limit (Claude host) |
| `rateLimit7d` | 7-day rate limit (auto-hides when the account has no such window) |
| `rateLimit7dSonnet` | 7-day Sonnet limit `7d-S` (auto-hides when the account has no such window) |
| `rateLimit7dFable` | 7-day Fable limit `7d-F`, the Fable counterpart to `rateLimit7dSonnet` (auto-hides when the account has no such window) |
| `agentQuota` | Antigravity 5h quota + reset from agy stdin: `5h: NN% (reset)` (agy host) |
| `agentQuota7d` | Antigravity weekly (7d) quota + reset from agy stdin: `7d: NN% (reset)` (agy host). Counterpart to `rateLimit7d` |
| `agentCredits` | agy credit low-balance warning (e.g. Google One AI): hidden while healthy, shows `credits: N` only when at/below `agentCreditsThreshold`. agy host; the only widget using the language-server RPC (lazy). agy's stand-in for `extraUsage` |
| `agentState` | `⚙ working` while agy is actively working (agy host; hidden when idle) |
| `agentSubagents` | `🤖 N subagent` running count from agy stdin (agy host). Counterpart to `agentStatus` |
| `agentTasks` | `📦 N task` running background tasks from agy stdin (agy host) |
| `projectInfo` | Directory name + git branch + ahead/behind (↑↓), subpath from project_dir, worktree indicator |
| `configCounts` | CLAUDE.md, AGENTS.md, rules, MCPs, hooks, +Dirs counts |
| `sessionId` | Session ID (short 8 chars) |
| `sessionIdFull` | Session ID (full UUID) |
| `sessionDuration` | Session duration |
| `toolActivity` | Running/completed tools with targets (e.g., `Read(app.ts)`) |
| `agentStatus` | Subagent progress |
| `todoProgress` | Todo completion rate |
| `burnRate` | Token consumption per minute |
| `cacheHit` | Cache hit rate percentage |
| `tokenBreakdown` | Input/output/cache write/read token breakdown |
| `forecast` | Estimated hourly cost based on session rate. API-account only (auto-detected) |
| `budget` | Daily spending vs configured budget limit. Opt-in (requires `dailyBudget`; not in default presets — add to a custom layout) |
| `tokenSpeed` | Output token generation speed (e.g., `67 tok/s`) |
| `sessionName` | Session name from /rename command |
| `todayCost` | Total spending across all sessions today. API-account only (auto-detected) |
| `linesChanged` | Uncommitted lines added/removed, including untracked files (+N -N) |
| `outputStyle` | Current output style (hidden when "default") |
| `version` | Claude Code version display |
| `vimMode` | Vim mode (NORMAL/INSERT), auto-hides when vim disabled |
| `apiDuration` | API time as % of total session time |
| `tagStatus` | Commits ahead of matched git tags (uses `tagPatterns` config, default `["v*"]`) |
| `slashCommand` | Active slash command for the current turn (🎯); cleared by next plain-text message |
| `agentMode` | Session agent identity: 👤 custom agent (via `/agent <name>`) or 🤖 subagent type |

## Tasks

### 1. Determine configuration

**If no arguments provided (interactive mode):**

Use AskUserQuestion to ask the user. Batch independent questions into a single AskUserQuestion call (max 4 per call) to minimize back-and-forth.

**Turn 1** — Ask all 3 questions in a single AskUserQuestion call (do NOT ask
about the subscription plan — it is auto-detected from the usage API):
1. Display mode — MUST include `markdown` field on each option for visual preview (default is `normal`):
   - compact, markdown:
     ```
     ✽ Opus (xH) │ ██░░ 80% │ 5h: 42% │ 7d: 69% │ $1.25
     ```
   - normal (recommended), markdown:
     ```
     ✽ Opus (xH) │ ██░░ 80% │ 5h: 42% │ 7d: 69% │ $1.25
     📁 project (main ↑3) │ 🔑 abc12345 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
     ```
   - detailed, markdown:
     ```
     ✽ Opus (xH) │ ██░░ 80% │ 5h: 42% │ 7d: 69% │ $1.25
     📁 project (main ↑3) │ 🔑 abc12345 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
     CLAUDE.md: 2 │ ⚙️ 12 done │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
     📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15 │ +120 -30 │ v2.1.0
     ```
   - custom, markdown:
     ```
     Choose exactly which widgets appear on each line.
     Full control over layout and ordering.
     ```
2. Theme: default (recommended), minimal, "catppuccin (mocha / latte — light)", "dracula / gruvbox / nord / tokyoNight / solarized"
   - All themes are dark except `catppuccinLatte`, which is designed for light-mode terminals
   - If multi-option selected: ask in next turn which one
   - For catppuccin, map `mocha` → config value `catppuccin`, `latte` → `catppuccinLatte`
3. Reset display — how the rate-limit / quota widgets show their reset window (sets `rateLimitResetDisplay`; default `remaining`):
   - `remaining` (recommended) → time left, e.g. `5h: 42% (4h42m)`
   - `resetTime` → the clock time it resets, e.g. `5h: 42% (15:30)` (weekday-prefixed when the reset is not today, e.g. `Tue 15:30`)
   - `both` → both, e.g. `5h: 42% (4h42m, 15:30)`

**Turn 2** — If display mode = "custom", build the layout one line at a time using category-based multi-select.

For each line `N` (starting at 1), repeat the following sub-flow until the user declines to add another line:

**Step A — Pick categories for line `N`:**
Single AskUserQuestion call with `multiSelect: true`, max 4 options. Ask: "Line `N`: which widget categories do you want to pull from?" The 4 category options are:

1. **Model & Context** — `model`, `context`, `contextBar`, `contextPercentage`, `contextUsage`
2. **Cost & Limits** — `cost` (API-account only), `extraUsage`, `rateLimit5h`, `rateLimit7d`, `rateLimit7dSonnet`, `rateLimit7dFable`, `agentQuota`, `agentQuota7d`, `agentCredits`, `agentState`, `agentSubagents`, `agentTasks`, `budget` (opt-in), `forecast` (API-account only), `todayCost` (API-account only)
3. **Project, Session & Activity** — `projectInfo`, `sessionId`, `sessionIdFull`, `sessionDuration`, `sessionName`, `configCounts`, `toolActivity`, `agentStatus`, `agentMode`, `todoProgress`, `outputStyle`, `vimMode`, `linesChanged`, `version`, `lastPrompt`, `slashCommand`
4. **Performance & Tokens** — `burnRate`, `tokenSpeed`, `cacheHit`, `tokenBreakdown`, `apiDuration`, `tagStatus`

**Step B — Pick widgets from each selected category:**
For every category the user selected in Step A, send one AskUserQuestion call with `multiSelect: true` listing the widgets in that category. AskUserQuestion allows max 4 options per call, so if a category has more than 4 widgets, split into multiple consecutive calls (e.g. "Cost & Limits (1/2)", "Cost & Limits (2/2)") — the user can pick zero or more widgets from each page.

Each widget option's `description` should be a short version of the table at the top of this file (e.g. `cost` → "Session cost in USD").

Collect every selected widget into an ordered list for line `N`, preserving the order they were chosen.

**Step C — Add another line?**
Single AskUserQuestion call (not multi-select) asking: "Line `N` has `[widget1, widget2, ...]`. Add another line?" with options `No (finish)` and `Yes, add Line N+1`. If the user picks "No", end the loop. If "Yes", increment `N` and return to Step A. There is no hard line limit.

**Notes for the assistant running this flow:**
- If the user selects zero widgets for a line (no categories or no widgets within selected categories), warn them and re-ask Step A for that same line — empty lines are not allowed.
- Show the running layout in Step C's question text so the user always sees what they've built so far.
- Keep the multi-select widget questions free of preset/combination options — the whole point of custom mode is per-widget control.
- **Track already-placed widgets across lines.** Maintain a `placed` set of every widget chosen so far. Starting from line 2 onward:
  - In Step A, list each category's `description` using **only the widgets not yet in `placed`** (e.g. if `model` and `context` are already placed, the Model & Context description becomes "contextBar, contextPercentage, contextUsage"). Truncate with "etc." past ~6–8 names if needed.
  - If a category has zero remaining widgets, **omit the entire category option** from Step A's choices.
  - In Step B, exclude already-placed widgets from each category's multi-select options as well.
  - If every category becomes empty (all widgets placed), inform the user and end the loop after the current line — there is nothing left to add.

**Turn 3** — Ask: "Do you want to hide any widgets?"
- Options: No (recommended), Yes
- If "Yes": ask which widgets to hide (multi-select from available widgets)

**If arguments provided (direct mode):**

Use the provided arguments directly.

### 2. Create configuration file

Create `~/.claude/agent-statusline.local.json`:

**For preset modes (compact/normal/detailed):**
```json
{
  "displayMode": "$1 or normal",
  "theme": "selected theme or default",
  "separator": "pipe (default) | space | dot | arrow",
  "rateLimitResetDisplay": "remaining (default) | resetTime | both",
  "disabledWidgets": ["selected widgets to hide, omit if empty"],
  "cache": {
    "ttlSeconds": 300
  }
}
```

**For preset shorthand (quick layout):**
```json
{
  "preset": "MC$R|BDO",
  "theme": "default",
  "cache": {
    "ttlSeconds": 300
  }
}
```

Preset characters: `M`=model, `C`=context, `b`=contextBar, `%`=contextPercentage, `#`=contextUsage, `$`=cost, `x`=extraUsage, `R`=rateLimit5h, `7`=rateLimit7d, `S`=7dSonnet, `F`=7dFable, `q`=agentQuota, `w`=agentQuota7d, `c`=agentCredits, `u`=agentSubagents, `s`=agentState, `z`=agentTasks, `P`=projectInfo, `I`=sessionId, `D`=sessionDuration, `T`=toolActivity, `A`=agentStatus, `g`=agentMode, `O`=todoProgress, `B`=burnRate, `H`=cacheHit, `K`=configCounts, `N`=tokenBreakdown, `W`=forecast, `U`=budget, `L`=linesChanged, `Y`=outputStyle, `V`=version, `Q`=tokenSpeed, `J`=sessionName, `@`=todayCost, `?`=lastPrompt, `/`=slashCommand, `m`=vimMode, `a`=apiDuration, `t`=tagStatus. Use `|` to separate lines.

**For custom mode:**
```json
{
  "displayMode": "custom",
  "lines": [
    ["widget1", "widget2"],
    ["widget3", "widget4"]
  ],
  "theme": "selected theme or default",
  "separator": "pipe",
  "disabledWidgets": ["selected widgets to hide, omit if empty"],
  "cache": {
    "ttlSeconds": 300
  }
}
```

**For budget tracking** (add to any config):
```json
{
  "dailyBudget": 15
}
```

**For tagStatus patterns** (add to any config, default is `["v*"]`):
```json
{
  "tagPatterns": ["v*", "release-*"]
}
```

**For terminal-width line wrapping** (add to any config; off by default):
```json
{
  "autoWrap": true,
  "maxWidth": 120
}
```
When `autoWrap` is on, a line wider than the terminal is split across physical
lines at separator boundaries. Width = `maxWidth` (if set) → detected terminal
columns → `$COLUMNS` → 80. Set `maxWidth` when stdout is a pipe (no TTY).

**For the agy credit low-balance warning** (add to the agy config; agy host only):
```json
{
  "agentCreditsThreshold": 100
}
```
The `agentCredits` widget stays hidden while the agy credit balance is healthy
and only appears (as a red warning) once it drops to/below this value. Defaults
to `minimumCreditAmountForUsage * 2` (≈ two minimum-uses left), or 100 when the
floor is unknown. agy has no Claude-style overage flag, so this stands in for
"show only when credits are running out."

**For reset-time display** (add to any config; default is `"remaining"`):
```json
{
  "rateLimitResetDisplay": "resetTime"
}
```
Controls how the rate-limit (`rateLimit5h` / `rateLimit7d` / `rateLimit7dSonnet` / `rateLimit7dFable`)
and agy quota (`agentQuota` / `agentQuota7d`) widgets show their reset window:
`remaining` = time left (`4h42m`), `resetTime` = the clock time it resets
(`15:30`, weekday-prefixed when not today), `both` = `4h42m, 15:30`.

**Note**: Omit `"disabledWidgets"` field entirely if user chose not to hide any widgets. Omit `"dailyBudget"` if not using budget tracking. Omit `"tagPatterns"` to use the default `["v*"]`. Omit `"separator"` if using default pipe style. Omit `"rateLimitResetDisplay"` to use the default `remaining`.

### 3. Install the launcher and wire settings.json (cross-platform)

The status line must point at a **stable launcher** that resolves the installed
plugin bundle at runtime — Claude Code caches plugins under a versioned (or
sometimes `unknown`) directory, so settings.json can't point at the cache path
directly. Do this with a small Node script so it works the same on
Windows/macOS/Linux regardless of shell (no bash globbing / quoting).

Write this to `~/.claude/agent-statusline/_install-launcher.cjs` (use the Write
tool; create the dir if needed) and then run `node` on it:

```js
const fs = require('fs'), os = require('os'), path = require('path');
const cacheRoot = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'agent-statusline', 'agent-statusline');
function findLauncher() {
  if (!fs.existsSync(cacheRoot)) return null;
  const dirs = fs.readdirSync(cacheRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const cmpDesc = (a, b) => { const A = a.split(/[.-]/).map(x => parseInt(x, 10) || 0), B = b.split(/[.-]/).map(x => parseInt(x, 10) || 0); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (B[i] || 0) - (A[i] || 0); if (d) return d; } return 0; };
  const semver = dirs.filter(n => /^\d+\.\d+\.\d+/.test(n)).sort(cmpDesc); // numeric: 1.0.10 > 1.0.9
  const others = dirs.filter(n => !/^\d+\.\d+\.\d+/.test(n)).sort(); // e.g. "unknown"
  for (const d of [...semver, ...others]) {
    const p = path.join(cacheRoot, d, 'dist', 'launcher.js');
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const src = findLauncher();
if (!src) throw new Error('launcher not found in plugin cache — run /plugin install agent-statusline@agent-statusline first');
const launcher = path.join(os.homedir(), '.claude', 'agent-statusline', 'launcher.js');
fs.mkdirSync(path.dirname(launcher), { recursive: true });
fs.copyFileSync(src, launcher);
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const s = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
s.statusLine = { type: 'command', command: 'node "' + launcher + '"' };
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2));
console.log('statusLine -> ' + launcher);
```

Run it:
- macOS/Linux: `node ~/.claude/agent-statusline/_install-launcher.cjs`
- Windows: `node "$env:USERPROFILE\.claude\agent-statusline\_install-launcher.cjs"`

This copies the launcher to a stable path and points settings.json at it; the
launcher resolves the newest installed plugin bundle at each render (matching by
semver dir, falling back to a non-semver dir like `unknown`). It merges only the
`statusLine` key, preserving all other settings.

**IMPORTANT**: After updating the plugin via `/plugin update agent-statusline`, re-run `/agent-statusline:update` to refresh the stable launcher copy.

## Examples

```bash
# Interactive mode
/agent-statusline:setup

# Preset modes
/agent-statusline:setup normal
/agent-statusline:setup compact
/agent-statusline:setup detailed

# Custom mode
/agent-statusline:setup custom "model,context,cost|projectInfo,todoProgress"
```

## Notes

- The status line will update on the next message
- To change settings later, run this command again
- Custom mode allows full control over which widgets appear on each line
- This command configures **Claude Code only**. Antigravity (`agy`) is installed
  separately via the `install-agy` script (its status line is settings.json-based)
  and keeps its own config — the two don't share files. On agy the model shows the
  `Λ` mark, `agentQuota` + `agentQuota7d` (`5h: NN%` / `7d: NN%`, from agy stdin),
  `agentCredits`, and the `agentSubagents`/`agentState`/`agentTasks` activity
  widgets when active — while the Anthropic rate-limit, cost, and `extraUsage`
  widgets hide. agy quota/activity come from agy's stdin (no RPC; the RPC is used
  only for `agentCredits`, lazily). agy output is indented 2 spaces to line up
  with Claude's status line, and `autoWrap` uses agy's reported terminal width.
