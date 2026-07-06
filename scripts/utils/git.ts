/**
 * Git utilities - shared async git command execution
 * @tested scripts/__tests__/widgets.test.ts (countUntrackedLines via mock)
 */

import { execFile } from 'child_process';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

/** Caps so a repo with many/large untracked files can't exhaust fds or memory. */
const UNTRACKED_MAX_FILES = 1000;
const UNTRACKED_MAX_FILE_BYTES = 2 * 1024 * 1024;
const UNTRACKED_READ_CONCURRENCY = 16;

/**
 * Run git command asynchronously with timeout.
 *
 * `maxBuffer` is raised above Node's 1MB default so a large `git status
 * --porcelain` / `git diff --stat` on a big working tree fails loudly (rejects)
 * rather than silently truncating and mis-reporting the tree as clean.
 */
export function execGit(args: string[], cwd: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['--no-optional-locks', ...args], {
      cwd,
      encoding: 'utf-8',
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/**
 * Count total lines across untracked (new) files.
 *
 * Shell-free: lists untracked paths with `git ls-files -z` (NUL-delimited, so
 * exotic filenames are safe) and counts newlines in each file directly in Node.
 * This removes the previous `sh -c "... | xargs -0 cat | wc -l"` pipeline — which
 * was a latent shell-injection surface and silently returned 0 on Windows (no
 * `sh`/`xargs`/`wc`). Unreadable/binary files are skipped.
 */
export async function countUntrackedLines(cwd: string, timeout: number): Promise<number> {
  try {
    const out = await execGit(['ls-files', '--others', '--exclude-standard', '-z'], cwd, timeout);
    const files = out.split('\0').filter(Boolean).slice(0, UNTRACKED_MAX_FILES);

    let total = 0;
    // Read in bounded-concurrency batches: avoids exhausting file descriptors /
    // spiking memory on a working tree with many untracked files (the previous
    // `xargs -0 cat` pipeline batched implicitly).
    for (let i = 0; i < files.length; i += UNTRACKED_READ_CONCURRENCY) {
      const batch = files.slice(i, i + UNTRACKED_READ_CONCURRENCY);
      const counts = await Promise.all(
        batch.map(async (file) => {
          try {
            const full = join(cwd, file);
            const st = await stat(full);
            if (!st.isFile() || st.size > UNTRACKED_MAX_FILE_BYTES) return 0;
            const content = await readFile(full, 'utf-8');
            // Match `wc -l` semantics: count newline characters.
            return content.split('\n').length - 1;
          } catch {
            return 0;
          }
        }),
      );
      total += counts.reduce((a, b) => a + b, 0);
    }
    return total;
  } catch {
    return 0;
  }
}
