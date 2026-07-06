#!/usr/bin/env node

// scripts/statusline.ts
import { readFile as readFile9, stat as stat10 } from "fs/promises";
import { join as join8 } from "path";
import { homedir as homedir7 } from "os";

// scripts/types.ts
var DISPLAY_PRESETS = {
  compact: [
    ["model", "context", "rateLimit5h", "rateLimit7dSonnet", "rateLimit7dFable", "rateLimit7d", "extraUsage", "cost", "forecast", "todayCost", "agentQuota", "agentQuota7d", "agentCredits", "agentSubagents", "agentState", "agentTasks"]
  ],
  normal: [
    ["model", "context", "rateLimit5h", "rateLimit7dSonnet", "rateLimit7dFable", "rateLimit7d", "extraUsage", "cost", "forecast", "todayCost", "agentQuota", "agentQuota7d", "agentCredits", "agentSubagents", "agentState", "agentTasks"],
    ["projectInfo", "sessionId", "sessionDuration", "burnRate", "todoProgress"]
  ],
  detailed: [
    ["model", "context", "rateLimit5h", "rateLimit7dSonnet", "rateLimit7dFable", "rateLimit7d", "extraUsage", "cost", "forecast", "todayCost", "agentQuota", "agentQuota7d", "agentCredits", "agentSubagents", "agentState", "agentTasks"],
    ["projectInfo", "sessionName", "sessionId", "sessionDuration", "burnRate", "tokenSpeed", "todoProgress"],
    ["configCounts", "toolActivity", "agentStatus", "cacheHit", "tokenBreakdown"],
    ["linesChanged", "outputStyle", "version"],
    ["lastPrompt", "vimMode", "apiDuration", "tagStatus"]
  ]
};
var PRESET_CHAR_MAP = {
  M: "model",
  C: "context",
  b: "contextBar",
  "%": "contextPercentage",
  "#": "contextUsage",
  $: "cost",
  x: "extraUsage",
  R: "rateLimit5h",
  "7": "rateLimit7d",
  S: "rateLimit7dSonnet",
  F: "rateLimit7dFable",
  q: "agentQuota",
  w: "agentQuota7d",
  c: "agentCredits",
  u: "agentSubagents",
  s: "agentState",
  z: "agentTasks",
  P: "projectInfo",
  I: "sessionId",
  D: "sessionDuration",
  T: "toolActivity",
  A: "agentStatus",
  O: "todoProgress",
  B: "burnRate",
  H: "cacheHit",
  K: "configCounts",
  N: "tokenBreakdown",
  W: "forecast",
  U: "budget",
  V: "version",
  L: "linesChanged",
  Y: "outputStyle",
  Q: "tokenSpeed",
  J: "sessionName",
  "@": "todayCost",
  "?": "lastPrompt",
  m: "vimMode",
  a: "apiDuration",
  t: "tagStatus",
  "/": "slashCommand",
  g: "agentMode"
};
function parsePreset(preset) {
  return preset.split("|").map(
    (line) => [...line].map((ch) => PRESET_CHAR_MAP[ch]).filter((id) => id !== void 0)
  ).filter((line) => line.length > 0);
}
var DEFAULT_CONFIG = {
  displayMode: "normal",
  rateLimitResetDisplay: "remaining",
  cache: {
    ttlSeconds: 300
  }
};
var NEGATIVE_CACHE_SECONDS = 30;

// scripts/utils/colors.ts
var THEMES = {
  default: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;5;117m",
    // pastelCyan
    folder: "\x1B[38;5;222m",
    // pastelYellow
    branch: "\x1B[38;5;218m",
    // pastelPink
    safe: "\x1B[38;5;151m",
    // pastelGreen
    warning: "\x1B[38;5;222m",
    // pastelYellow
    danger: "\x1B[38;5;210m",
    // pastelRed
    secondary: "\x1B[38;5;249m",
    // pastelGray
    accent: "\x1B[38;5;222m",
    // pastelYellow
    info: "\x1B[38;5;117m",
    // pastelCyan
    barFilled: "\x1B[32m",
    // green
    barEmpty: "\x1B[90m",
    // gray
    red: "\x1B[31m",
    green: "\x1B[32m",
    yellow: "\x1B[33m",
    blue: "\x1B[34m",
    magenta: "\x1B[35m",
    cyan: "\x1B[36m",
    white: "\x1B[37m",
    gray: "\x1B[90m"
  },
  minimal: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[37m",
    // white
    folder: "\x1B[37m",
    // white
    branch: "\x1B[37m",
    // white
    safe: "\x1B[90m",
    // gray
    warning: "\x1B[37m",
    // white
    danger: "\x1B[1;37m",
    // bold white
    secondary: "\x1B[90m",
    // gray
    accent: "\x1B[37m",
    // white
    info: "\x1B[37m",
    // white
    barFilled: "\x1B[37m",
    // white
    barEmpty: "\x1B[90m",
    // gray
    red: "\x1B[37m",
    green: "\x1B[37m",
    yellow: "\x1B[37m",
    blue: "\x1B[37m",
    magenta: "\x1B[37m",
    cyan: "\x1B[37m",
    white: "\x1B[37m",
    gray: "\x1B[90m"
  },
  catppuccin: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;137;180;250m",
    // #89b4fa blue
    folder: "\x1B[38;2;249;226;175m",
    // #f9e2af yellow
    branch: "\x1B[38;2;245;194;231m",
    // #f5c2e7 pink
    safe: "\x1B[38;2;166;227;161m",
    // #a6e3a1 green
    warning: "\x1B[38;2;250;179;135m",
    // #fab387 peach
    danger: "\x1B[38;2;243;139;168m",
    // #f38ba8 red
    secondary: "\x1B[38;2;127;132;156m",
    // #7f849c overlay1
    accent: "\x1B[38;2;250;179;135m",
    // #fab387 peach
    info: "\x1B[38;2;116;199;236m",
    // #74c7ec sapphire
    barFilled: "\x1B[38;2;166;227;161m",
    // #a6e3a1 green
    barEmpty: "\x1B[38;2;88;91;112m",
    // #585b70 surface2
    red: "\x1B[38;2;243;139;168m",
    green: "\x1B[38;2;166;227;161m",
    yellow: "\x1B[38;2;249;226;175m",
    blue: "\x1B[38;2;137;180;250m",
    magenta: "\x1B[38;2;203;166;247m",
    cyan: "\x1B[38;2;148;226;213m",
    white: "\x1B[38;2;205;214;244m",
    gray: "\x1B[38;2;127;132;156m"
  },
  catppuccinLatte: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;30;102;245m",
    // #1e66f5 blue
    folder: "\x1B[38;2;223;142;29m",
    // #df8e1d yellow
    branch: "\x1B[38;2;234;118;203m",
    // #ea76cb pink
    safe: "\x1B[38;2;64;160;43m",
    // #40a02b green
    warning: "\x1B[38;2;254;100;11m",
    // #fe640b peach
    danger: "\x1B[38;2;210;15;57m",
    // #d20f39 red
    secondary: "\x1B[38;2;140;143;161m",
    // #8c8fa1 overlay1
    accent: "\x1B[38;2;254;100;11m",
    // #fe640b peach
    info: "\x1B[38;2;32;159;181m",
    // #209fb5 sapphire
    barFilled: "\x1B[38;2;64;160;43m",
    // #40a02b green
    barEmpty: "\x1B[38;2;188;192;204m",
    // #bcc0cc surface1
    red: "\x1B[38;2;210;15;57m",
    green: "\x1B[38;2;64;160;43m",
    yellow: "\x1B[38;2;223;142;29m",
    blue: "\x1B[38;2;30;102;245m",
    magenta: "\x1B[38;2;136;57;239m",
    // #8839ef mauve
    cyan: "\x1B[38;2;23;146;153m",
    // #179299 teal
    white: "\x1B[38;2;76;79;105m",
    // #4c4f69 text
    gray: "\x1B[38;2;140;143;161m"
  },
  gruvbox: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;215;153;33m",
    // #d79921 yellow
    folder: "\x1B[38;2;250;189;47m",
    // #fabd2f bright yellow
    branch: "\x1B[38;2;211;134;155m",
    // #d3869b purple
    safe: "\x1B[38;2;184;187;38m",
    // #b8bb26 green
    warning: "\x1B[38;2;250;189;47m",
    // #fabd2f yellow
    danger: "\x1B[38;2;204;36;29m",
    // #cc241d red
    secondary: "\x1B[38;2;168;153;132m",
    // #a89984 gray
    accent: "\x1B[38;2;250;189;47m",
    // #fabd2f yellow
    info: "\x1B[38;2;131;165;152m",
    // #83a598 blue
    barFilled: "\x1B[38;2;184;187;38m",
    // #b8bb26 green
    barEmpty: "\x1B[38;2;80;73;69m",
    // #504945 dark gray
    red: "\x1B[38;2;204;36;29m",
    green: "\x1B[38;2;184;187;38m",
    yellow: "\x1B[38;2;250;189;47m",
    blue: "\x1B[38;2;131;165;152m",
    magenta: "\x1B[38;2;211;134;155m",
    cyan: "\x1B[38;2;142;192;124m",
    white: "\x1B[38;2;235;219;178m",
    gray: "\x1B[38;2;168;153;132m"
  },
  dracula: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;189;147;249m",
    // #bd93f9 purple
    folder: "\x1B[38;2;255;184;108m",
    // #ffb86c orange
    branch: "\x1B[38;2;255;121;198m",
    // #ff79c6 pink
    safe: "\x1B[38;2;80;250;123m",
    // #50fa7b green
    warning: "\x1B[38;2;241;250;140m",
    // #f1fa8c yellow
    danger: "\x1B[38;2;255;85;85m",
    // #ff5555 red
    secondary: "\x1B[38;2;98;114;164m",
    // #6272a4 comment
    accent: "\x1B[38;2;255;184;108m",
    // #ffb86c orange
    info: "\x1B[38;2;139;233;253m",
    // #8be9fd cyan
    barFilled: "\x1B[38;2;80;250;123m",
    // #50fa7b green
    barEmpty: "\x1B[38;2;68;71;90m",
    // #44475a current line
    red: "\x1B[38;2;255;85;85m",
    green: "\x1B[38;2;80;250;123m",
    yellow: "\x1B[38;2;241;250;140m",
    blue: "\x1B[38;2;189;147;249m",
    magenta: "\x1B[38;2;255;121;198m",
    cyan: "\x1B[38;2;139;233;253m",
    white: "\x1B[38;2;248;248;242m",
    gray: "\x1B[38;2;98;114;164m"
  },
  nord: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;136;192;208m",
    // #88c0d0 frost cyan
    folder: "\x1B[38;2;235;203;139m",
    // #ebcb8b yellow
    branch: "\x1B[38;2;180;142;173m",
    // #b48ead purple
    safe: "\x1B[38;2;163;190;140m",
    // #a3be8c green
    warning: "\x1B[38;2;235;203;139m",
    // #ebcb8b yellow
    danger: "\x1B[38;2;191;97;106m",
    // #bf616a red
    secondary: "\x1B[38;2;76;86;106m",
    // #4c566a polar night
    accent: "\x1B[38;2;208;135;112m",
    // #d08770 orange
    info: "\x1B[38;2;129;161;193m",
    // #81a1c1 frost blue
    barFilled: "\x1B[38;2;163;190;140m",
    // #a3be8c green
    barEmpty: "\x1B[38;2;67;76;94m",
    // #434c5e polar night
    red: "\x1B[38;2;191;97;106m",
    green: "\x1B[38;2;163;190;140m",
    yellow: "\x1B[38;2;235;203;139m",
    blue: "\x1B[38;2;129;161;193m",
    magenta: "\x1B[38;2;180;142;173m",
    cyan: "\x1B[38;2;136;192;208m",
    white: "\x1B[38;2;236;239;244m",
    gray: "\x1B[38;2;76;86;106m"
  },
  tokyoNight: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;122;162;247m",
    // #7aa2f7 blue
    folder: "\x1B[38;2;224;175;104m",
    // #e0af68 yellow
    branch: "\x1B[38;2;187;154;247m",
    // #bb9af7 purple
    safe: "\x1B[38;2;158;206;106m",
    // #9ece6a green
    warning: "\x1B[38;2;224;175;104m",
    // #e0af68 yellow
    danger: "\x1B[38;2;247;118;142m",
    // #f7768e red
    secondary: "\x1B[38;2;86;95;137m",
    // #565f89 comment
    accent: "\x1B[38;2;255;158;100m",
    // #ff9e64 orange
    info: "\x1B[38;2;125;207;255m",
    // #7dcfff cyan
    barFilled: "\x1B[38;2;158;206;106m",
    // #9ece6a green
    barEmpty: "\x1B[38;2;59;66;97m",
    // #3b4261 dark
    red: "\x1B[38;2;247;118;142m",
    green: "\x1B[38;2;158;206;106m",
    yellow: "\x1B[38;2;224;175;104m",
    blue: "\x1B[38;2;122;162;247m",
    magenta: "\x1B[38;2;187;154;247m",
    cyan: "\x1B[38;2;125;207;255m",
    white: "\x1B[38;2;169;177;214m",
    gray: "\x1B[38;2;86;95;137m"
  },
  solarized: {
    dim: "\x1B[2m",
    bold: "\x1B[1m",
    model: "\x1B[38;2;38;139;210m",
    // #268bd2 blue
    folder: "\x1B[38;2;181;137;0m",
    // #b58900 yellow
    branch: "\x1B[38;2;211;54;130m",
    // #d33682 magenta
    safe: "\x1B[38;2;133;153;0m",
    // #859900 green
    warning: "\x1B[38;2;181;137;0m",
    // #b58900 yellow
    danger: "\x1B[38;2;220;50;47m",
    // #dc322f red
    secondary: "\x1B[38;2;88;110;117m",
    // #586e75 base01
    accent: "\x1B[38;2;203;75;22m",
    // #cb4b16 orange
    info: "\x1B[38;2;42;161;152m",
    // #2aa198 cyan
    barFilled: "\x1B[38;2;133;153;0m",
    // #859900 green
    barEmpty: "\x1B[38;2;7;54;66m",
    // #073642 base02
    red: "\x1B[38;2;220;50;47m",
    green: "\x1B[38;2;133;153;0m",
    yellow: "\x1B[38;2;181;137;0m",
    blue: "\x1B[38;2;38;139;210m",
    magenta: "\x1B[38;2;211;54;130m",
    cyan: "\x1B[38;2;42;161;152m",
    white: "\x1B[38;2;253;246;227m",
    gray: "\x1B[38;2;88;110;117m"
  }
};
var activeTheme = THEMES.default;
function setTheme(themeId) {
  activeTheme = THEMES[themeId ?? "default"] ?? THEMES.default;
  cachedSeparator = null;
}
function getTheme() {
  return activeTheme;
}
var RESET = "\x1B[0m";
var COLORS = {
  reset: RESET,
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m",
  brightRed: "\x1B[91m",
  brightGreen: "\x1B[92m",
  brightYellow: "\x1B[93m",
  brightCyan: "\x1B[96m",
  pastelYellow: "\x1B[38;5;222m",
  pastelCyan: "\x1B[38;5;117m",
  pastelPink: "\x1B[38;5;218m",
  pastelGreen: "\x1B[38;5;151m",
  pastelOrange: "\x1B[38;5;216m",
  pastelRed: "\x1B[38;5;210m",
  pastelGray: "\x1B[38;5;249m"
};
function getColorForPercent(percent) {
  const theme = getTheme();
  if (percent <= 50)
    return theme.safe;
  if (percent <= 80)
    return theme.warning;
  return theme.danger;
}
function colorize(text, color) {
  return `${color}${text}${RESET}`;
}
var SEPARATOR_CHARS = {
  pipe: "\u2502",
  space: " ",
  dot: "\xB7",
  arrow: "\u203A"
};
var activeSeparatorStyle = "pipe";
var cachedSeparator = null;
function setSeparatorStyle(style) {
  activeSeparatorStyle = style && style in SEPARATOR_CHARS ? style : "pipe";
  cachedSeparator = null;
}
function getSeparator() {
  if (cachedSeparator !== null)
    return cachedSeparator;
  const char = SEPARATOR_CHARS[activeSeparatorStyle];
  cachedSeparator = activeSeparatorStyle === "space" ? "  " : ` ${getTheme().dim}${char}${RESET} `;
  return cachedSeparator;
}

// scripts/utils/emoji.ts
var ICON = {
  warning: "\u26A0\uFE0F",
  gear: "\u2699\uFE0F",
  alarm: "\u{1F6A8}\uFE0F",
  stopwatch: "\u23F1\uFE0F",
  zap: "\u26A1\uFE0F",
  banknote: "\u{1F4B5}\uFE0F",
  moneyBag: "\u{1F4B0}\uFE0F",
  chartUp: "\u{1F4C8}\uFE0F",
  robot: "\u{1F916}\uFE0F",
  person: "\u{1F464}\uFE0F",
  folder: "\u{1F4C1}\uFE0F",
  tree: "\u{1F333}\uFE0F",
  label: "\u{1F3F7}\uFE0F",
  package: "\u{1F4E6}\uFE0F",
  chart: "\u{1F4CA}\uFE0F",
  greenCircle: "\u{1F7E2}\uFE0F",
  yellowCircle: "\u{1F7E1}\uFE0F",
  redCircle: "\u{1F534}\uFE0F",
  fire: "\u{1F525}\uFE0F",
  speech: "\u{1F4AC}\uFE0F",
  target: "\u{1F3AF}\uFE0F",
  key: "\u{1F511}\uFE0F"
};

// scripts/utils/api-client.ts
import { execFile as execFile2 } from "child_process";
import { join as join2 } from "path";

// scripts/utils/credentials.ts
import { execFile } from "child_process";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
var KEYCHAIN_CACHE_TTL_MS = 1e4;
var KEYCHAIN_BACKOFF_MS = 6e4;
var credentialsCache = null;
var keychainBackoffAt = null;
function parseCredentials(raw) {
  const creds = JSON.parse(raw);
  const oauth = creds?.claudeAiOauth;
  return {
    token: oauth?.accessToken ?? null,
    subscriptionType: typeof oauth?.subscriptionType === "string" ? oauth.subscriptionType : null
  };
}
async function getCredentials() {
  return (await loadCredentials())?.token ?? null;
}
async function getCredentialState() {
  const creds = await loadCredentials();
  return { found: creds !== null, subscriptionType: creds?.subscriptionType ?? null };
}
async function loadCredentials() {
  try {
    if (process.platform === "darwin") {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}
function execKeychainAsync() {
  return new Promise((resolve, reject) => {
    execFile(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf-8", timeout: 3e3 },
      (error, stdout) => {
        if (error)
          reject(error);
        else
          resolve(stdout.trim());
      }
    );
  });
}
async function getCredentialsFromKeychain() {
  if (keychainBackoffAt !== null && Date.now() - keychainBackoffAt < KEYCHAIN_BACKOFF_MS) {
    return await getCredentialsFromFile();
  }
  if (credentialsCache?.timestamp && Date.now() - credentialsCache.timestamp < KEYCHAIN_CACHE_TTL_MS) {
    return credentialsCache;
  }
  try {
    const result = await execKeychainAsync();
    const parsed = parseCredentials(result);
    credentialsCache = { ...parsed, timestamp: Date.now() };
    keychainBackoffAt = null;
    return parsed;
  } catch {
    keychainBackoffAt = Date.now();
    return await getCredentialsFromFile();
  }
}
async function getCredentialsFromFile() {
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const fileStat = await stat(credPath);
    const mtime = fileStat.mtimeMs;
    if (credentialsCache?.mtime === mtime) {
      return credentialsCache;
    }
    const content = await readFile(credPath, "utf-8");
    const parsed = parseCredentials(content);
    credentialsCache = { ...parsed, mtime };
    return parsed;
  } catch {
    return null;
  }
}

// scripts/utils/hash.ts
import { createHash } from "crypto";
var HASH_LENGTH = 16;
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex").substring(0, HASH_LENGTH);
}

// scripts/utils/spawn-cli.ts
import { stat as stat2 } from "fs/promises";
import path from "path";
var DEFAULT_WINDOWS_EXTENSIONS = [".EXE", ".CMD", ".BAT", ".COM", ".PS1"];
async function pathExists(p) {
  try {
    await stat2(p);
    return true;
  } catch {
    return false;
  }
}
function windowsExecutableNames(command) {
  const configured = (process.env.PATHEXT || DEFAULT_WINDOWS_EXTENSIONS.join(";")).split(";").map((ext) => ext.trim()).filter(Boolean);
  const extensions = Array.from(/* @__PURE__ */ new Set([...configured, ...DEFAULT_WINDOWS_EXTENSIONS]));
  return extensions.flatMap((ext) => [`${command}${ext.toLowerCase()}`, `${command}${ext.toUpperCase()}`]).concat(command);
}
function executableCandidates(command) {
  return process.platform === "win32" ? windowsExecutableNames(command) : [command];
}
async function findExecutable(names) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of pathEntries) {
    for (const name of names) {
      for (const candidate of executableCandidates(name)) {
        try {
          await stat2(path.join(dir, candidate));
          return path.join(dir, candidate);
        } catch {
        }
      }
    }
  }
  return null;
}

// scripts/version.ts
var VERSION = "1.0.0";

// scripts/utils/debug.ts
var DEBUG = process.env.DEBUG === "agent-statusline" || process.env.DEBUG === "1" || process.env.DEBUG === "true";
function debugLog(context, message, error) {
  if (!DEBUG)
    return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const prefix = `[agent-statusline:${context}]`;
  if (error) {
    console.error(`${timestamp} ${prefix} ${message}`, error);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}

// scripts/utils/file-cache.ts
import { readFile as readFile2, writeFile, mkdir, readdir, stat as stat3, unlink } from "fs/promises";
import os from "os";
import path2 from "path";
var FILE_CACHE_DIR = process.env.AGENT_STATUSLINE_CACHE_DIR || path2.join(os.homedir(), ".cache", "agent-statusline");
var STALE_CACHE_TTL_SECONDS = 3600;
var CACHE_CLEANUP_AGE_SECONDS = 3600;
var CLEANUP_INTERVAL_MS = 36e5;
var CLEANABLE_PREFIXES = [
  "cache-",
  "antigravity-usage-",
  "git-"
];
var lastCleanupTime = 0;
function fileCachePath(name) {
  return path2.join(FILE_CACHE_DIR, name);
}
async function loadFileCache(cacheFile, ttlSeconds) {
  try {
    const raw = await readFile2(cacheFile, "utf-8");
    const entry = JSON.parse(raw);
    if (typeof entry.timestamp !== "number")
      return null;
    if (!("data" in entry))
      return null;
    const ageSeconds = (Date.now() - entry.timestamp) / 1e3;
    if (ageSeconds < ttlSeconds)
      return entry;
    return null;
  } catch {
    return null;
  }
}
async function saveFileCache(cacheFile, data, mode = 384) {
  try {
    await mkdir(path2.dirname(cacheFile), { recursive: true, mode: 448 });
    await writeFile(
      cacheFile,
      JSON.stringify({ data, timestamp: Date.now() }),
      { mode }
    );
  } catch (err) {
    debugLog("file-cache", `save failed for ${cacheFile}`, err);
  }
  cleanupExpiredCache().catch(() => {
  });
}
async function cleanupExpiredCache(cacheDir = FILE_CACHE_DIR) {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS)
    return;
  try {
    const files = await readdir(cacheDir);
    lastCleanupTime = now;
    for (const file of files) {
      if (!file.endsWith(".json"))
        continue;
      if (!CLEANABLE_PREFIXES.some((p) => file.startsWith(p)))
        continue;
      const filePath = path2.join(cacheDir, file);
      try {
        const fileStat = await stat3(filePath);
        const ageSeconds = (now - fileStat.mtimeMs) / 1e3;
        if (ageSeconds > CACHE_CLEANUP_AGE_SECONDS) {
          await unlink(filePath);
        }
      } catch {
      }
    }
  } catch {
  }
}

// scripts/utils/api-client.ts
var API_URL = "https://api.anthropic.com/api/oauth/usage";
var API_TIMEOUT_MS = 5e3;
var MAX_RETRY_AFTER_MS = 1e4;
var STALE_FALLBACK_SECONDS = STALE_CACHE_TTL_SECONDS;
var usageCacheMap = /* @__PURE__ */ new Map();
var pendingRequests = /* @__PURE__ */ new Map();
var lastTokenHash = null;
function getCacheFilePath(tokenHash) {
  return fileCachePath(`cache-${tokenHash}.json`);
}
function isCacheValid(tokenHash, ttlSeconds) {
  const cache = usageCacheMap.get(tokenHash);
  if (!cache)
    return false;
  const ageSeconds = (Date.now() - cache.timestamp) / 1e3;
  const effectiveTtl = cache.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
  return ageSeconds < effectiveTtl;
}
async function fetchUsageLimits(ttlSeconds = 300) {
  const token = await getCredentials();
  if (!token) {
    if (lastTokenHash) {
      const cached = usageCacheMap.get(lastTokenHash);
      if (cached && !cached.isError)
        return cached.data;
      const fileCache = await loadFileCache2(lastTokenHash, STALE_FALLBACK_SECONDS);
      if (fileCache)
        return fileCache;
    }
    return null;
  }
  const tokenHash = hashToken(token);
  lastTokenHash = tokenHash;
  if (isCacheValid(tokenHash, ttlSeconds)) {
    const cached = usageCacheMap.get(tokenHash);
    if (cached) {
      if (cached.isError) {
        debugLog("api", "Negative cache hit, returning stale or null");
        return loadFileCache2(tokenHash, STALE_FALLBACK_SECONDS);
      }
      return cached.data;
    }
  }
  const fileCacheRaw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  if (fileCacheRaw) {
    usageCacheMap.set(tokenHash, { data: fileCacheRaw.data, timestamp: fileCacheRaw.timestamp });
    return fileCacheRaw.data;
  }
  const pending = pendingRequests.get(tokenHash);
  if (pending) {
    return pending;
  }
  const requestPromise = fetchFromApi(token, tokenHash);
  pendingRequests.set(tokenHash, requestPromise);
  try {
    const result = await requestPromise;
    if (result)
      return result;
    const staleMemory = usageCacheMap.get(tokenHash);
    debugLog("api", `Setting negative cache for ${NEGATIVE_CACHE_SECONDS}s`);
    usageCacheMap.set(tokenHash, {
      data: null,
      timestamp: Date.now(),
      isError: true
    });
    if (staleMemory && !staleMemory.isError)
      return staleMemory.data;
    const staleFile = await loadFileCache2(tokenHash, STALE_FALLBACK_SECONDS);
    if (staleFile)
      return staleFile;
    return null;
  } finally {
    pendingRequests.delete(tokenHash);
  }
}
async function makeRequest(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": `agent-statusline/${VERSION}`,
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
function trustedCurlPaths() {
  if (process.platform === "win32") {
    const sysRoot = process.env.SystemRoot || process.env.windir || "C:\\Windows";
    return [join2(sysRoot, "System32", "curl.exe")];
  }
  return ["/usr/bin/curl", "/bin/curl", "/usr/local/bin/curl", "/opt/homebrew/bin/curl"];
}
async function resolveCurl() {
  for (const candidate of trustedCurlPaths()) {
    if (await pathExists(candidate))
      return candidate;
  }
  return findExecutable(["curl"]);
}
async function makeRequestViaCurl(token) {
  const curlPath = await resolveCurl();
  if (!curlPath) {
    debugLog("api", "curl not found, skipping fallback");
    return null;
  }
  return new Promise((resolve) => {
    const child = execFile2(
      curlPath,
      [
        "-s",
        "-w",
        "\n%{http_code}",
        "-K",
        "-",
        // read the Authorization header from stdin (kept off argv)
        API_URL,
        "-H",
        "Accept: application/json",
        "-H",
        `User-Agent: agent-statusline/${VERSION}`,
        "-H",
        "anthropic-beta: oauth-2025-04-20"
      ],
      { encoding: "utf-8", timeout: API_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          debugLog("api", "curl fallback failed", { code: error.code });
          resolve(null);
          return;
        }
        try {
          const lines = stdout.trimEnd().split("\n");
          const statusCode = parseInt(lines[lines.length - 1], 10);
          const body = lines.slice(0, -1).join("\n");
          const data = JSON.parse(body);
          resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode, data });
        } catch {
          debugLog("api", "curl response parse failed");
          resolve(null);
        }
      }
    );
    child.on("error", () => resolve(null));
    try {
      const safeToken = token.replace(/[\r\n"]/g, "");
      child.stdin?.end(`header = "Authorization: Bearer ${safeToken}"
`);
    } catch {
      resolve(null);
    }
  });
}
async function fetchFromApi(token, tokenHash) {
  try {
    let response = await makeRequest(token);
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      if (retryAfterHeader === null) {
        debugLog("api", "429 received, no retry-after header, skipping");
      } else {
        const retryAfter = parseInt(retryAfterHeader, 10);
        if (!isNaN(retryAfter) && retryAfter * 1e3 <= MAX_RETRY_AFTER_MS) {
          debugLog("api", `429 received, retrying after ${retryAfter}s`);
          await new Promise((r) => setTimeout(r, retryAfter * 1e3));
          response = await makeRequest(token);
        } else {
          debugLog("api", `429 received, retry-after ${retryAfter}s exceeds limit, skipping`);
        }
      }
    }
    if (response.status === 403) {
      debugLog("api", "403 from fetch, trying curl fallback");
      const curlResult = await makeRequestViaCurl(token);
      if (curlResult?.ok) {
        return parseAndCacheLimits(curlResult.data, tokenHash);
      }
      debugLog("api", `curl fallback ${curlResult ? `returned ${curlResult.status}` : "failed"}`);
      return null;
    }
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return parseAndCacheLimits(data, tokenHash);
  } catch (error) {
    debugLog("api", "Request failed", error);
    return null;
  }
}
function validateLimitWindow(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const w = raw;
  if (typeof w.utilization !== "number")
    return null;
  return {
    utilization: w.utilization,
    resets_at: typeof w.resets_at === "string" ? w.resets_at : null
  };
}
function validateExtraUsage(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const x = raw;
  const scale = typeof x.decimal_places === "number" ? 10 ** x.decimal_places : 1;
  const major = (v) => typeof v === "number" ? v / scale : null;
  return {
    is_enabled: x.is_enabled === true,
    used_credits: major(x.used_credits),
    monthly_limit: major(x.monthly_limit),
    utilization: typeof x.utilization === "number" ? x.utilization : null,
    currency: typeof x.currency === "string" ? x.currency : null
  };
}
function readLimitsArray(d) {
  if (!Array.isArray(d.limits))
    return [];
  return d.limits.filter((entry) => !!entry && typeof entry === "object");
}
function windowFromLimitsEntry(entry) {
  if (!entry || typeof entry.percent !== "number")
    return null;
  return {
    utilization: entry.percent,
    resets_at: typeof entry.resets_at === "string" ? entry.resets_at : null
  };
}
function readScopeModel(entry) {
  const scope = entry.scope;
  if (!scope || typeof scope !== "object")
    return null;
  const model = scope.model;
  if (!model || typeof model !== "object")
    return null;
  const name = model.display_name;
  return typeof name === "string" ? name : null;
}
function isScopedWeeklyEntry(entry) {
  return entry.kind === "weekly_scoped" || readScopeModel(entry) !== null;
}
function scopedWeeklyWindow(limitsArr, family) {
  const entry = limitsArr.find((e) => {
    const model = readScopeModel(e);
    return model !== null && model.toLowerCase().includes(family);
  });
  return windowFromLimitsEntry(entry);
}
function resolveFiveHour(d, limitsArr) {
  const entry = limitsArr.find((e) => e.group === "session" || e.kind === "session");
  const fromLimits = windowFromLimitsEntry(entry);
  if (fromLimits)
    return fromLimits;
  return validateLimitWindow(d.five_hour);
}
function resolveSevenDay(d, limitsArr) {
  const entry = limitsArr.find(
    (e) => e.kind === "weekly_all" || e.group === "weekly" && !isScopedWeeklyEntry(e)
  );
  const fromLimits = windowFromLimitsEntry(entry);
  if (fromLimits)
    return fromLimits;
  return validateLimitWindow(d.seven_day);
}
function resolveSevenDaySonnet(d, limitsArr) {
  return scopedWeeklyWindow(limitsArr, "sonnet") ?? validateLimitWindow(d.seven_day_sonnet);
}
function resolveSevenDayFable(d, limitsArr) {
  return scopedWeeklyWindow(limitsArr, "fable") ?? validateLimitWindow(d.seven_day_fable);
}
function readSpend(d) {
  if (!d.spend || typeof d.spend !== "object")
    return null;
  return d.spend;
}
function minorToMajor(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const m = raw;
  if (typeof m.amount_minor !== "number")
    return null;
  const exponent = typeof m.exponent === "number" ? m.exponent : 2;
  return m.amount_minor / 10 ** exponent;
}
function extraUsageFromSpend(spend) {
  const used = spend.used && typeof spend.used === "object" ? spend.used : null;
  const usedCredits = minorToMajor(used);
  const currency = used && typeof used.currency === "string" ? used.currency : null;
  let monthlyLimit = minorToMajor(spend.limit);
  if (monthlyLimit === null && spend.cap && typeof spend.cap === "object") {
    const cap = spend.cap;
    monthlyLimit = minorToMajor(cap.credits) ?? minorToMajor(cap.money);
  }
  return {
    is_enabled: spend.enabled === true,
    used_credits: usedCredits,
    monthly_limit: monthlyLimit,
    utilization: typeof spend.percent === "number" ? spend.percent : null,
    currency
  };
}
function resolveExtraUsage(d) {
  const spend = readSpend(d);
  if (spend)
    return extraUsageFromSpend(spend);
  return validateExtraUsage(d.extra_usage);
}
async function parseAndCacheLimits(data, tokenHash) {
  const d = data && typeof data === "object" ? data : {};
  const limitsArr = readLimitsArray(d);
  const limits = {
    five_hour: resolveFiveHour(d, limitsArr),
    seven_day: resolveSevenDay(d, limitsArr),
    seven_day_sonnet: resolveSevenDaySonnet(d, limitsArr),
    seven_day_fable: resolveSevenDayFable(d, limitsArr),
    extra_usage: resolveExtraUsage(d)
  };
  usageCacheMap.set(tokenHash, { data: limits, timestamp: Date.now() });
  await saveFileCache2(tokenHash, limits);
  return limits;
}
async function loadFileCacheRaw(tokenHash, ttlSeconds) {
  return loadFileCache(getCacheFilePath(tokenHash), ttlSeconds);
}
async function loadFileCache2(tokenHash, ttlSeconds) {
  const raw = await loadFileCacheRaw(tokenHash, ttlSeconds);
  return raw?.data ?? null;
}
async function saveFileCache2(tokenHash, data) {
  await saveFileCache(getCacheFilePath(tokenHash), data);
}

// scripts/utils/antigravity-client.ts
import { execFile as execFile3 } from "child_process";
import { readFile as readFile3 } from "fs/promises";
import https from "https";
import os2 from "os";
import path3 from "path";

// scripts/utils/usage-cache.ts
async function withUsageCache(opts) {
  const { key, cacheFile, ttlSeconds, memoryCache, pendingRequests: pendingRequests4, debugTag, collect } = opts;
  const cached = memoryCache.get(key);
  if (cached) {
    const ageSeconds = (Date.now() - cached.timestamp) / 1e3;
    const effectiveTtl = cached.isError ? NEGATIVE_CACHE_SECONDS : ttlSeconds;
    if (ageSeconds < effectiveTtl) {
      if (cached.isError) {
        debugLog(debugTag, "negative cache hit");
        return null;
      }
      return cached.data;
    }
  }
  const fromFile = await loadFileCache(cacheFile, ttlSeconds);
  if (fromFile) {
    memoryCache.set(key, { data: fromFile.data, timestamp: fromFile.timestamp });
    return fromFile.data;
  }
  const pending = pendingRequests4.get(key);
  if (pending)
    return pending;
  const requestPromise = (async () => {
    const result = await collect();
    if (result) {
      memoryCache.set(key, { data: result, timestamp: Date.now() });
      await saveFileCache(cacheFile, result);
      return result;
    }
    memoryCache.set(key, {
      data: null,
      timestamp: Date.now(),
      isError: true
    });
    if (cached && !cached.isError)
      return cached.data;
    const staleFile = await loadFileCache(cacheFile, STALE_CACHE_TTL_SECONDS);
    return staleFile?.data ?? null;
  })();
  pendingRequests4.set(key, requestPromise);
  try {
    return await requestPromise;
  } finally {
    pendingRequests4.delete(key);
  }
}
function pickSettingsModel(jsonLike) {
  const model = typeof jsonLike?.model === "string" ? jsonLike.model : jsonLike?.model?.name || jsonLike?.selectedModel;
  return typeof model === "string" && model.trim() ? model.trim() : null;
}

// scripts/utils/antigravity-client.ts
var ANTIGRAVITY_USAGE_CACHE_KEY = "local";
var ANTIGRAVITY_USAGE_CACHE_FILE = fileCachePath("antigravity-usage-local.json");
var ANTIGRAVITY_EXECUTABLES = ["agy", "antigravity", "antigravity-cli"];
var RPC_SERVICE_PATH = "/exa.language_server_pb.LanguageServerService/GetUserStatus";
var RPC_REQUEST_TIMEOUT_MS = 2e3;
var MAX_PROBE_PORTS = 8;
var DISCOVERY_TIMEOUT_MS = 5e3;
var PROBE_DEADLINE_MS = 4e3;
var antigravityCacheMap = /* @__PURE__ */ new Map();
var pendingRequests2 = /* @__PURE__ */ new Map();
function resolveAntigravityHomes() {
  if (process.env.ANTIGRAVITY_HOME)
    return [process.env.ANTIGRAVITY_HOME];
  return [
    path3.join(os2.homedir(), ".gemini", "antigravity-cli"),
    path3.join(os2.homedir(), ".config", "antigravity-cli")
  ];
}
async function readSettingsModel() {
  for (const home of resolveAntigravityHomes()) {
    for (const filename of ["settings.json", "config/settings.json"]) {
      try {
        const raw = await readFile3(path3.join(home, filename), "utf-8");
        const json = JSON.parse(raw);
        const model = pickSettingsModel(json);
        if (model)
          return model;
      } catch {
      }
    }
  }
  return null;
}
function runCommand(file, args) {
  return new Promise((resolve) => {
    try {
      execFile3(
        file,
        args,
        { timeout: DISCOVERY_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        (error, stdout) => resolve(error ? "" : String(stdout))
      );
    } catch {
      resolve("");
    }
  });
}
function extractFlag(commandLine, flag) {
  const match = commandLine.match(new RegExp(`${flag}[=\\s]+("?)([^"\\s]+)\\1`));
  return match ? match[2] : null;
}
function isAntigravityCommand(name, commandLine) {
  const lowerName = name.toLowerCase();
  const lowerCmd = commandLine.toLowerCase();
  if (/^agy(\.exe)?$/.test(lowerName))
    return true;
  if (lowerCmd.includes("antigravity-cli") || lowerCmd.includes("antigravity_cli"))
    return true;
  return lowerName.includes("language_server") && lowerCmd.includes("antigravity");
}
async function discoverServersWindows() {
  const script = `$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^agy(\\.exe)?$|language_server' };$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue;$out = @($procs | ForEach-Object { $procId = $_.ProcessId; [pscustomobject]@{ name = $_.Name; cmd = "$($_.CommandLine)"; ports = @($conns | Where-Object { $_.OwningProcess -eq $procId } | ForEach-Object LocalPort | Sort-Object -Unique) } });ConvertTo-Json -InputObject $out -Compress -Depth 4`;
  const stdout = await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  if (!stdout.trim())
    return [];
  try {
    const parsed = JSON.parse(stdout);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.filter((entry) => isAntigravityCommand(entry.name ?? "", entry.cmd ?? "")).map((entry) => {
      const portsArr = Array.isArray(entry.ports) ? entry.ports : entry.ports != null ? [entry.ports] : [];
      return {
        ports: portsArr.filter((port) => Number.isInteger(port) && port > 0),
        csrfToken: extractFlag(entry.cmd ?? "", "--csrf_token") ?? extractFlag(entry.cmd ?? "", "--extension_server_csrf_token")
      };
    }).filter((candidate) => candidate.ports.length > 0);
  } catch {
    return [];
  }
}
async function discoverServersPosix() {
  const psOut = await runCommand("ps", ["-ax", "-o", "pid=,command="]);
  if (!psOut.trim())
    return [];
  const candidates = [];
  for (const line of psOut.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match)
      continue;
    const commandLine = match[2];
    const binary = path3.basename(commandLine.split(/\s+/)[0] ?? "");
    if (isAntigravityCommand(binary, commandLine)) {
      candidates.push({ pid: Number(match[1]), commandLine });
    }
  }
  const out = [];
  for (const candidate of candidates) {
    const lsofOut = await runCommand("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", String(candidate.pid)]);
    const ports = Array.from(new Set(
      [...lsofOut.matchAll(/:(\d+)\s+\(LISTEN\)/g)].map((m) => Number(m[1]))
    ));
    if (ports.length > 0) {
      out.push({
        ports,
        csrfToken: extractFlag(candidate.commandLine, "--csrf_token") ?? extractFlag(candidate.commandLine, "--extension_server_csrf_token")
      });
    }
  }
  return out;
}
function discoverServers() {
  return process.platform === "win32" ? discoverServersWindows() : discoverServersPosix();
}
function postUserStatus(port, csrfToken) {
  return new Promise((resolve) => {
    const request = https.request({
      host: "127.0.0.1",
      port,
      path: RPC_SERVICE_PATH,
      method: "POST",
      rejectUnauthorized: false,
      timeout: RPC_REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        ...csrfToken ? { "X-Codeium-Csrf-Token": csrfToken } : {}
      }
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    request.on("error", () => resolve(null));
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.end("{}");
  });
}
function parseAvailableCredits(userStatus) {
  const list = userStatus?.userTier?.availableCredits;
  if (!Array.isArray(list) || list.length === 0)
    return null;
  let total = 0;
  let found = false;
  let minForUsage = null;
  const types = /* @__PURE__ */ new Set();
  for (const entry of list) {
    const amount = Number(entry?.creditAmount);
    if (Number.isFinite(amount)) {
      total += amount;
      found = true;
      if (entry?.creditType)
        types.add(String(entry.creditType));
    }
    const floor = Number(entry?.minimumCreditAmountForUsage);
    if (Number.isFinite(floor))
      minForUsage = minForUsage == null ? floor : Math.min(minForUsage, floor);
  }
  if (!found)
    return null;
  return { amount: total, type: types.size === 1 ? [...types][0] : null, minForUsage };
}
function parseAntigravityUserStatus(response, defaultModel) {
  const userStatus = response?.userStatus;
  const configs = userStatus?.cascadeModelConfigData?.clientModelConfigs;
  const credits = parseAvailableCredits(userStatus);
  if (!Array.isArray(configs) || configs.length === 0) {
    if (credits) {
      return {
        model: defaultModel ?? "antigravity",
        usedPercent: null,
        resetAt: null,
        modelCount: null,
        buckets: [],
        credits
      };
    }
    return null;
  }
  const buckets = configs.map((config) => ({
    modelId: config.modelName ?? config.model ?? config.label,
    // remainingFraction may be omitted for some entries; treat as unknown
    // instead of rendering a false 100%-used state.
    usedPercent: typeof config.quotaInfo?.remainingFraction === "number" ? Math.round((1 - config.quotaInfo.remainingFraction) * 100) : null,
    resetAt: config.quotaInfo?.resetTime ?? null
  }));
  const activeBucket = buckets.find((bucket) => defaultModel && bucket.modelId === defaultModel) ?? buckets.find((bucket) => bucket.usedPercent !== null) ?? buckets[0];
  return {
    model: defaultModel ?? activeBucket?.modelId ?? "antigravity",
    usedPercent: activeBucket?.usedPercent ?? null,
    resetAt: activeBucket?.resetAt ?? null,
    modelCount: buckets.length,
    buckets,
    credits
  };
}
async function fetchQuotaFromLanguageServer(defaultModel) {
  let servers;
  try {
    servers = await discoverServers();
  } catch (err) {
    debugLog("antigravity", "server discovery failed", err);
    return null;
  }
  const probeDeadlineAt = Date.now() + PROBE_DEADLINE_MS;
  for (const server of servers) {
    for (const port of server.ports.slice(0, MAX_PROBE_PORTS)) {
      if (Date.now() >= probeDeadlineAt) {
        debugLog("antigravity", "probe deadline exceeded");
        return null;
      }
      const response = await postUserStatus(port, server.csrfToken);
      if (!response)
        continue;
      const parsed = parseAntigravityUserStatus(response, defaultModel);
      if (parsed) {
        debugLog("antigravity", `quota via language server on port ${port}`);
        return parsed;
      }
    }
  }
  return null;
}
async function collectAntigravityUsage() {
  const settingsModel = await readSettingsModel();
  const quota = await fetchQuotaFromLanguageServer(settingsModel);
  if (quota)
    return quota;
  if (settingsModel) {
    return {
      model: settingsModel,
      usedPercent: null,
      resetAt: null,
      modelCount: null,
      buckets: []
    };
  }
  const executable = await findExecutable(ANTIGRAVITY_EXECUTABLES);
  return executable ? {
    model: "antigravity",
    usedPercent: null,
    resetAt: null,
    modelCount: null,
    buckets: []
  } : null;
}
async function fetchAntigravityUsage(ttlSeconds = 60) {
  return withUsageCache({
    key: ANTIGRAVITY_USAGE_CACHE_KEY,
    cacheFile: ANTIGRAVITY_USAGE_CACHE_FILE,
    ttlSeconds,
    memoryCache: antigravityCacheMap,
    pendingRequests: pendingRequests2,
    debugTag: "antigravity",
    collect: collectAntigravityUsage
  });
}

// scripts/utils/provider.ts
var RESET2 = "\x1B[0m";
var BOLD = "\x1B[1m";
var tc = (r, g, b) => `\x1B[38;2;${r};${g};${b}m`;
var CLAUDE_CORAL = tc(217, 119, 87);
var AGY_BLUE = tc(88, 141, 225);
var AGY_PALETTE = [
  [88, 141, 225],
  [120, 194, 94],
  [233, 140, 55],
  [234, 96, 70]
];
function detectProvider(modelName) {
  return /gemini/i.test(modelName) ? "gemini" : "claude";
}
function providerMark(provider) {
  if (provider === "gemini") {
    return `${BOLD}${AGY_BLUE}\u039B${RESET2}`;
  }
  return `${CLAUDE_CORAL}\u273D${RESET2}`;
}
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}
function gradient(text, stops) {
  const chars = [...text];
  const n = chars.length;
  if (n === 0)
    return "";
  let out = "";
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    const seg = t * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(seg));
    const f = seg - k;
    const c0 = stops[k];
    const c1 = stops[k + 1];
    out += tc(lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)) + chars[i];
  }
  return out + RESET2;
}
function providerName(provider, text) {
  if (provider === "gemini") {
    return gradient(text, AGY_PALETTE);
  }
  return `${CLAUDE_CORAL}${text}${RESET2}`;
}

// scripts/utils/agy-stdin.ts
function isAgyHost(stdin) {
  if (stdin.product === "antigravity")
    return true;
  return detectProvider(stdin.model?.display_name || stdin.model?.id || "") === "gemini";
}
function agyQuotaWindow(stdin, window) {
  const quota = stdin.quota;
  if (!quota)
    return null;
  const family = detectProvider(stdin.model?.display_name || stdin.model?.id || "") === "gemini" ? "gemini" : "3p";
  const w = quota[`${family}-${window}`];
  if (!w || typeof w.remaining_fraction !== "number")
    return null;
  return {
    utilization: Math.max(0, Math.min(100, Math.round((1 - w.remaining_fraction) * 100))),
    resetsAt: typeof w.reset_time === "string" ? w.reset_time : null
  };
}
function summarizeSubagents(stdin) {
  const subs = stdin.subagents;
  if (!Array.isArray(subs) || subs.length === 0)
    return null;
  const running = subs.filter((s) => s && s.status === "running").length;
  return { running, total: subs.length };
}
function summarizeTasks(stdin) {
  const tasks = stdin.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0)
    return null;
  const running = tasks.filter((t) => t && /^running$/i.test(String(t.status ?? ""))).length;
  return { running, total: tasks.length };
}

// scripts/utils/stdin-stream.ts
import { StringDecoder } from "string_decoder";
var MAX_BUFFER_BYTES = 4 * 1024 * 1024;
function freshScan() {
  return { i: 0, depth: 0, inString: false, escaped: false, start: -1 };
}
function scanFrom(buffer, state) {
  for (; state.i < buffer.length; state.i += 1) {
    const ch = buffer[state.i];
    if (state.inString) {
      if (state.escaped)
        state.escaped = false;
      else if (ch === "\\")
        state.escaped = true;
      else if (ch === '"')
        state.inString = false;
      continue;
    }
    if (ch === '"') {
      state.inString = true;
      continue;
    }
    if (ch === "{") {
      if (state.depth === 0)
        state.start = state.i;
      state.depth += 1;
    } else if (ch === "}" && state.depth > 0) {
      state.depth -= 1;
      if (state.depth === 0 && state.start !== -1) {
        const end = state.i + 1;
        const slice = buffer.slice(state.start, end);
        try {
          return { kind: "parsed", value: JSON.parse(slice), end };
        } catch {
          return { kind: "invalid", end };
        }
      }
    }
  }
  return { kind: "incomplete" };
}
async function* streamJsonObjects(stream) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  let state = freshScan();
  function* drain() {
    let r = scanFrom(buffer, state);
    while (r.kind !== "incomplete") {
      const value = r.kind === "parsed" ? r.value : void 0;
      const hasValue = r.kind === "parsed";
      buffer = buffer.slice(r.end);
      state = freshScan();
      if (hasValue)
        yield value;
      r = scanFrom(buffer, state);
    }
  }
  for await (const chunk of stream) {
    buffer += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (buffer.length > MAX_BUFFER_BYTES) {
      buffer = "";
      state = freshScan();
      continue;
    }
    yield* drain();
  }
  buffer += decoder.end();
  yield* drain();
}

// scripts/utils/normalize-stdin.ts
function normalizeModel(model) {
  if (typeof model === "string") {
    return { id: model, display_name: model };
  }
  if (model && typeof model === "object") {
    const m = model;
    const id = typeof m.id === "string" ? m.id : "";
    const displayName = typeof m.display_name === "string" ? m.display_name : id || "-";
    return { id, display_name: displayName };
  }
  return { id: "", display_name: "-" };
}
function normalizeWorkspace(r) {
  if (r.workspace && typeof r.workspace === "object") {
    return r.workspace;
  }
  if (typeof r.cwd === "string") {
    return { current_dir: r.cwd, project_dir: r.cwd };
  }
  return { current_dir: "" };
}
function normalizeContextWindow(cw) {
  if (!cw || typeof cw !== "object") {
    return {
      total_input_tokens: 0,
      total_output_tokens: 0,
      context_window_size: 2e5,
      current_usage: null
    };
  }
  const c = cw;
  if (c.current_usage != null) {
    return c;
  }
  const remaining = typeof c.remaining_percentage === "number" ? c.remaining_percentage : null;
  const usedPercentage = remaining != null ? Math.max(0, Math.min(100, Math.round(100 - remaining))) : typeof c.used_percentage === "number" ? c.used_percentage : null;
  const inputTokens = typeof c.total_input_tokens === "number" ? c.total_input_tokens : 0;
  const outputTokens = typeof c.total_output_tokens === "number" ? c.total_output_tokens : 0;
  let contextSize = typeof c.context_window_size === "number" ? c.context_window_size : null;
  if (contextSize == null && usedPercentage != null && usedPercentage > 0 && inputTokens > 0) {
    contextSize = Math.round(inputTokens / (usedPercentage / 100));
  }
  return {
    ...c,
    total_input_tokens: inputTokens,
    total_output_tokens: outputTokens,
    context_window_size: contextSize ?? 2e5,
    used_percentage: usedPercentage,
    current_usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }
  };
}
function normalizeStdin(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const r = raw;
  return {
    ...r,
    model: normalizeModel(r.model),
    workspace: normalizeWorkspace(r),
    context_window: normalizeContextWindow(r.context_window),
    session_id: r.session_id ?? r.conversation_id
  };
}

// locales/en.json
var en_default = {
  labels: {
    "5h": "5h",
    "7d_all": "7d",
    "7d_sonnet": "7d-S",
    "7d_fable": "7d-F",
    extra: "extra",
    credits: "credits"
  },
  time: {
    days: "d",
    hours: "h",
    minutes: "m"
  },
  widgets: {
    tools: "Tools",
    done: "done",
    running: "running",
    agent: "Agent",
    todos: "Tasks",
    claudeMd: "CLAUDE.md",
    agentsMd: "AGENTS.md",
    addedDirs: "+Dirs",
    rules: "Rules",
    mcps: "MCP",
    hooks: "Hooks",
    todayCost: "Today",
    apiDuration: "API",
    working: "working",
    subagents: "subagent",
    bgTask: "task"
  }
};

// scripts/utils/i18n.ts
var TRANSLATIONS = en_default;
function getTranslations() {
  return TRANSLATIONS;
}

// scripts/utils/width.ts
var OSC8_RE = /\x1b\]8;;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
var SGR_RE = /\x1b\[[0-9;]*m/g;
function stripAnsi(value) {
  return value.replace(OSC8_RE, "").replace(SGR_RE, "");
}
function isZeroWidth(cp) {
  return cp >= 768 && cp <= 879 || // combining diacritical marks
  cp >= 8203 && cp <= 8207 || // zero-width space..RLM
  cp === 8232 || cp === 8233 || // line/paragraph separators
  cp >= 65024 && cp <= 65039 || // variation selectors (incl. VS16)
  cp === 65279;
}
function isWide(cp) {
  return cp >= 4352 && cp <= 4447 || // Hangul Jamo
  cp >= 11904 && cp <= 12350 || // CJK radicals .. punctuation
  cp >= 12353 && cp <= 13311 || // Hiragana .. CJK compat
  cp >= 13312 && cp <= 19903 || // CJK Ext A
  cp >= 19968 && cp <= 40959 || // CJK Unified
  cp >= 40960 && cp <= 42191 || // Yi
  cp >= 44032 && cp <= 55203 || // Hangul syllables
  cp >= 63744 && cp <= 64255 || // CJK compat ideographs
  cp >= 65040 && cp <= 65049 || // vertical forms
  cp >= 65072 && cp <= 65135 || // CJK compat forms + small forms
  cp >= 65280 && cp <= 65376 || // fullwidth forms
  cp >= 65504 && cp <= 65510 || // fullwidth signs
  cp >= 126976 && cp <= 129791 || // emoji + symbols & pictographs
  cp >= 131072 && cp <= 262141;
}
function displayWidth(value) {
  const plain = stripAnsi(value);
  let width = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0);
    if (cp === void 0 || isZeroWidth(cp))
      continue;
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}
function wrapSegments(segments, separator, maxWidth) {
  if (segments.length === 0)
    return [];
  const sepWidth = displayWidth(separator);
  const lines = [];
  let current = [];
  let currentWidth = 0;
  for (const segment of segments) {
    const segWidth = displayWidth(segment);
    if (current.length === 0) {
      current = [segment];
      currentWidth = segWidth;
      continue;
    }
    if (currentWidth + sepWidth + segWidth > maxWidth) {
      lines.push(current.join(separator));
      current = [segment];
      currentWidth = segWidth;
    } else {
      current.push(segment);
      currentWidth += sepWidth + segWidth;
    }
  }
  if (current.length > 0)
    lines.push(current.join(separator));
  return lines;
}

// scripts/widgets/model.ts
import { readFile as readFile4, stat as stat4 } from "fs/promises";
import { join as join3 } from "path";
import { homedir as homedir2 } from "os";

// scripts/utils/formatters.ts
function formatTokens(tokens) {
  if (tokens >= 1e6) {
    const value = tokens / 1e6;
    return value >= 10 ? `${Math.round(value)}M` : `${value.toFixed(1)}M`;
  }
  if (tokens >= 1e3) {
    const value = tokens / 1e3;
    return value >= 10 ? `${Math.round(value)}K` : `${value.toFixed(1)}K`;
  }
  return String(tokens);
}
function formatCost(cost) {
  return `$${cost.toFixed(2)}`;
}
function formatTimeRemaining(resetAt, t) {
  const reset = typeof resetAt === "string" ? new Date(resetAt) : resetAt;
  if (Number.isNaN(reset.getTime()))
    return `0${t.time.minutes}`;
  const now = /* @__PURE__ */ new Date();
  const diffMs = reset.getTime() - now.getTime();
  if (diffMs <= 0)
    return `0${t.time.minutes}`;
  const totalMinutes = Math.floor(diffMs / (1e3 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}${t.time.days}${hours}${t.time.hours}`;
  }
  if (hours > 0) {
    return `${hours}${t.time.hours}${minutes}${t.time.minutes}`;
  }
  return `${minutes}${t.time.minutes}`;
}
var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function formatResetClock(resetAt) {
  const reset = typeof resetAt === "string" ? new Date(resetAt) : resetAt;
  if (Number.isNaN(reset.getTime()))
    return typeof resetAt === "string" ? resetAt : "";
  const hh = String(reset.getHours()).padStart(2, "0");
  const mm = String(reset.getMinutes()).padStart(2, "0");
  const now = /* @__PURE__ */ new Date();
  const sameDay = reset.getFullYear() === now.getFullYear() && reset.getMonth() === now.getMonth() && reset.getDate() === now.getDate();
  return sameDay ? `${hh}:${mm}` : `${WEEKDAYS[reset.getDay()]} ${hh}:${mm}`;
}
function formatResetDisplay(resetAt, mode, t) {
  if (mode === "resetTime")
    return formatResetClock(resetAt);
  const remaining = formatTimeRemaining(resetAt, t);
  if (mode === "both")
    return `${remaining}, ${formatResetClock(resetAt)}`;
  return remaining;
}
function renderUsageWindow(label, utilization, resetsAt, resetMode, t) {
  const colored = `${label}: ${colorize(`${utilization}%`, getColorForPercent(utilization))}`;
  if (!resetsAt)
    return colored;
  return `${colored} (${formatResetDisplay(resetsAt, resetMode ?? "remaining", t)})`;
}
function shortenModelName(displayName) {
  const lower = displayName.toLowerCase();
  if (lower.includes("opus"))
    return "Opus";
  if (lower.includes("sonnet"))
    return "Sonnet";
  if (lower.includes("haiku"))
    return "Haiku";
  if (lower.includes("fable"))
    return "Fable";
  const parts = displayName.split(/\s+/);
  if (parts.length > 1 && parts[0].toLowerCase() === "claude") {
    return parts[1];
  }
  return displayName;
}
function calculatePercent(current, total) {
  if (total <= 0)
    return 0;
  return Math.min(100, Math.round(current / total * 100));
}
function formatDuration(ms, t) {
  if (ms <= 0)
    return `0${t.minutes}`;
  const totalMinutes = Math.floor(ms / (1e3 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}${t.hours}${minutes}${t.minutes}`;
  }
  if (hours > 0) {
    return `${hours}${t.hours}`;
  }
  return `${minutes}${t.minutes}`;
}
function sanitizeText(value) {
  return value.replace(/[\t\n\r]+/g, " ").replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}
function truncate(str, maxLen) {
  const clean = sanitizeText(str);
  const chars = Array.from(clean);
  return chars.length <= maxLen ? clean : chars.slice(0, maxLen).join("") + "\u2026";
}
function osc8Link(url, text) {
  return `\x1B]8;;${sanitizeText(url)}\x1B\\${text}\x1B]8;;\x1B\\`;
}

// scripts/widgets/model.ts
var EFFORT_LEVELS = /* @__PURE__ */ new Set(["xhigh", "high", "medium", "low"]);
function isEffortLevel(value) {
  return typeof value === "string" && EFFORT_LEVELS.has(value);
}
var EFFORT_BADGE = {
  xhigh: "xH",
  high: "H",
  medium: "M",
  low: "L"
};
function supportsXhigh(shortName, modelId) {
  if (shortName === "Opus" || shortName === "Fable")
    return true;
  if (shortName === "Sonnet") {
    const major = modelId.match(/claude-sonnet-(\d+)/)?.[1];
    return major !== void 0 && parseInt(major, 10) >= 5;
  }
  return false;
}
function effectiveEffort(shortName, effort, modelId) {
  if (effort === "xhigh" && !supportsXhigh(shortName, modelId))
    return "high";
  return effort;
}
function compactGeminiName(displayName) {
  const match = displayName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const level = match[2].trim().toLowerCase();
    if (isEffortLevel(level))
      return { name: match[1].trim(), badge: `(${EFFORT_BADGE[level]})` };
  }
  return { name: displayName, badge: "" };
}
function getDefaultEffort(modelId) {
  if (modelId.includes("opus"))
    return "xhigh";
  if (modelId.includes("fable"))
    return "xhigh";
  if (modelId.includes("sonnet"))
    return "medium";
  return "high";
}
var settingsCache = null;
async function getModelSettings(modelId) {
  const defaultEffort = getDefaultEffort(modelId);
  const settingsPath = join3(homedir2(), ".claude", "settings.json");
  try {
    const fileStat = await stat4(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return {
        effortLevel: isEffortLevel(settingsCache.rawEffort) ? settingsCache.rawEffort : defaultEffort,
        fastMode: settingsCache.fastMode
      };
    }
    const content = await readFile4(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    const rawEffort = settings.effortLevel;
    const fastMode = settings.fastMode === true;
    settingsCache = { mtime: fileStat.mtimeMs, rawEffort, fastMode };
    return {
      effortLevel: isEffortLevel(rawEffort) ? rawEffort : defaultEffort,
      fastMode
    };
  } catch {
    settingsCache = null;
  }
  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return { effortLevel: envEffort, fastMode: false };
  }
  return { effortLevel: defaultEffort, fastMode: false };
}
var modelWidget = {
  id: "model",
  name: "Model",
  async getData(ctx) {
    const { model } = ctx.stdin;
    const modelId = model?.id || "";
    const displayName = sanitizeText(model?.display_name || "-") || "-";
    if (isAgyHost(ctx.stdin)) {
      return { id: modelId, displayName, effortLevel: "high", fastMode: false };
    }
    const { effortLevel, fastMode } = await getModelSettings(modelId);
    return {
      id: modelId,
      displayName,
      effortLevel,
      fastMode
    };
  },
  render(data, ctx) {
    const styleProvider = isAgyHost(ctx.stdin) ? "gemini" : "claude";
    const mark = providerMark(styleProvider);
    if (styleProvider === "gemini") {
      const { name, badge } = compactGeminiName(data.displayName);
      const shortName2 = shortenModelName(name);
      return `${mark} ${providerName("gemini", badge ? `${shortName2} ${badge}` : shortName2)}`;
    }
    const shortName = shortenModelName(data.displayName);
    const supportsEffort = shortName === "Opus" || shortName === "Sonnet" || shortName === "Fable";
    const effortSuffix = supportsEffort ? ` (${EFFORT_BADGE[effectiveEffort(shortName, data.effortLevel, data.id)]})` : "";
    const fastIndicator = shortName === "Opus" && data.fastMode ? " \u21AF" : "";
    return `${mark} ${providerName("claude", `${shortName}${effortSuffix}${fastIndicator}`)}`;
  }
};

// scripts/utils/progress-bar.ts
var DEFAULT_PROGRESS_BAR_CONFIG = {
  width: 10,
  filledChar: "\u2588",
  // █ (full block)
  emptyChar: "\u2591"
  // ░ (light shade)
};
function renderProgressBar(percent, config = DEFAULT_PROGRESS_BAR_CONFIG) {
  const { width, filledChar, emptyChar } = config;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round(clampedPercent / 100 * width);
  const empty = width - filled;
  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
  const color = getColorForPercent(clampedPercent);
  return `${color}${bar}${RESET}`;
}

// scripts/widgets/context.ts
function num(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function hasOfficialPercent(value) {
  return typeof value === "number" && Number.isFinite(value);
}
async function getContextData(ctx) {
  const { context_window } = ctx.stdin;
  const usage = context_window?.current_usage;
  const contextSize = num(context_window?.context_window_size) || 2e5;
  const officialPercent = context_window?.used_percentage;
  if (!usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextSize,
      percentage: hasOfficialPercent(officialPercent) ? Math.round(officialPercent) : 0
    };
  }
  const inputTokens = num(usage.input_tokens) + num(usage.cache_creation_input_tokens) + num(usage.cache_read_input_tokens);
  const outputTokens = num(usage.output_tokens);
  const totalTokens = inputTokens + outputTokens;
  const percentage = hasOfficialPercent(officialPercent) ? Math.round(officialPercent) : calculatePercent(inputTokens, contextSize);
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    contextSize,
    percentage
  };
}
function renderBar(data) {
  return renderProgressBar(data.percentage);
}
function renderPercentage(data) {
  return colorize(`${data.percentage}%`, getColorForPercent(data.percentage));
}
function renderUsage(data) {
  return `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`;
}
var contextWidget = {
  id: "context",
  name: "Context",
  getData: getContextData,
  render(data) {
    return [renderBar(data), renderPercentage(data), renderUsage(data)].join(getSeparator());
  }
};
var contextBarWidget = {
  id: "contextBar",
  name: "Context (Bar)",
  getData: getContextData,
  render: renderBar
};
var contextPercentageWidget = {
  id: "contextPercentage",
  name: "Context (Percentage)",
  getData: getContextData,
  render: renderPercentage
};
var contextUsageWidget = {
  id: "contextUsage",
  name: "Context (Usage)",
  getData: getContextData,
  render: renderUsage
};

// scripts/widgets/cost.ts
var costWidget = {
  id: "cost",
  name: "Cost",
  async getData(ctx) {
    if (isAgyHost(ctx.stdin))
      return null;
    if (!ctx.isApiAccount)
      return null;
    const { cost } = ctx.stdin;
    return {
      totalCostUsd: cost?.total_cost_usd ?? 0
    };
  },
  render(data) {
    return colorize(formatCost(data.totalCostUsd), getTheme().accent);
  }
};

// scripts/widgets/extra-usage.ts
function formatAmount(amount, currency) {
  if (!currency || currency.toUpperCase() === "USD")
    return formatCost(amount);
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}
var extraUsageWidget = {
  id: "extraUsage",
  name: "Extra Usage",
  async getData(ctx) {
    if (isAgyHost(ctx.stdin))
      return null;
    if (ctx.isApiAccount)
      return null;
    const xu = ctx.rateLimits?.extra_usage;
    if (!xu || !xu.is_enabled || xu.monthly_limit == null)
      return null;
    const usedCredits = xu.used_credits ?? 0;
    const utilization = typeof xu.utilization === "number" ? Math.round(xu.utilization) : xu.monthly_limit > 0 ? Math.round(usedCredits / xu.monthly_limit * 100) : 0;
    return { usedCredits, monthlyLimit: xu.monthly_limit, currency: xu.currency, utilization };
  },
  render(data, ctx) {
    const used = formatAmount(data.usedCredits, data.currency);
    const limit = data.monthlyLimit != null ? `/${formatAmount(data.monthlyLimit, data.currency)}` : "";
    const label = ctx.translations.labels.extra;
    return `${label} ${colorize(`${used}${limit}`, getColorForPercent(data.utilization))}`;
  }
};

// scripts/widgets/rate-limit.ts
function isAnthropicHost(ctx) {
  return !isAgyHost(ctx.stdin) && !ctx.isApiAccount;
}
function renderRateLimit(data, ctx, labelKey) {
  if (data.isError) {
    return colorize(ICON.warning, getTheme().warning);
  }
  return renderUsageWindow(
    ctx.translations.labels[labelKey],
    data.utilization,
    data.resetsAt,
    ctx.config.rateLimitResetDisplay,
    ctx.translations
  );
}
function getLimitData(limits, key) {
  const limit = limits?.[key];
  if (!limit)
    return null;
  return {
    utilization: Math.round(limit.utilization),
    resetsAt: limit.resets_at
  };
}
var rateLimit5hWidget = {
  id: "rateLimit5h",
  name: "5h Rate Limit",
  async getData(ctx) {
    if (!isAnthropicHost(ctx))
      return null;
    const data = getLimitData(ctx.rateLimits, "five_hour");
    return data ?? { utilization: 0, resetsAt: null, isError: true };
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "5h");
  }
};
var rateLimit7dWidget = {
  id: "rateLimit7d",
  name: "7d Rate Limit",
  async getData(ctx) {
    if (!isAnthropicHost(ctx))
      return null;
    return getLimitData(ctx.rateLimits, "seven_day");
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "7d_all");
  }
};
var rateLimit7dSonnetWidget = {
  id: "rateLimit7dSonnet",
  name: "7d Sonnet Rate Limit",
  async getData(ctx) {
    if (!isAnthropicHost(ctx))
      return null;
    return getLimitData(ctx.rateLimits, "seven_day_sonnet");
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "7d_sonnet");
  }
};
var rateLimit7dFableWidget = {
  id: "rateLimit7dFable",
  name: "7d Fable Rate Limit",
  async getData(ctx) {
    if (!isAnthropicHost(ctx))
      return null;
    return getLimitData(ctx.rateLimits, "seven_day_fable");
  },
  render(data, ctx) {
    return renderRateLimit(data, ctx, "7d_fable");
  }
};

// scripts/widgets/agent-quota.ts
function render(data, ctx, labelKey) {
  return renderUsageWindow(
    ctx.translations.labels[labelKey],
    data.utilization,
    data.resetsAt,
    ctx.config.rateLimitResetDisplay,
    ctx.translations
  );
}
var agentQuotaWidget = {
  id: "agentQuota",
  name: "Antigravity Quota",
  async getData(ctx) {
    if (!isAgyHost(ctx.stdin))
      return null;
    const w = agyQuotaWindow(ctx.stdin, "5h");
    return w ? { utilization: w.utilization, resetsAt: w.resetsAt } : null;
  },
  render(data, ctx) {
    return render(data, ctx, "5h");
  }
};
var agentQuota7dWidget = {
  id: "agentQuota7d",
  name: "Antigravity Quota (7d)",
  async getData(ctx) {
    if (!isAgyHost(ctx.stdin))
      return null;
    const w = agyQuotaWindow(ctx.stdin, "weekly");
    return w ? { utilization: w.utilization, resetsAt: w.resetsAt } : null;
  },
  render(data, ctx) {
    return render(data, ctx, "7d_all");
  }
};

// scripts/widgets/agent-credits.ts
var DEFAULT_LOW_THRESHOLD = 100;
var agentCreditsWidget = {
  id: "agentCredits",
  name: "Antigravity Credits",
  async getData(ctx) {
    if (!isAgyHost(ctx.stdin))
      return null;
    const credits = ctx.antigravityUsage?.credits;
    if (!credits || !(credits.amount > 0))
      return null;
    const minForUsage = typeof credits.minForUsage === "number" ? credits.minForUsage : null;
    const threshold = ctx.config.agentCreditsThreshold ?? (minForUsage != null ? minForUsage * 2 : DEFAULT_LOW_THRESHOLD);
    if (credits.amount > threshold)
      return null;
    return { amount: credits.amount, type: credits.type ?? null };
  },
  render(data, ctx) {
    const isDollar = /usd|dollar|\$/i.test(data.type ?? "");
    const value = `${data.amount.toLocaleString("en-US")}${isDollar ? "$" : ""}`;
    return `${ctx.translations.labels.credits}: ${colorize(value, getTheme().danger)}`;
  }
};

// scripts/widgets/agent-state.ts
var agentStateWidget = {
  id: "agentState",
  name: "Antigravity State",
  async getData(ctx) {
    if (!isAgyHost(ctx.stdin))
      return null;
    if (ctx.stdin.agent_state !== "working")
      return null;
    return { state: "working" };
  },
  render(_data, ctx) {
    return `${ICON.gear} ${colorize(ctx.translations.widgets.working, getTheme().info)}`;
  }
};

// scripts/widgets/agent-subagents.ts
var agentSubagentsWidget = {
  id: "agentSubagents",
  name: "Antigravity Subagents",
  async getData(ctx) {
    if (!isAgyHost(ctx.stdin))
      return null;
    const s = summarizeSubagents(ctx.stdin);
    if (!s || s.running === 0)
      return null;
    return s;
  },
  render(data, ctx) {
    const text = `${data.running} ${ctx.translations.widgets.subagents}`;
    return `${ICON.robot} ${colorize(text, getTheme().info)}`;
  }
};

// scripts/widgets/agent-tasks.ts
var agentTasksWidget = {
  id: "agentTasks",
  name: "Antigravity Tasks",
  async getData(ctx) {
    if (!isAgyHost(ctx.stdin))
      return null;
    const t = summarizeTasks(ctx.stdin);
    if (!t || t.running === 0)
      return null;
    return t;
  },
  render(data, ctx) {
    const text = `${data.running} ${ctx.translations.widgets.bgTask}`;
    return `${ICON.package} ${colorize(text, getTheme().info)}`;
  }
};

// scripts/widgets/project-info.ts
import path4 from "path";

// scripts/utils/git.ts
import { execFile as execFile4 } from "child_process";
import { readFile as readFile5, stat as stat5 } from "fs/promises";
import { join as join4 } from "path";
var UNTRACKED_MAX_FILES = 1e3;
var UNTRACKED_MAX_FILE_BYTES = 2 * 1024 * 1024;
var UNTRACKED_READ_CONCURRENCY = 16;
function execGit(args, cwd, timeout) {
  return new Promise((resolve, reject) => {
    execFile4("git", ["--no-optional-locks", ...args], {
      cwd,
      encoding: "utf-8",
      timeout,
      maxBuffer: 16 * 1024 * 1024
    }, (error, stdout) => {
      if (error)
        reject(error);
      else
        resolve(stdout);
    });
  });
}
async function countUntrackedLines(cwd, timeout) {
  try {
    const out = await execGit(["ls-files", "--others", "--exclude-standard", "-z"], cwd, timeout);
    const files = out.split("\0").filter(Boolean).slice(0, UNTRACKED_MAX_FILES);
    let total = 0;
    for (let i = 0; i < files.length; i += UNTRACKED_READ_CONCURRENCY) {
      const batch = files.slice(i, i + UNTRACKED_READ_CONCURRENCY);
      const counts = await Promise.all(
        batch.map(async (file) => {
          try {
            const full = join4(cwd, file);
            const st = await stat5(full);
            if (!st.isFile() || st.size > UNTRACKED_MAX_FILE_BYTES)
              return 0;
            const content = await readFile5(full, "utf-8");
            return content.split("\n").length - 1;
          } catch {
            return 0;
          }
        })
      );
      total += counts.reduce((a, b) => a + b, 0);
    }
    return total;
  } catch {
    return 0;
  }
}

// scripts/widgets/project-info.ts
var GIT_CACHE_TTL_MS = 5e3;
var gitCache = null;
async function getGitBranch(cwd) {
  try {
    const result = await execGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd, 500);
    return result.trim() || void 0;
  } catch {
    return void 0;
  }
}
async function isGitDirty(cwd) {
  try {
    const result = await execGit(["status", "--porcelain"], cwd, 1e3);
    return result.trim().length > 0;
  } catch {
    return false;
  }
}
async function getAheadBehind(cwd) {
  try {
    const result = await execGit(["rev-list", "--left-right", "--count", "@{u}...HEAD"], cwd, 500);
    const parts = result.trim().split(/\s+/);
    if (parts.length === 2) {
      return {
        behind: parseInt(parts[0], 10) || 0,
        ahead: parseInt(parts[1], 10) || 0
      };
    }
    return null;
  } catch {
    return null;
  }
}
async function getGitRemoteUrl(cwd) {
  try {
    const result = await execGit(["remote", "get-url", "origin"], cwd, 500);
    return normalizeGitUrl(result.trim()) || void 0;
  } catch {
    return void 0;
  }
}
function normalizeGitUrl(url) {
  const sshMatch = url.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?$/);
  if (sshMatch)
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  const httpsMatch = url.match(/^https?:\/\/(?:[^@/]+@)?(.+?)(?:\.git)?$/);
  if (httpsMatch)
    return `https://${httpsMatch[1]}`;
  return null;
}
var GIT_FILE_CACHE_TTL_SECONDS = 5;
async function getSlowGitData(cwd) {
  const cacheFile = fileCachePath(`git-${hashToken(cwd)}.json`);
  const cached = await loadFileCache(cacheFile, GIT_FILE_CACHE_TTL_SECONDS);
  if (cached)
    return cached.data;
  const [branch, ab, remoteUrl] = await Promise.all([
    getGitBranch(cwd),
    getAheadBehind(cwd),
    getGitRemoteUrl(cwd)
  ]);
  const slow = { branch, ab, remoteUrl };
  await saveFileCache(cacheFile, slow);
  return slow;
}
async function getGitData(cwd) {
  if (gitCache && gitCache.cwd === cwd && Date.now() - gitCache.timestamp < GIT_CACHE_TTL_MS) {
    return gitCache.data;
  }
  const dirtyPromise = isGitDirty(cwd);
  const slow = await getSlowGitData(cwd);
  const dirty = await dirtyPromise;
  const data = { branch: slow.branch, dirty, ab: slow.ab, remoteUrl: slow.remoteUrl };
  gitCache = { cwd, data, timestamp: Date.now() };
  return data;
}
var projectInfoWidget = {
  id: "projectInfo",
  name: "Project Info",
  async getData(ctx) {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }
    const projectDir = ctx.stdin.workspace?.project_dir;
    const dirName = sanitizeText(getPathBasename(projectDir || currentDir));
    const rawSubPath = getProjectSubPath(projectDir, currentDir);
    const subPath = rawSubPath ? sanitizeText(rawSubPath) : void 0;
    const worktreeName = ctx.stdin.worktree?.name || void 0;
    const { branch, dirty, ab, remoteUrl } = await getGitData(currentDir);
    let gitBranch;
    let ahead;
    let behind;
    if (branch) {
      const safeBranch = sanitizeText(branch);
      gitBranch = dirty ? `${safeBranch}*` : safeBranch;
      if (ab) {
        ahead = ab.ahead;
        behind = ab.behind;
      }
    }
    return {
      dirName,
      gitBranch,
      ahead,
      behind,
      subPath,
      worktreeName,
      remoteUrl: remoteUrl && branch ? `${remoteUrl}/tree/${branch.split("/").map(encodeURIComponent).join("/")}` : void 0
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const parts = [];
    const dirDisplay = data.subPath ? `${ICON.folder} ${data.dirName} (${data.subPath})` : `${ICON.folder} ${data.dirName}`;
    parts.push(colorize(dirDisplay, theme.folder));
    if (data.gitBranch) {
      let branchStr = data.gitBranch;
      const aheadStr = (data.ahead ?? 0) > 0 ? `\u2191${data.ahead}` : "";
      const behindStr = (data.behind ?? 0) > 0 ? `\u2193${data.behind}` : "";
      const indicators = `${aheadStr}${behindStr}`;
      if (indicators) {
        branchStr += ` ${indicators}`;
      }
      const branchDisplay = data.remoteUrl ? `(${osc8Link(data.remoteUrl, branchStr)})` : `(${branchStr})`;
      parts.push(colorize(branchDisplay, theme.branch));
    }
    if (data.worktreeName) {
      parts.push(colorize(`${ICON.tree} wt:${data.worktreeName}`, theme.info));
    }
    return parts.join(" ");
  }
};
function getProjectSubPath(projectDir, currentDir) {
  if (!projectDir || currentDir === projectDir)
    return void 0;
  const pathApi = getPathApi(projectDir, currentDir);
  const subPath = pathApi.relative(projectDir, currentDir);
  if (!subPath || subPath === ".." || subPath.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(subPath)) {
    return void 0;
  }
  return subPath.split(/[\\/]+/).join("/");
}
function getPathBasename(inputPath) {
  return getPathApi(inputPath).basename(inputPath);
}
function getPathApi(...paths) {
  return paths.some((p) => /^[A-Za-z]:[\\/]/.test(p) || p.includes("\\")) ? path4.win32 : path4;
}

// scripts/widgets/config-counts.ts
import { readdir as readdir2, readFile as readFile6, stat as stat6 } from "fs/promises";
import { homedir as homedir3 } from "os";
import { join as join5 } from "path";
var CONFIG_CACHE_TTL_MS = 3e4;
var EMPTY_FS_COUNTS = { claudeMd: 0, agentsMd: 0, rules: 0, mcps: 0, hooks: 0 };
var configCountsCache = null;
async function countFiles(dir, pattern) {
  try {
    const files = await readdir2(dir);
    if (pattern) {
      return files.filter((f) => pattern.test(f)).length;
    }
    return files.length;
  } catch {
    return 0;
  }
}
async function fileExists(path5) {
  try {
    await stat6(path5);
    return true;
  } catch {
    return false;
  }
}
async function countClaudeMd(projectDir) {
  const [root, nested] = await Promise.all([
    fileExists(join5(projectDir, "CLAUDE.md")),
    fileExists(join5(projectDir, ".claude", "CLAUDE.md"))
  ]);
  return (root ? 1 : 0) + (nested ? 1 : 0);
}
async function countAgentsMd(projectDir) {
  const [root, agentFiles] = await Promise.all([
    fileExists(join5(projectDir, "AGENTS.md")),
    countFiles(join5(projectDir, ".claude", "agents"), /\.md$/)
  ]);
  return (root ? 1 : 0) + agentFiles;
}
async function countMcps(projectDir) {
  const homeDir = homedir3();
  const mcpPaths = [
    { path: join5(projectDir, ".claude", "mcp.json"), key: "mcpServers" },
    { path: join5(homeDir, ".claude.json"), key: "mcpServers" },
    { path: join5(homeDir, ".config", "claude-code", "mcp.json"), key: "mcpServers" }
  ];
  const counts = await Promise.all(
    mcpPaths.map(async ({ path: path5, key }) => {
      try {
        const content = await readFile6(path5, "utf-8");
        const config = JSON.parse(content);
        return Object.keys(config[key] || {}).length;
      } catch {
        return 0;
      }
    })
  );
  return counts.reduce((a, b) => a + b, 0);
}
var configCountsWidget = {
  id: "configCounts",
  name: "Config Counts",
  async getData(ctx) {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }
    const addedDirs = ctx.stdin.workspace?.added_dirs?.length ?? 0;
    if (configCountsCache?.projectDir === currentDir && Date.now() - configCountsCache.timestamp < CONFIG_CACHE_TTL_MS) {
      if (!configCountsCache.data && addedDirs === 0)
        return null;
      const fsData2 = configCountsCache.data ?? EMPTY_FS_COUNTS;
      return { ...fsData2, addedDirs };
    }
    const claudeDir = join5(currentDir, ".claude");
    const [claudeMd, agentsMd, rules, mcps, hooks] = await Promise.all([
      countClaudeMd(currentDir),
      countAgentsMd(currentDir),
      countFiles(join5(claudeDir, "rules")),
      countMcps(currentDir),
      countFiles(join5(claudeDir, "hooks"))
    ]);
    const fsData = claudeMd === 0 && agentsMd === 0 && rules === 0 && mcps === 0 && hooks === 0 ? null : { claudeMd, agentsMd, rules, mcps, hooks };
    configCountsCache = { projectDir: currentDir, data: fsData, timestamp: Date.now() };
    if (!fsData && addedDirs === 0)
      return null;
    return { ...fsData ?? EMPTY_FS_COUNTS, addedDirs };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const parts = [];
    if (data.claudeMd > 0) {
      parts.push(`${t.widgets.claudeMd}: ${data.claudeMd}`);
    }
    if (data.agentsMd > 0) {
      parts.push(`${t.widgets.agentsMd}: ${data.agentsMd}`);
    }
    if (data.rules > 0) {
      parts.push(`${t.widgets.rules}: ${data.rules}`);
    }
    if (data.mcps > 0) {
      parts.push(`${t.widgets.mcps}: ${data.mcps}`);
    }
    if (data.hooks > 0) {
      parts.push(`${t.widgets.hooks}: ${data.hooks}`);
    }
    if (data.addedDirs > 0) {
      parts.push(`${t.widgets.addedDirs}: ${data.addedDirs}`);
    }
    return colorize(parts.join(", "), getTheme().secondary);
  }
};

// scripts/utils/session.ts
import { readFile as readFile7, mkdir as mkdir2, open, readdir as readdir3, unlink as unlink2, stat as stat7 } from "fs/promises";
import { join as join6 } from "path";
import { homedir as homedir4 } from "os";
var SESSION_DIR = join6(homedir4(), ".cache", "agent-statusline", "sessions");
var SESSION_MAX_AGE_SECONDS = 604800;
var CLEANUP_INTERVAL_MS2 = 36e5;
function isErrnoException(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
var lastCleanupTime2 = 0;
var sessionCache = /* @__PURE__ */ new Map();
var pendingRequests3 = /* @__PURE__ */ new Map();
function sanitizeSessionId(sessionId) {
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, "");
}
async function getSessionStartTime(sessionId) {
  const safeSessionId = sanitizeSessionId(sessionId);
  if (sessionCache.has(safeSessionId)) {
    return sessionCache.get(safeSessionId);
  }
  const pending = pendingRequests3.get(safeSessionId);
  if (pending) {
    return pending;
  }
  const promise = getOrCreateSessionStartTimeImpl(safeSessionId);
  pendingRequests3.set(safeSessionId, promise);
  try {
    return await promise;
  } finally {
    pendingRequests3.delete(safeSessionId);
  }
}
async function getOrCreateSessionStartTimeImpl(safeSessionId) {
  const sessionFile = join6(SESSION_DIR, `${safeSessionId}.json`);
  try {
    const content = await readFile7(sessionFile, "utf-8");
    const data = JSON.parse(content);
    if (typeof data.startTime !== "number") {
      debugLog("session", `Invalid session file format for ${safeSessionId}`);
      throw new Error("Invalid session file format");
    }
    sessionCache.set(safeSessionId, data.startTime);
    return data.startTime;
  } catch (error) {
    if (!isErrnoException(error, "ENOENT")) {
      debugLog("session", `Failed to read session ${safeSessionId}`, error);
    }
    const startTime = Date.now();
    try {
      await mkdir2(SESSION_DIR, { recursive: true });
      const fileHandle = await open(sessionFile, "wx");
      try {
        await fileHandle.writeFile(JSON.stringify({ startTime }), "utf-8");
      } finally {
        await fileHandle.close();
      }
      sessionCache.set(safeSessionId, startTime);
      cleanupExpiredSessions().catch(() => {
      });
      return startTime;
    } catch (writeError) {
      if (isErrnoException(writeError, "EEXIST")) {
        try {
          const content = await readFile7(sessionFile, "utf-8");
          const data = JSON.parse(content);
          if (typeof data.startTime === "number") {
            sessionCache.set(safeSessionId, data.startTime);
            return data.startTime;
          }
        } catch {
          debugLog("session", `Failed to read existing session ${safeSessionId} after EEXIST`);
        }
      }
      if (!isErrnoException(writeError, "EEXIST")) {
        debugLog("session", `Failed to persist session ${safeSessionId}`, writeError);
      }
      sessionCache.set(safeSessionId, startTime);
      return startTime;
    }
  }
}
async function getSessionElapsedMs(sessionId) {
  const startTime = await getSessionStartTime(sessionId);
  return Date.now() - startTime;
}
async function getSessionElapsedMinutes(ctx, minMinutes = 1) {
  const sessionId = ctx.stdin.session_id || "default";
  const elapsedMs = await getSessionElapsedMs(sessionId);
  const elapsedMinutes = elapsedMs / (1e3 * 60);
  if (elapsedMinutes < minMinutes)
    return null;
  return elapsedMinutes;
}
async function cleanupExpiredSessions() {
  const now = Date.now();
  if (now - lastCleanupTime2 < CLEANUP_INTERVAL_MS2) {
    return;
  }
  lastCleanupTime2 = now;
  try {
    const files = await readdir3(SESSION_DIR);
    const cutoffTime = now - SESSION_MAX_AGE_SECONDS * 1e3;
    for (const file of files) {
      if (!file.endsWith(".json"))
        continue;
      try {
        const filePath = join6(SESSION_DIR, file);
        const fileStat = await stat7(filePath);
        if (fileStat.mtimeMs < cutoffTime) {
          await unlink2(filePath);
          debugLog("session", `Cleaned up expired session: ${file}`);
        }
      } catch {
      }
    }
  } catch {
  }
}

// scripts/widgets/session-duration.ts
var sessionDurationWidget = {
  id: "sessionDuration",
  name: "Session Duration",
  async getData(ctx) {
    const stdinDuration = ctx.stdin.cost?.total_duration_ms;
    if (typeof stdinDuration === "number" && stdinDuration > 0) {
      return { elapsedMs: stdinDuration };
    }
    const sessionId = ctx.stdin.session_id || "default";
    const elapsedMs = await getSessionElapsedMs(sessionId);
    return { elapsedMs };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const duration = formatDuration(data.elapsedMs, t.time);
    return colorize(`${ICON.stopwatch} ${duration}`, getTheme().secondary);
  }
};

// scripts/utils/transcript-parser.ts
import { open as open2, stat as stat8 } from "fs/promises";
import { basename } from "path";
var cachedTranscript = null;
function createParsedTranscript() {
  return {
    toolUses: /* @__PURE__ */ new Map(),
    completedToolCount: 0,
    runningToolIds: /* @__PURE__ */ new Set(),
    lastTodoWriteInput: null,
    activeAgentIds: /* @__PURE__ */ new Set(),
    completedAgentCount: 0,
    tasks: /* @__PURE__ */ new Map(),
    nextTaskId: 1,
    pendingTaskCreates: /* @__PURE__ */ new Map(),
    pendingTaskUpdates: /* @__PURE__ */ new Map(),
    activeSlashCommand: null
  };
}
var SLASH_COMMAND_TAG_RE = /<command-name>([^<]+)<\/command-name>/;
function parseJsonlContent(content) {
  const entries = [];
  for (const line of content.split("\n")) {
    if (!line)
      continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
    }
  }
  return entries;
}
function processEntries(entries, existing) {
  for (const entry of entries) {
    if (!existing.sessionStartTime && entry.timestamp) {
      existing.sessionStartTime = new Date(entry.timestamp).getTime();
    }
    if (entry.customTitle) {
      existing.sessionName = entry.customTitle;
    }
    if (entry.type === "assistant" && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use" && block.id && block.name) {
          existing.toolUses.set(block.id, {
            name: block.name,
            timestamp: entry.timestamp,
            input: block.input
          });
          existing.runningToolIds.add(block.id);
          if (block.name === "Task") {
            existing.activeAgentIds.add(block.id);
          }
          if (block.name === "TaskCreate") {
            const input = block.input;
            if (input?.subject) {
              const seqId = String(existing.nextTaskId);
              existing.nextTaskId++;
              existing.pendingTaskCreates.set(block.id, {
                subject: input.subject,
                status: normalizeTaskStatus(input.status || "pending"),
                seqId
              });
            }
          } else if (block.name === "TaskUpdate") {
            const input = block.input;
            if (input?.taskId) {
              existing.pendingTaskUpdates.set(block.id, {
                taskId: input.taskId,
                status: input.status,
                subject: input.subject
              });
            }
          }
        }
      }
    }
    if (entry.type === "user" && entry.message?.content !== void 0) {
      const content = entry.message.content;
      let matchedName = null;
      let hasText = false;
      if (typeof content === "string") {
        const m = content.match(SLASH_COMMAND_TAG_RE);
        if (m) {
          const name = m[1].trim();
          if (name.startsWith("/")) {
            matchedName = sanitizeText(name);
            hasText = true;
          }
        } else {
          const trimmed = content.trim();
          if (trimmed.length > 0 && !trimmed.startsWith("<")) {
            hasText = true;
          }
        }
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type !== "text" || typeof block.text !== "string")
            continue;
          hasText = true;
          const m = block.text.match(SLASH_COMMAND_TAG_RE);
          if (m) {
            const name = m[1].trim();
            if (name.startsWith("/"))
              matchedName = sanitizeText(name);
            break;
          }
        }
      }
      if (hasText) {
        existing.activeSlashCommand = matchedName ? {
          name: matchedName,
          startTime: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now()
        } : null;
      }
    }
    if (entry.type === "user" && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          existing.completedToolCount++;
          existing.runningToolIds.delete(block.tool_use_id);
          if (existing.activeAgentIds.delete(block.tool_use_id)) {
            existing.completedAgentCount++;
          }
          const tool = existing.toolUses.get(block.tool_use_id);
          if (tool?.name === "TodoWrite") {
            existing.lastTodoWriteInput = tool.input;
          }
          const pendingCreate = existing.pendingTaskCreates.get(block.tool_use_id);
          if (pendingCreate) {
            existing.tasks.set(pendingCreate.seqId, {
              subject: pendingCreate.subject,
              status: pendingCreate.status
            });
            existing.pendingTaskCreates.delete(block.tool_use_id);
          }
          const pendingUpdate = existing.pendingTaskUpdates.get(block.tool_use_id);
          if (pendingUpdate) {
            const task = existing.tasks.get(pendingUpdate.taskId);
            if (task) {
              if (pendingUpdate.status)
                task.status = normalizeTaskStatus(pendingUpdate.status);
              if (pendingUpdate.subject)
                task.subject = pendingUpdate.subject;
            }
            existing.pendingTaskUpdates.delete(block.tool_use_id);
          }
          existing.toolUses.delete(block.tool_use_id);
        }
      }
    }
  }
}
async function readFromOffset(filePath, offset, fileSize) {
  const bytesToRead = fileSize - offset;
  if (bytesToRead <= 0)
    return "";
  const fd = await open2(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    await fd.read(buffer, 0, bytesToRead, offset);
    return buffer.toString("utf-8");
  } finally {
    await fd.close();
  }
}
var pendingParse = null;
async function parseTranscript(transcriptPath) {
  if (pendingParse && pendingParse.path === transcriptPath) {
    return pendingParse.promise;
  }
  const promise = parseTranscriptUncoalesced(transcriptPath);
  pendingParse = { path: transcriptPath, promise };
  try {
    return await promise;
  } finally {
    if (pendingParse && pendingParse.promise === promise)
      pendingParse = null;
  }
}
async function parseTranscriptUncoalesced(transcriptPath) {
  try {
    const fileStat = await stat8(transcriptPath);
    const fileSize = fileStat.size;
    if (cachedTranscript?.path === transcriptPath && cachedTranscript.size <= fileSize) {
      if (cachedTranscript.size === fileSize) {
        return cachedTranscript.data;
      }
      const newContent = await readFromOffset(transcriptPath, cachedTranscript.size, fileSize);
      processEntries(parseJsonlContent(newContent), cachedTranscript.data);
      cachedTranscript.size = fileSize;
      return cachedTranscript.data;
    }
    const content = await readFromOffset(transcriptPath, 0, fileSize);
    const data = createParsedTranscript();
    processEntries(parseJsonlContent(content), data);
    cachedTranscript = { path: transcriptPath, size: fileSize, data };
    return data;
  } catch {
    return null;
  }
}
function extractToolTarget(name, input) {
  if (!input || typeof input !== "object")
    return void 0;
  const inp = input;
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
      return typeof inp.file_path === "string" ? basename(inp.file_path) : void 0;
    case "Glob":
    case "Grep":
      return typeof inp.pattern === "string" ? truncate(inp.pattern, 20) : void 0;
    case "Bash":
      return typeof inp.command === "string" ? truncate(inp.command, 25) : void 0;
    default:
      return void 0;
  }
}
function getRunningTools(transcript) {
  const running = [];
  for (const id of transcript.runningToolIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool)
      continue;
    const target = extractToolTarget(tool.name, tool.input);
    running.push({
      name: sanitizeText(tool.name),
      startTime: tool.timestamp ? new Date(tool.timestamp).getTime() : Date.now(),
      target: target !== void 0 ? sanitizeText(target) : void 0
    });
  }
  return running;
}
function getCompletedToolCount(transcript) {
  return transcript.completedToolCount;
}
function normalizeTaskStatus(status) {
  switch (status) {
    case "not_started":
      return "pending";
    case "running":
      return "in_progress";
    case "complete":
    case "done":
      return "completed";
    default:
      return status;
  }
}
function extractTodoProgress(transcript) {
  const lastTodoWrite = transcript.lastTodoWriteInput;
  if (!lastTodoWrite || typeof lastTodoWrite !== "object") {
    return null;
  }
  const input = lastTodoWrite;
  if (!Array.isArray(input.todos)) {
    return null;
  }
  const todos = input.todos;
  const completed = todos.filter((t) => normalizeTaskStatus(t.status) === "completed").length;
  const total = todos.length;
  const current = todos.find((t) => {
    const s = normalizeTaskStatus(t.status);
    return s === "in_progress" || s === "pending";
  });
  return {
    current: current ? {
      content: current.content,
      status: normalizeTaskStatus(current.status)
    } : void 0,
    completed,
    total
  };
}
function extractTaskProgress(transcript) {
  if (transcript.tasks.size === 0)
    return null;
  const all = [...transcript.tasks.values()];
  const completed = all.filter((t) => t.status === "completed").length;
  const current = all.find(
    (t) => t.status === "in_progress" || t.status === "pending"
  );
  return {
    current: current ? { content: current.subject, status: current.status } : void 0,
    completed,
    total: all.length
  };
}
function extractTodoOrTaskProgress(transcript) {
  return extractTaskProgress(transcript) ?? extractTodoProgress(transcript);
}
async function getTranscript(ctx) {
  const transcriptPath = ctx.stdin.transcript_path;
  if (!transcriptPath)
    return null;
  return parseTranscript(transcriptPath);
}
function extractAgentStatus(transcript) {
  const active = [];
  for (const id of transcript.activeAgentIds) {
    const tool = transcript.toolUses.get(id);
    if (!tool)
      continue;
    const input = tool.input;
    active.push({
      name: sanitizeText(input?.subagent_type || "Agent"),
      description: input?.description
    });
  }
  return { active, completed: transcript.completedAgentCount };
}
function getActiveSlashCommand(transcript) {
  return transcript.activeSlashCommand;
}

// scripts/widgets/tool-activity.ts
var toolActivityWidget = {
  id: "toolActivity",
  name: "Tool Activity",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    const running = getRunningTools(transcript);
    const completed = getCompletedToolCount(transcript);
    return { running, completed };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    if (data.running.length === 0) {
      return colorize(
        `${t.widgets.tools}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }
    const runningNames = data.running.slice(0, 2).map((r) => r.target ? `${r.name}(${r.target})` : r.name).join(", ");
    const more = data.running.length > 2 ? ` +${data.running.length - 2}` : "";
    return `${colorize(ICON.gear, theme.warning)} ${runningNames}${more} (${data.completed} ${t.widgets.done})`;
  }
};

// scripts/widgets/agent-status.ts
var agentStatusWidget = {
  id: "agentStatus",
  name: "Agent Status",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    const status = extractAgentStatus(transcript);
    if (status.active.length === 0 && status.completed === 0) {
      return null;
    }
    return status;
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    if (data.active.length === 0) {
      return colorize(
        `${t.widgets.agent}: ${data.completed} ${t.widgets.done}`,
        theme.secondary
      );
    }
    const activeAgent = data.active[0];
    const agentText = activeAgent.description ? `${activeAgent.name}: ${truncate(activeAgent.description, 20)}` : activeAgent.name;
    const more = data.active.length > 1 ? ` +${data.active.length - 1}` : "";
    return `${colorize(ICON.robot, theme.info)} ${t.widgets.agent}: ${agentText}${more}`;
  }
};

// scripts/widgets/todo-progress.ts
var todoProgressWidget = {
  id: "todoProgress",
  name: "Todo Progress",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    const progress = extractTodoOrTaskProgress(transcript);
    if (!progress || progress.total === 0)
      return null;
    return progress;
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    const theme = getTheme();
    const percent = calculatePercent(data.completed, data.total);
    const color = getColorForPercent(100 - percent);
    if (data.current) {
      const taskName = truncate(data.current.content, 15);
      return `${colorize("\u2713", theme.safe)} ${taskName} [${data.completed}/${data.total}]`;
    }
    return colorize(
      `${t.widgets.todos}: ${data.completed}/${data.total}`,
      data.completed === data.total ? theme.safe : color
    );
  }
};

// scripts/widgets/burn-rate.ts
var burnRateWidget = {
  id: "burnRate",
  name: "Burn Rate",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    let elapsedMinutes;
    try {
      elapsedMinutes = await getSessionElapsedMinutes(ctx, 0);
    } catch (error) {
      debugLog("burnRate", "Failed to get session elapsed time", error);
      return null;
    }
    if (elapsedMinutes === null)
      return null;
    if (!usage || elapsedMinutes === 0) {
      return { tokensPerMinute: 0 };
    }
    const totalTokens = usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
    if (totalTokens === 0) {
      return { tokensPerMinute: 0 };
    }
    if (elapsedMinutes < 1)
      return { tokensPerMinute: 0 };
    const tokensPerMinute = totalTokens / elapsedMinutes;
    if (!Number.isFinite(tokensPerMinute) || tokensPerMinute < 0) {
      return null;
    }
    return { tokensPerMinute };
  },
  render(data, _ctx) {
    return `${ICON.fire} ${formatTokens(Math.round(data.tokensPerMinute))}/min`;
  }
};

// scripts/widgets/cache-hit.ts
var cacheHitWidget = {
  id: "cacheHit",
  name: "Cache Hit Rate",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage) {
      return { hitPercentage: 0 };
    }
    const cacheRead = usage.cache_read_input_tokens;
    const freshInput = usage.input_tokens;
    const cacheCreation = usage.cache_creation_input_tokens;
    const total = cacheRead + freshInput + cacheCreation;
    if (total === 0) {
      return { hitPercentage: 0 };
    }
    const hitPercentage = Math.min(100, Math.max(0, Math.round(cacheRead / total * 100)));
    return { hitPercentage };
  },
  render(data) {
    const color = getColorForPercent(100 - data.hitPercentage);
    return `${ICON.package} ${colorize(`${data.hitPercentage}%`, color)}`;
  }
};

// scripts/widgets/session-id.ts
async function getSessionIdData(ctx) {
  const sessionId = ctx.stdin.session_id;
  if (!sessionId)
    return null;
  return {
    sessionId,
    shortId: sessionId.slice(0, 8)
  };
}
var sessionIdWidget = {
  id: "sessionId",
  name: "Session ID (Short)",
  getData: getSessionIdData,
  render(data) {
    return colorize(`${ICON.key} ${data.shortId}`, getTheme().secondary);
  }
};
var sessionIdFullWidget = {
  id: "sessionIdFull",
  name: "Session ID (Full)",
  getData: getSessionIdData,
  render(data) {
    return colorize(`${ICON.key} ${data.sessionId}`, getTheme().secondary);
  }
};

// scripts/widgets/token-breakdown.ts
var tokenBreakdownWidget = {
  id: "tokenBreakdown",
  name: "Token Breakdown",
  async getData(ctx) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (!usage)
      return null;
    const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = usage;
    const total = input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens;
    if (total === 0)
      return null;
    return {
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      cacheWriteTokens: cache_creation_input_tokens,
      cacheReadTokens: cache_read_input_tokens
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const parts = [];
    if (data.inputTokens > 0)
      parts.push(`${colorize("In", theme.info)} ${formatTokens(data.inputTokens)}`);
    if (data.outputTokens > 0)
      parts.push(`${colorize("Out", theme.accent)} ${formatTokens(data.outputTokens)}`);
    if (data.cacheWriteTokens > 0)
      parts.push(`${colorize("W", theme.warning)} ${formatTokens(data.cacheWriteTokens)}`);
    if (data.cacheReadTokens > 0)
      parts.push(`${colorize("R", theme.safe)} ${formatTokens(data.cacheReadTokens)}`);
    return `${ICON.chart} ${parts.join(colorize(" \xB7 ", theme.secondary))}`;
  }
};

// scripts/widgets/forecast.ts
var forecastWidget = {
  id: "forecast",
  name: "Cost Forecast",
  async getData(ctx) {
    if (!ctx.isApiAccount)
      return null;
    const totalCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    if (totalCost <= 0)
      return null;
    const elapsedMinutes = await getSessionElapsedMinutes(ctx, 1);
    if (elapsedMinutes === null || elapsedMinutes === 0)
      return null;
    const costPerMinute = totalCost / elapsedMinutes;
    const hourlyCost = costPerMinute * 60;
    if (!Number.isFinite(hourlyCost) || hourlyCost < 0)
      return null;
    return {
      currentCost: totalCost,
      hourlyCost
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    let hourlyColor;
    if (data.hourlyCost > 10) {
      hourlyColor = theme.danger;
    } else if (data.hourlyCost > 5) {
      hourlyColor = theme.warning;
    } else {
      hourlyColor = theme.safe;
    }
    return `${ICON.chartUp} ${colorize(formatCost(data.currentCost), theme.accent)} \u2192 ${colorize(`~${formatCost(data.hourlyCost)}/h`, hourlyColor)}`;
  }
};

// scripts/utils/budget.ts
import { readFile as readFile8, mkdir as mkdir3, writeFile as writeFile2 } from "fs/promises";
import { join as join7 } from "path";
import { homedir as homedir5 } from "os";
var BUDGET_DIR = join7(homedir5(), ".cache", "agent-statusline");
var BUDGET_FILE = join7(BUDGET_DIR, "budget.json");
var budgetCache = null;
var dirEnsured = false;
var pendingRecordDaily = null;
function getToday() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function loadBudgetState() {
  const today = getToday();
  if (budgetCache && budgetCache.date === today) {
    return budgetCache;
  }
  const fresh = { date: today, dailyTotal: 0, sessions: {} };
  try {
    const content = await readFile8(BUDGET_FILE, "utf-8");
    const state = JSON.parse(content);
    if (state.date !== today || !Number.isFinite(state.dailyTotal) || !state.sessions || typeof state.sessions !== "object") {
      return fresh;
    }
    budgetCache = state;
    return state;
  } catch {
    return fresh;
  }
}
async function saveBudgetState(state) {
  try {
    if (!dirEnsured) {
      await mkdir3(BUDGET_DIR, { recursive: true, mode: 448 });
      dirEnsured = true;
    }
    await writeFile2(BUDGET_FILE, JSON.stringify(state), { encoding: "utf-8", mode: 384 });
    budgetCache = state;
  } catch (error) {
    debugLog("budget", "Failed to save budget state", error);
  }
}
async function recordCostAndGetDaily(sessionId, sessionCost) {
  if (pendingRecordDaily)
    return pendingRecordDaily;
  pendingRecordDaily = recordCostAndGetDailyImpl(sessionId, sessionCost);
  try {
    return await pendingRecordDaily;
  } finally {
    pendingRecordDaily = null;
  }
}
async function recordCostAndGetDailyImpl(sessionId, sessionCost) {
  const safeId = sessionId.replace(/[^A-Za-z0-9_.-]/g, "") || "unknown";
  const state = await loadBudgetState();
  if (sessionCost <= 0 && !(safeId in state.sessions)) {
    return state.dailyTotal;
  }
  const lastSeen = state.sessions[safeId] ?? 0;
  const delta = Math.max(0, sessionCost - lastSeen);
  if (delta === 0)
    return state.dailyTotal;
  state.dailyTotal += delta;
  state.sessions[safeId] = sessionCost;
  saveBudgetState(state).catch(() => {
  });
  return state.dailyTotal;
}

// scripts/widgets/budget.ts
var WARNING_THRESHOLD = 0.8;
var DANGER_THRESHOLD = 0.95;
var budgetWidget = {
  id: "budget",
  name: "Budget",
  async getData(ctx) {
    const { dailyBudget } = ctx.config;
    if (!dailyBudget || dailyBudget <= 0)
      return null;
    const sessionCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    const sessionId = ctx.stdin.session_id || "default";
    const dailyTotal = await recordCostAndGetDaily(sessionId, sessionCost);
    return {
      dailyTotal,
      dailyBudget,
      utilization: Math.min(1, dailyTotal / dailyBudget)
    };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const percent = Math.round(data.utilization * 100);
    let color;
    let icon;
    if (data.utilization >= DANGER_THRESHOLD) {
      color = theme.danger;
      icon = ICON.alarm;
    } else if (data.utilization >= WARNING_THRESHOLD) {
      color = theme.warning;
      icon = ICON.warning;
    } else {
      color = theme.safe;
      icon = ICON.banknote;
    }
    return `${icon} ${colorize(`${formatCost(data.dailyTotal)}`, color)} / ${colorize(formatCost(data.dailyBudget), theme.secondary)} ${colorize(`(${percent}%)`, color)}`;
  }
};

// scripts/widgets/version.ts
var versionWidget = {
  id: "version",
  name: "Version",
  async getData(ctx) {
    const version = ctx.stdin.version;
    if (!version)
      return null;
    return { version };
  },
  render(data, _ctx) {
    return colorize(`v${data.version}`, getTheme().dim);
  }
};

// scripts/widgets/lines-changed.ts
var DIFF_CACHE_TTL_MS = 1e4;
var diffCache = null;
var linesChangedWidget = {
  id: "linesChanged",
  name: "Lines Changed",
  async getData(ctx) {
    const cwd = ctx.stdin.workspace?.current_dir;
    if (!cwd)
      return null;
    if (diffCache?.cwd === cwd && Date.now() - diffCache.timestamp < DIFF_CACHE_TTL_MS) {
      return diffCache.data;
    }
    try {
      const [diffOutput, untracked] = await Promise.all([
        execGit(["diff", "HEAD", "--shortstat"], cwd, 1e3),
        countUntrackedLines(cwd, 1e3)
      ]);
      const insertMatch = diffOutput.match(/(\d+) insertion/);
      const deleteMatch = diffOutput.match(/(\d+) deletion/);
      const tracked = insertMatch ? parseInt(insertMatch[1], 10) : 0;
      const removed = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;
      const added = tracked + untracked;
      const data = added === 0 && removed === 0 ? null : { added, removed, untracked };
      diffCache = { cwd, data, timestamp: Date.now() };
      return data;
    } catch {
      diffCache = { cwd, data: null, timestamp: Date.now() };
      return null;
    }
  },
  render(data, _ctx) {
    const theme = getTheme();
    const parts = [];
    if (data.added > 0)
      parts.push(colorize(`+${data.added}`, theme.safe));
    if (data.removed > 0)
      parts.push(colorize(`-${data.removed}`, theme.danger));
    return parts.join(" ");
  }
};

// scripts/widgets/output-style.ts
var outputStyleWidget = {
  id: "outputStyle",
  name: "Output Style",
  async getData(ctx) {
    const name = ctx.stdin.output_style?.name;
    if (!name || name === "default")
      return null;
    return { styleName: name };
  },
  render(data, _ctx) {
    return colorize(data.styleName, getTheme().dim);
  }
};

// scripts/widgets/token-speed.ts
var tokenSpeedWidget = {
  id: "tokenSpeed",
  name: "Token Speed",
  async getData(ctx) {
    const outputTokens = ctx.stdin.context_window?.total_output_tokens;
    const apiDurationMs = ctx.stdin.cost?.total_api_duration_ms;
    if (!outputTokens || !apiDurationMs || apiDurationMs <= 0)
      return null;
    const tokensPerSecond = outputTokens / (apiDurationMs / 1e3);
    if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0)
      return null;
    return { tokensPerSecond };
  },
  render(data, _ctx) {
    return colorize(`${ICON.zap} ${Math.round(data.tokensPerSecond)} tok/s`, getTheme().accent);
  }
};

// scripts/widgets/session-name.ts
var sessionNameWidget = {
  id: "sessionName",
  name: "Session Name",
  async getData(ctx) {
    if (ctx.stdin.session_name)
      return { name: ctx.stdin.session_name };
    const transcript = await getTranscript(ctx);
    if (!transcript?.sessionName)
      return null;
    return { name: transcript.sessionName };
  },
  render(data, _ctx) {
    return colorize(`\xBB ${truncate(data.name, 20)}`, getTheme().secondary);
  }
};

// scripts/widgets/today-cost.ts
var todayCostWidget = {
  id: "todayCost",
  name: "Today Cost",
  async getData(ctx) {
    if (!ctx.isApiAccount)
      return null;
    const sessionCost = ctx.stdin.cost?.total_cost_usd ?? 0;
    const sessionId = ctx.stdin.session_id || "default";
    const dailyTotal = await recordCostAndGetDaily(sessionId, sessionCost);
    if (dailyTotal <= 0)
      return null;
    return { dailyTotal };
  },
  render(data, ctx) {
    const { translations: t } = ctx;
    return colorize(`${ICON.moneyBag} ${t.widgets.todayCost}: ${formatCost(data.dailyTotal)}`, getTheme().secondary);
  }
};

// scripts/utils/history-parser.ts
import { open as open3, stat as stat9 } from "fs/promises";
import { homedir as homedir6 } from "os";
var HISTORY_PATH = `${homedir6()}/.claude/history.jsonl`;
var CHUNK = 16 * 1024;
function resolvePastedText(display, pastedContents) {
  if (!pastedContents)
    return display;
  return display.replace(
    /\[Pasted text #(\d+)[^\]]*\]/g,
    (match, id) => pastedContents[id]?.content ?? match
  );
}
var historyCache = null;
async function getLastUserPrompt(sessionId) {
  try {
    const fileStat = await stat9(HISTORY_PATH);
    if (historyCache && historyCache.fileSize === fileStat.size) {
      const cached = historyCache.results.get(sessionId);
      if (cached !== void 0)
        return cached;
    }
    if (!historyCache || historyCache.fileSize !== fileStat.size) {
      historyCache = { fileSize: fileStat.size, results: /* @__PURE__ */ new Map() };
    }
    const size = Math.min(CHUNK, fileStat.size);
    const fd = await open3(HISTORY_PATH, "r");
    try {
      const buffer = Buffer.alloc(size);
      await fd.read(buffer, 0, size, fileStat.size - size);
      const lines = buffer.toString("utf-8").split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i])
          continue;
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.sessionId === sessionId && entry.display?.trim() && entry.timestamp) {
            const text = resolvePastedText(entry.display, entry.pastedContents);
            const result = {
              // The widget only ever shows ~60 chars; cap before the whitespace
              // collapse so a large pasted block isn't scanned in full.
              text: text.slice(0, 256).replace(/\s+/g, " ").trim(),
              timestamp: entry.timestamp
            };
            historyCache.results.set(sessionId, result);
            return result;
          }
        } catch {
        }
      }
    } finally {
      await fd.close();
    }
    historyCache.results.set(sessionId, null);
  } catch {
  }
  return null;
}

// scripts/widgets/last-prompt.ts
var lastPromptWidget = {
  id: "lastPrompt",
  name: "Last Prompt",
  async getData(ctx) {
    const sessionId = ctx.stdin.session_id;
    if (!sessionId)
      return null;
    return getLastUserPrompt(sessionId);
  },
  render(data, _ctx) {
    const theme = getTheme();
    const timeStr = new Date(data.timestamp).toTimeString().slice(0, 5);
    return `${ICON.speech} ${colorize(timeStr, theme.secondary)} ${truncate(data.text, 60)}`;
  }
};

// scripts/widgets/vim-mode.ts
var vimModeWidget = {
  id: "vimMode",
  name: "Vim Mode",
  async getData(ctx) {
    const mode = ctx.stdin.vim?.mode;
    if (!mode)
      return null;
    return { mode };
  },
  render(data, _ctx) {
    const theme = getTheme();
    const color = data.mode === "INSERT" ? theme.safe : theme.dim;
    return colorize(data.mode, color);
  }
};

// scripts/widgets/api-duration.ts
var apiDurationWidget = {
  id: "apiDuration",
  name: "API Duration",
  async getData(ctx) {
    const totalMs = ctx.stdin.cost?.total_duration_ms;
    const apiMs = ctx.stdin.cost?.total_api_duration_ms;
    if (!totalMs || !apiMs || totalMs <= 0)
      return null;
    const percentage = Math.round(apiMs / totalMs * 100);
    return { percentage: Math.min(percentage, 100) };
  },
  render(data, ctx) {
    const theme = getTheme();
    const color = data.percentage > 70 ? theme.warning : theme.dim;
    return colorize(`${ctx.translations.widgets.apiDuration} ${data.percentage}%`, color);
  }
};

// scripts/widgets/tag-status.ts
var TAG_CACHE_TTL_MS = 3e4;
var tagCache = null;
async function resolveTag(pattern, cwd) {
  try {
    const described = (await execGit(
      ["describe", "--tags", "--abbrev=0", "--match", pattern, "HEAD"],
      cwd,
      500
    )).trim();
    if (!described)
      return null;
    const countStr = (await execGit(["rev-list", "--count", "--end-of-options", `${described}..HEAD`], cwd, 500)).trim();
    const count = parseInt(countStr, 10);
    return { name: described, count: Number.isFinite(count) ? count : 0 };
  } catch {
    return null;
  }
}
var tagStatusWidget = {
  id: "tagStatus",
  name: "Tag Status",
  async getData(ctx) {
    const cwd = ctx.stdin.workspace?.current_dir;
    if (!cwd)
      return null;
    const patterns = ctx.config.tagPatterns ?? ["v*"];
    if (patterns.length === 0)
      return null;
    const key = patterns.join("|");
    if (tagCache?.cwd === cwd && tagCache.key === key && Date.now() - tagCache.timestamp < TAG_CACHE_TTL_MS) {
      return tagCache.data;
    }
    const resolved = await Promise.all(patterns.map((p) => resolveTag(p, cwd)));
    const tags = resolved.filter(
      (r) => r !== null
    );
    const data = tags.length > 0 ? { tags } : null;
    tagCache = { cwd, key, data, timestamp: Date.now() };
    return data;
  },
  render(data, _ctx) {
    const theme = getTheme();
    const icon = colorize(ICON.label, theme.info);
    const parts = data.tags.map(({ name, count }) => {
      const nameColored = colorize(sanitizeText(name), theme.branch);
      if (count === 0)
        return nameColored;
      return `${nameColored}${colorize(`+${count}`, theme.warning)}`;
    });
    return `${icon} ${parts.join(" ")}`;
  }
};

// scripts/widgets/slash-command.ts
var slashCommandWidget = {
  id: "slashCommand",
  name: "Slash Command",
  async getData(ctx) {
    const transcript = await getTranscript(ctx);
    if (!transcript)
      return null;
    return getActiveSlashCommand(transcript);
  },
  render(data, _ctx) {
    return `${colorize(ICON.target, getTheme().warning)} ${data.name}`;
  }
};

// scripts/widgets/agent-mode.ts
var agentModeWidget = {
  id: "agentMode",
  name: "Agent Mode",
  async getData(ctx) {
    const agentName = ctx.stdin.agent?.name?.trim();
    const agentType = ctx.stdin.agent_type?.trim();
    if (!agentName && !agentType)
      return null;
    return {
      agentName: agentName || void 0,
      agentType: agentType || void 0
    };
  },
  render(data) {
    const parts = [];
    if (data.agentName)
      parts.push(`${ICON.person} ${data.agentName}`);
    if (data.agentType)
      parts.push(`${ICON.robot} ${data.agentType}`);
    return parts.join(" \xB7 ");
  }
};

// scripts/widgets/index.ts
var widgetRegistry = /* @__PURE__ */ new Map([
  ["model", modelWidget],
  ["context", contextWidget],
  ["contextBar", contextBarWidget],
  ["contextPercentage", contextPercentageWidget],
  ["contextUsage", contextUsageWidget],
  ["cost", costWidget],
  ["extraUsage", extraUsageWidget],
  ["rateLimit5h", rateLimit5hWidget],
  ["rateLimit7d", rateLimit7dWidget],
  ["rateLimit7dSonnet", rateLimit7dSonnetWidget],
  ["rateLimit7dFable", rateLimit7dFableWidget],
  ["agentQuota", agentQuotaWidget],
  ["agentQuota7d", agentQuota7dWidget],
  ["agentCredits", agentCreditsWidget],
  ["agentState", agentStateWidget],
  ["agentSubagents", agentSubagentsWidget],
  ["agentTasks", agentTasksWidget],
  ["projectInfo", projectInfoWidget],
  ["configCounts", configCountsWidget],
  ["sessionDuration", sessionDurationWidget],
  ["toolActivity", toolActivityWidget],
  ["agentStatus", agentStatusWidget],
  ["todoProgress", todoProgressWidget],
  ["burnRate", burnRateWidget],
  ["cacheHit", cacheHitWidget],
  ["sessionId", sessionIdWidget],
  ["sessionIdFull", sessionIdFullWidget],
  ["tokenBreakdown", tokenBreakdownWidget],
  ["forecast", forecastWidget],
  ["budget", budgetWidget],
  ["version", versionWidget],
  ["linesChanged", linesChangedWidget],
  ["outputStyle", outputStyleWidget],
  ["tokenSpeed", tokenSpeedWidget],
  ["sessionName", sessionNameWidget],
  ["todayCost", todayCostWidget],
  ["lastPrompt", lastPromptWidget],
  ["vimMode", vimModeWidget],
  ["apiDuration", apiDurationWidget],
  ["tagStatus", tagStatusWidget],
  ["slashCommand", slashCommandWidget],
  ["agentMode", agentModeWidget]
]);
function getWidget(id) {
  return widgetRegistry.get(id);
}
function getLines(config) {
  const lines = config.displayMode === "custom" && config.lines ? config.lines : DISPLAY_PRESETS[config.displayMode] || DISPLAY_PRESETS.compact;
  const disabled = config.disabledWidgets;
  if (!disabled || disabled.length === 0) {
    return lines;
  }
  const disabledSet = new Set(disabled);
  return lines.map((line) => line.filter((id) => !disabledSet.has(id))).filter((line) => line.length > 0);
}
async function renderWidget(widgetId, ctx) {
  const widget = getWidget(widgetId);
  if (!widget) {
    return null;
  }
  try {
    const data = await widget.getData(ctx);
    if (!data) {
      return null;
    }
    const output = widget.render(data, ctx);
    return { id: widgetId, output };
  } catch (error) {
    debugLog("widget", `Widget '${widgetId}' failed`, error);
    return null;
  }
}
async function renderLineSegments(widgetIds, ctx) {
  const results = await Promise.all(
    widgetIds.map((id) => renderWidget(id, ctx))
  );
  return results.filter((r) => r !== null && r.output.length > 0).map((r) => r.output);
}
function resolveWrapWidth(config, stdin) {
  if (typeof config.maxWidth === "number" && config.maxWidth > 0)
    return config.maxWidth;
  if (typeof stdin.terminal_width === "number" && stdin.terminal_width > 0)
    return stdin.terminal_width;
  const cols = process.stdout.columns;
  if (typeof cols === "number" && cols > 0)
    return cols;
  const envCols = Number(process.env.COLUMNS);
  if (Number.isFinite(envCols) && envCols > 0)
    return envCols;
  return 80;
}
async function renderAllLines(ctx) {
  const lines = getLines(ctx.config);
  const separator = getSeparator();
  const perLineSegments = await Promise.all(
    lines.map((lineWidgets) => renderLineSegments(lineWidgets, ctx))
  );
  const wrapWidth = ctx.config.autoWrap ? resolveWrapWidth(ctx.config, ctx.stdin) : null;
  const output = [];
  for (const segments of perLineSegments) {
    if (segments.length === 0)
      continue;
    if (wrapWidth !== null) {
      output.push(...wrapSegments(segments, separator, wrapWidth));
    } else {
      output.push(segments.join(separator));
    }
  }
  return output;
}
async function formatOutput(ctx) {
  const lines = await renderAllLines(ctx);
  return lines.join("\n");
}

// scripts/render-loop.ts
async function runRenderLoop(stream, render2, write) {
  let rendered = false;
  for await (const raw of stream) {
    try {
      const output = await render2(raw);
      write(`${output}
`);
    } catch (err) {
      debugLog("statusline", "render frame failed", err);
      write(`${colorize(ICON.warning, COLORS.yellow)}
`);
    }
    rendered = true;
  }
  if (!rendered) {
    write(`${colorize(ICON.warning, COLORS.yellow)}
`);
  }
}

// scripts/statusline.ts
function configPathFor(provider) {
  if (process.env.AGENT_STATUSLINE_CONFIG)
    return process.env.AGENT_STATUSLINE_CONFIG;
  if (provider === "gemini") {
    return join8(homedir7(), ".gemini", "antigravity-cli", "agent-statusline.local.json");
  }
  return join8(homedir7(), ".claude", "agent-statusline.local.json");
}
var configCache = null;
async function loadConfig(configPath) {
  try {
    const fileStat = await stat10(configPath);
    const mtime = fileStat.mtimeMs;
    if (configCache?.path === configPath && configCache.mtime === mtime) {
      return configCache.config;
    }
    const content = await readFile9(configPath, "utf-8");
    const userConfig = JSON.parse(content);
    const config = {
      ...DEFAULT_CONFIG,
      ...userConfig
    };
    if (config.preset) {
      const lines = parsePreset(config.preset);
      if (lines.length > 0) {
        config.displayMode = "custom";
        config.lines = lines;
      }
    }
    configCache = { path: configPath, config, mtime };
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}
function convertStdinLimit(window) {
  return {
    utilization: window.used_percentage,
    resets_at: new Date(window.resets_at * 1e3).toISOString()
  };
}
function parseStdinRateLimits(stdin) {
  const rl = stdin.rate_limits;
  if (!rl)
    return null;
  return {
    five_hour: rl.five_hour ? convertStdinLimit(rl.five_hour) : null,
    seven_day: rl.seven_day ? convertStdinLimit(rl.seven_day) : null,
    seven_day_sonnet: null,
    // Not available in stdin
    seven_day_fable: null
    // Not available in stdin
  };
}
async function resolveAnthropicLimits(stdin, config) {
  const stdinLimits = parseStdinRateLimits(stdin);
  if (!stdinLimits) {
    return fetchUsageLimits(config.cache.ttlSeconds);
  }
  const needsApi = getLines(config).some(
    (line) => line.includes("rateLimit7dSonnet") || line.includes("rateLimit7dFable") || line.includes("extraUsage")
  );
  if (needsApi) {
    const apiLimits = await fetchUsageLimits(config.cache.ttlSeconds);
    return {
      ...stdinLimits,
      seven_day_sonnet: apiLimits?.seven_day_sonnet ?? null,
      seven_day_fable: apiLimits?.seven_day_fable ?? null,
      extra_usage: apiLimits?.extra_usage ?? null
    };
  }
  return stdinLimits;
}
async function renderFromRaw(raw) {
  const stdin = normalizeStdin(raw);
  if (!stdin) {
    return colorize(ICON.warning, COLORS.yellow);
  }
  const agy = isAgyHost(stdin);
  const config = await loadConfig(configPathFor(agy ? "gemini" : "claude"));
  setTheme(config.theme);
  setSeparatorStyle(config.separator);
  const translations = getTranslations();
  let rateLimits = null;
  let antigravityUsage = null;
  let isApiAccount = false;
  if (agy) {
    if (getLines(config).some((line) => line.includes("agentCredits"))) {
      antigravityUsage = await fetchAntigravityUsage(config.cache.ttlSeconds);
    }
  } else {
    rateLimits = await resolveAnthropicLimits(stdin, config);
    const { found, subscriptionType } = await getCredentialState();
    const hasSubscriptionWindow = !!(rateLimits && (rateLimits.five_hour || rateLimits.seven_day || rateLimits.seven_day_sonnet || rateLimits.seven_day_fable));
    isApiAccount = !!process.env.ANTHROPIC_API_KEY || found && !subscriptionType && !hasSubscriptionWindow;
  }
  const ctx = {
    stdin,
    config,
    translations,
    rateLimits,
    antigravityUsage,
    isApiAccount
  };
  const output = await formatOutput(ctx);
  if (agy && output) {
    return output.split("\n").map((line) => `  ${line}`).join("\n");
  }
  return output;
}
async function main() {
  await runRenderLoop(
    streamJsonObjects(process.stdin),
    renderFromRaw,
    (line) => {
      process.stdout.write(line);
    }
  );
}
main().catch(() => {
  process.stdout.write(`${colorize(ICON.warning, COLORS.yellow)}
`);
});
