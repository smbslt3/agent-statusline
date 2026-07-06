#!/usr/bin/env node
/**
 * Version-independent status line launcher.
 *
 * Claude Code stores marketplace plugins under versioned cache directories.
 * User settings should point to this stable launcher, which resolves and runs
 * the newest installed agent-statusline bundle at invocation time.
 */
import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const DEFAULT_CACHE_ROOT = join(
  homedir(),
  '.claude',
  'plugins',
  'cache',
  'agent-statusline',
  'agent-statusline'
);

const SEMVER_DIR = /^\d+\.\d+\.\d+(?:[-+].*)?$/;

export function compareVersionsDesc(a: string, b: string): number {
  const aParts = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const bParts = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

export function findLatestStatusline(cacheRoot = process.env.AGENT_STATUSLINE_PLUGIN_CACHE_DIR || DEFAULT_CACHE_ROOT): string | null {
  if (!existsSync(cacheRoot)) return null;

  const dirs = readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  // Prefer semver-named version dirs (newest first), but fall back to any other
  // dir name — Claude Code caches some plugins under a non-semver dir such as
  // `unknown`, so a semver-only filter would miss the bundle entirely.
  const semver = dirs.filter((name) => SEMVER_DIR.test(name)).sort(compareVersionsDesc);
  const others = dirs.filter((name) => !SEMVER_DIR.test(name)).sort();

  for (const dir of [...semver, ...others]) {
    const statusline = join(cacheRoot, dir, 'dist', 'index.js');
    if (existsSync(statusline)) return statusline;
  }

  return null;
}

export function runLauncher(): Promise<number> {
  const statusline = findLatestStatusline();
  if (!statusline) {
    process.stdout.write('!\n');
    return Promise.resolve(0);
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [statusline], { stdio: 'inherit' });

    child.on('error', () => {
      process.stdout.write('!\n');
      resolve(0);
    });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLauncher().then((code) => {
    process.exitCode = code;
  });
}
