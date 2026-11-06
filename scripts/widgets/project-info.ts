/**
 * Project info widget - displays directory name, git branch, and ahead/behind status
 * @tested scripts/__tests__/widgets.test.ts
 */

import path from 'path';
import type { Widget } from './base.js';
import type { WidgetContext, ProjectInfoData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { ICON } from '../utils/emoji.js';
import { osc8Link, sanitizeText } from '../utils/formatters.js';
import { execGit } from '../utils/git.js';
import { fileCachePath, loadFileCache, saveFileCache } from '../utils/file-cache.js';
import { hashToken } from '../utils/hash.js';

/**
 * TTL-based cache for git data (5 seconds).
 * Branch/remote rarely change; dirty status is the most volatile.
 */
const GIT_CACHE_TTL_MS = 5_000;

let gitCache: {
  cwd: string;
  data: { branch?: string; dirty: boolean; ab: { ahead: number; behind: number } | null; remoteUrl?: string };
  timestamp: number;
} | null = null;

/**
 * Get current git branch with timeout
 */
async function getGitBranch(cwd: string): Promise<string | undefined> {
  try {
    const result = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, 500);
    return result.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if git working directory has uncommitted changes
 */
async function isGitDirty(cwd: string): Promise<boolean> {
  try {
    const result = await execGit(['status', '--porcelain'], cwd, 1000);
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get ahead/behind counts relative to upstream
 * Returns { ahead, behind } or null if no upstream
 */
async function getAheadBehind(cwd: string): Promise<{ ahead: number; behind: number } | null> {
  try {
    const result = await execGit(['rev-list', '--left-right', '--count', '@{u}...HEAD'], cwd, 500);
    const parts = result.trim().split(/\s+/);
    if (parts.length === 2) {
      return {
        behind: parseInt(parts[0], 10) || 0,
        ahead: parseInt(parts[1], 10) || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get git remote origin URL
 */
async function getGitRemoteUrl(cwd: string): Promise<string | undefined> {
  try {
    const result = await execGit(['remote', 'get-url', 'origin'], cwd, 500);
    return normalizeGitUrl(result.trim()) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalize git remote URL to HTTPS web URL.
 * - git@github.com:user/repo.git   → https://github.com/user/repo
 * - ssh://git@github.com/user/repo → https://github.com/user/repo
 * - https://github.com/user/repo.git → https://github.com/user/repo
 */
function normalizeGitUrl(url: string): string | null {
  // SSH: git@host:path or ssh://git@host/path
  const sshMatch = url.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;

  // HTTPS: strip .git suffix and userinfo (user:token@)
  const httpsMatch = url.match(/^https?:\/\/(?:[^@/]+@)?(.+?)(?:\.git)?$/);
  if (httpsMatch) return `https://${httpsMatch[1]}`;

  return null;
}

/**
 * The slow-changing git fields. Branch, ahead/behind, and remote URL only move
 * on commit/checkout/fetch/remote-edit, so they are safe to cache across the
 * one-shot Claude processes that spawn a fresh status-line per render. `dirty`
 * is deliberately excluded — it flips on any working-tree edit and is always
 * recomputed fresh so the `*` indicator never lags.
 */
interface SlowGitData {
  branch?: string;
  ab: { ahead: number; behind: number } | null;
  remoteUrl?: string;
}

/** Cross-process TTL for the slow git fields (seconds). Matches the in-process window. */
const GIT_FILE_CACHE_TTL_SECONDS = 5;

/**
 * Resolve the slow git fields, backed by the shared cross-process file cache so
 * consecutive one-shot Claude renders don't respawn three git subprocesses each.
 */
async function getSlowGitData(cwd: string): Promise<SlowGitData> {
  const cacheFile = fileCachePath(`git-${hashToken(cwd)}.json`);
  const cached = await loadFileCache<SlowGitData>(cacheFile, GIT_FILE_CACHE_TTL_SECONDS);
  if (cached) return cached.data;

  const [branch, ab, remoteUrl] = await Promise.all([
    getGitBranch(cwd),
    getAheadBehind(cwd),
    getGitRemoteUrl(cwd),
  ]);
  const slow: SlowGitData = { branch, ab, remoteUrl };
  await saveFileCache(cacheFile, slow);
  return slow;
}

/**
 * Get all git data. The in-process TTL cache serves repeated calls within one
 * process (and successive renders on the long-lived agy host); the slow fields
 * additionally persist cross-process so the one-shot Claude host avoids
 * respawning git every repaint. `dirty` is always fetched fresh.
 */
async function getGitData(cwd: string) {
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

export const projectInfoWidget: Widget<ProjectInfoData> = {
  id: 'projectInfo',
  name: 'Project Info',

  async getData(ctx: WidgetContext): Promise<ProjectInfoData | null> {
    const currentDir = ctx.stdin.workspace?.current_dir;
    if (!currentDir) {
      return null;
    }

    const projectDir = ctx.stdin.workspace?.project_dir;

    // Use project_dir for display name when available. File/dir names can carry
    // control characters on POSIX, so sanitize before they reach the terminal.
    const dirName = sanitizeText(getPathBasename(projectDir || currentDir));

    // Compute relative subpath when CWD differs from project root
    const rawSubPath = getProjectSubPath(projectDir, currentDir);
    const subPath = rawSubPath ? sanitizeText(rawSubPath) : undefined;

    // Worktree name (only present in --worktree sessions)
    const worktreeName = ctx.stdin.worktree?.name || undefined;

    const { branch, dirty, ab, remoteUrl } = await getGitData(currentDir);

    let gitBranch: string | undefined;
    let ahead: number | undefined;
    let behind: number | undefined;

    if (branch) {
      // Git forbids control chars in ref names, but sanitize defensively since
      // the branch is rendered (and embedded in the OSC8 hyperlink text).
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
      remoteUrl: remoteUrl && branch
        ? `${remoteUrl}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
        : undefined,
    };
  },

  render(data: ProjectInfoData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const parts: string[] = [];

    // Directory name with folder icon, and subpath when CWD differs from project root
    const dirDisplay = data.subPath
      ? `${ICON.folder} ${data.dirName} (${data.subPath})`
      : `${ICON.folder} ${data.dirName}`;
    parts.push(colorize(dirDisplay, theme.folder));

    // Git branch in parentheses with ahead/behind indicators
    if (data.gitBranch) {
      let branchStr = data.gitBranch;

      const aheadStr = (data.ahead ?? 0) > 0 ? `↑${data.ahead}` : '';
      const behindStr = (data.behind ?? 0) > 0 ? `↓${data.behind}` : '';
      const indicators = `${aheadStr}${behindStr}`;

      if (indicators) {
        branchStr += ` ${indicators}`;
      }

      // Apply OSC8 hyperlink when remote URL is available
      const branchDisplay = data.remoteUrl
        ? `(${osc8Link(data.remoteUrl, branchStr)})`
        : `(${branchStr})`;
      parts.push(colorize(branchDisplay, theme.branch));
    }

    // Worktree indicator (only in --worktree sessions)
    if (data.worktreeName) {
      parts.push(colorize(`${ICON.tree} wt:${data.worktreeName}`, theme.info));
    }

    return parts.join(' ');
  },
};

function getProjectSubPath(projectDir: string | undefined, currentDir: string): string | undefined {
  if (!projectDir || currentDir === projectDir) return undefined;

  const pathApi = getPathApi(projectDir, currentDir);
  const subPath = pathApi.relative(projectDir, currentDir);
  if (!subPath || subPath === '..' || subPath.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(subPath)) {
    return undefined;
  }

  return subPath.split(/[\\/]+/).join('/');
}

function getPathBasename(inputPath: string): string {
  return getPathApi(inputPath).basename(inputPath);
}

function getPathApi(...paths: string[]): typeof path.win32 {
  return paths.some((p) => /^[A-Za-z]:[\\/]/.test(p) || p.includes('\\'))
    ? path.win32
    : path;
}

export function clearGitCacheForTest(): void {
  gitCache = null;
}
