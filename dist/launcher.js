#!/usr/bin/env node

// scripts/launcher.ts
import { spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
var DEFAULT_CACHE_ROOT = join(
  homedir(),
  ".claude",
  "plugins",
  "cache",
  "agent-statusline",
  "agent-statusline"
);
var SEMVER_DIR = /^\d+\.\d+\.\d+(?:[-+].*)?$/;
function compareVersionsDesc(a, b) {
  const aParts = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const bParts = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLength; i += 1) {
    const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
    if (diff !== 0)
      return diff;
  }
  return 0;
}
function findLatestStatusline(cacheRoot = process.env.AGENT_STATUSLINE_PLUGIN_CACHE_DIR || DEFAULT_CACHE_ROOT) {
  if (!existsSync(cacheRoot))
    return null;
  const dirs = readdirSync(cacheRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const semver = dirs.filter((name) => SEMVER_DIR.test(name)).sort(compareVersionsDesc);
  const others = dirs.filter((name) => !SEMVER_DIR.test(name)).sort();
  for (const dir of [...semver, ...others]) {
    const statusline = join(cacheRoot, dir, "dist", "index.js");
    if (existsSync(statusline))
      return statusline;
  }
  return null;
}
function runLauncher() {
  const statusline = findLatestStatusline();
  if (!statusline) {
    process.stdout.write("!\n");
    return Promise.resolve(0);
  }
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [statusline], { stdio: "inherit" });
    child.on("error", () => {
      process.stdout.write("!\n");
      resolve(0);
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLauncher().then((code) => {
    process.exitCode = code;
  });
}
export {
  compareVersionsDesc,
  findLatestStatusline,
  runLauncher
};
