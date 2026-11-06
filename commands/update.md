---
description: Refresh version-independent statusLine launcher
allowed-tools: Read, Write, Bash(node:*)
---

# Agent Statusline Update

Refresh the stable statusLine launcher and migrate settings.json away from version-pinned cache paths.

Run this command after updating the plugin via `/plugin update agent-statusline`.

## Task

Re-point the stable launcher at the newest installed plugin bundle. Use a small
Node script so it works the same on Windows/macOS/Linux (no bash globbing).

1. Write this to `~/.claude/agent-statusline/_install-launcher.cjs` (use the Write tool; create the dir if needed):
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

2. Run it:
   - macOS/Linux: `node ~/.claude/agent-statusline/_install-launcher.cjs`
   - Windows: `node "$env:USERPROFILE\.claude\agent-statusline\_install-launcher.cjs"`

3. Show the user what was updated:
   - Stable launcher path
   - Whether a version-pinned `dist/index.js` command was migrated
   - Remind them to restart Claude Code for changes to take effect

> This command is **Claude Code only**. Antigravity (`agy`) is installed by the
> separate `install-agy` script; update it by re-running that script, not here.

## Example Output

```
Updated statusLine launcher
Path: ~/.claude/agent-statusline/launcher.js

Restart Claude Code for changes to take effect.
```
