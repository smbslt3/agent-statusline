#!/usr/bin/env sh
# One-click Antigravity (agy) installer for agent-statusline (macOS/Linux).
# Copies the bundle into agy's home and points settings.json at it.
#   Usage:  sh ./install-agy.sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SRC="$ROOT/dist/index.js"
[ -f "$SRC" ] || { echo "dist/index.js not found — run 'npm install && npm run build' first." >&2; exit 1; }

AGY_HOME="${HOME}/.gemini/antigravity-cli"
DEST_DIR="$AGY_HOME/agent-statusline"
mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/index.js"
cp "$SRC" "$DEST"

# agy splits the statusLine command on spaces WITHOUT honoring quotes, so a space
# in the path breaks launch. Unix has no 8.3 short-name fallback, so just warn.
case "$DEST" in
  *\ *) echo "WARNING: install path contains a space ($DEST). agy may fail to launch it; move \$HOME to a space-free location if the status line does not appear." >&2 ;;
esac

DEST="$DEST" SETTINGS="$AGY_HOME/settings.json" node -e '
const fs = require("fs");
const dest = process.env.DEST, p = process.env.SETTINGS;
const s = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
s.statusLine = { type: "command", command: "node " + dest, enabled: true };
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log("[OK] agent-statusline installed for agy -> " + p);
'
echo "Restart agy to see the status line."
