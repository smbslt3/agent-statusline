# agent-statusline

![License](https://img.shields.io/github/license/smbslt3/agent-statusline)
![Stars](https://img.shields.io/github/stars/smbslt3/agent-statusline)

**English** | [한국어](README_ko.md)


**Claude Code**

![Claude Code preview](docs/preview-claude.svg)

**Antigravity**

![Antigravity preview](docs/preview-agy.svg)

A status line plugin for Claude Code and Antigravity (`agy`)
— A modular widget system displaying model, context, quota, and usage/credits. A single codebase auto-detects the host and renders accordingly.

## Supported Hosts

| Host | Mark | Usage | Cost |
|---|---|---|---|
| **Claude Code** | `✽` | `rateLimit` `5h`  /  `7d-F` (Fable)  /  `7d`  /  `extra` (API credit) | `usage/credit` |
| **Antigravity** (`agy`) | `Λ` | `agentQuota` `5h` / `7d` | `agentCredits` (low-balance warning) |

Both installations are fully independent (do not share files or configuration).
- Codex does not support custom status line hooks yet, so it is currently unsupported.


**Usage/Cost Auto-detection:** Account type is automatically detected from login details (no manual configuration required).
- Subscription accounts (Pro/Max/Team) display `usage limit` widgets.
- Pay-as-you-go API key accounts display `cost`, `forecast`, and `todayCost`.

## Installation

**Requirements:** Claude Code v1.0.80+ or Antigravity `agy` · Node.js 18+

### Claude Code (Plugin Marketplace)

```
/plugin marketplace add smbslt3/agent-statusline
/plugin install agent-statusline
/agent-statusline:setup
```

### Antigravity (`agy`)
Clone the repository and run the installer script (this copies the bundle to `agy`'s home directory and links the status line config. Ensure the installation path contains no spaces, as `agy` splits commands on spaces):

```powershell
git clone https://github.com/smbslt3/agent-statusline.git
cd agent-statusline
powershell -ExecutionPolicy Bypass -File .\install-agy.ps1   # macOS/Linux: sh ./install-agy.sh
```

Restart `agy` afterwards. (Building is optional as the pre-built `dist/` is committed).

## Display Modes

Set via `displayMode` configuration or `/agent-statusline:setup <mode>`:

```
# compact (1 line)
✽ Opus (xH) │ ░░░░ 0% │ 5h: 23% (4h27m) │ 7d-F: 71% (2d18h) │ 7d: 60% (2d18h) │ extra $48.74/$100.00

# normal (2 lines, default) — adds project, session, burn rate, and todos
✽ Opus (xH) │ ░░░░ 0% │ 5h: 23% (4h27m) │ 7d-F: 71% (2d18h) │ 7d: 60% (2d18h) │ extra $48.74/$100.00
📁 agent-statusline (main*) │ 🔑 33640295 │ ⏱ 3h43m │ 🔥 12K/min

# detailed (5 lines) — adds tool/agent activity, cache hit rate, token breakdown, etc.
```

## Configuration

Config files are stored independently:
- Claude: `~/.claude/agent-statusline.local.json`
- agy: `~/.gemini/antigravity-cli/agent-statusline.local.json`

Both share the same schema:

```json
{ "displayMode": "normal", "theme": "default", "separator": "pipe", "rateLimitResetDisplay": "remaining" }
```

| Key | Values |
|---|---|
| `displayMode` | `compact` / `normal` (default) / `detailed` / `custom` |
| `theme` | `default` · `minimal` · `catppuccin` · `catppuccinLatte` · `dracula` · `gruvbox` · `nord` · `tokyoNight` · `solarized` |
| `separator` | `pipe` (default) / `space` / `dot` / `arrow` |
| `rateLimitResetDisplay` | `remaining` (default) / `resetTime` / `both` |
| `disabledWidgets` | Array of widget IDs to hide |
| `dailyBudget` | Number (USD) — Enables budget tracking widget (opt-in) |

## Widgets

Offers 40+ widgets across various categories:
- **Core**: `model`, `context`, `cost`, `projectInfo`
- **Limits/Quota**: `rateLimit*`, `agentQuota*`
- **Session**: `sessionId`, `sessionDuration`, `configCounts`
- **Activity**: `toolActivity`, `todoProgress`, `agentStatus`
- **Analytics**: `burnRate`, `cacheHit`, `tokenBreakdown`, `forecast`

Host-specific widgets are auto-selected (Claude uses rate limits and costs; agy uses quotas and activities).

For the full list of widgets and preset shorthand characters, refer to [`commands/setup.md`](commands/setup.md).

## Commands (Claude Code)

- `/agent-statusline:setup` — Configure display mode, theme, and reset style.
- `/agent-statusline:update` — Refresh launcher after running `/plugin update`.

*Note: Antigravity does not support slash commands. Modify its config file directly to apply changes.*

## Troubleshooting

- **Status line not showing:**
  - **Claude:** Check `/plugin list` → Verify `statusLine` exists in `~/.claude/settings.json` → Restart.
  - **agy:** Re-run `install-agy` → Ensure the `command` path is space-free and `node` is in PATH → Restart.
- **⚠️ symbol shown (Claude):** OAuth token expired (re-login required) or transient API rate limits (failures are cached for ~30 seconds).
- **Cache reset:** Delete `~/.cache/agent-statusline/` directory to clear cache.

## License

**MIT** ([LICENSE](LICENSE)). A fork of [uppinote20/claude-dashboard](https://github.com/uppinote20/claude-dashboard) (MIT) — adds dual-host support, host-branded marks/colors, real-time agy quotas, subscription plan auto-detection, and Windows support while preserving the original copyright notice.
