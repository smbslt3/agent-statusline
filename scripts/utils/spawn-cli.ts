/**
 * Cross-platform executable-location helpers shared by the CLI usage clients.
 * Windows package managers expose commands under several extensions
 * (.exe/.cmd/.ps1/...), so a PATH scan has to try each candidate name.
 */

import { stat } from 'fs/promises';
import path from 'path';

const DEFAULT_WINDOWS_EXTENSIONS = ['.EXE', '.CMD', '.BAT', '.COM', '.PS1'];

/**
 * Async existence check shared by the CLI usage clients. Resolves true when the
 * path can be stat'd, false otherwise (missing, permission error, etc.).
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function windowsExecutableNames(command: string): string[] {
  const configured = (process.env.PATHEXT || DEFAULT_WINDOWS_EXTENSIONS.join(';'))
    .split(';')
    .map((ext) => ext.trim())
    .filter(Boolean);
  const extensions = Array.from(new Set([...configured, ...DEFAULT_WINDOWS_EXTENSIONS]));
  return extensions.flatMap((ext) => [`${command}${ext.toLowerCase()}`, `${command}${ext.toUpperCase()}`]).concat(command);
}

function executableCandidates(command: string): string[] {
  return process.platform === 'win32' ? windowsExecutableNames(command) : [command];
}

/**
 * Locate the first matching executable for any of `names` on PATH.
 * Async PATH scan shared by the CLI usage clients (install detection).
 */
export async function findExecutable(names: string[]): Promise<string | null> {
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathEntries) {
    for (const name of names) {
      for (const candidate of executableCandidates(name)) {
        try {
          await stat(path.join(dir, candidate));
          return path.join(dir, candidate);
        } catch {
          // Keep scanning.
        }
      }
    }
  }
  return null;
}
