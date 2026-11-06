/**
 * @covers scripts/launcher.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { compareVersionsDesc, findLatestStatusline } from '../launcher.js';

describe('launcher', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `claude-dashboard-launcher-${Date.now()}-${Math.random()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sorts semantic version directories newest first', () => {
    const versions = ['1.2.9', '1.10.0', '1.2.10'];
    expect(versions.sort(compareVersionsDesc)).toEqual(['1.10.0', '1.2.10', '1.2.9']);
  });

  it('finds the newest installed statusline bundle', () => {
    const oldDist = path.join(tmpDir, '1.29.0', 'dist');
    const newDist = path.join(tmpDir, '1.30.0', 'dist');
    mkdirSync(oldDist, { recursive: true });
    mkdirSync(newDist, { recursive: true });
    writeFileSync(path.join(oldDist, 'index.js'), '');
    writeFileSync(path.join(newDist, 'index.js'), '');

    expect(findLatestStatusline(tmpDir)).toBe(path.join(newDist, 'index.js'));
  });

  it('skips versions without a statusline bundle', () => {
    const oldDist = path.join(tmpDir, '1.29.0', 'dist');
    mkdirSync(oldDist, { recursive: true });
    mkdirSync(path.join(tmpDir, '1.30.0'), { recursive: true });
    writeFileSync(path.join(oldDist, 'index.js'), '');

    expect(findLatestStatusline(tmpDir)).toBe(path.join(oldDist, 'index.js'));
  });

  it('finds the bundle under a non-semver cache dir (e.g. Claude Code "unknown")', () => {
    const dist = path.join(tmpDir, 'unknown', 'dist');
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.js'), '');

    expect(findLatestStatusline(tmpDir)).toBe(path.join(dist, 'index.js'));
  });

  it('prefers a semver version dir over a non-semver one', () => {
    const semDist = path.join(tmpDir, '0.0.1', 'dist');
    const unkDist = path.join(tmpDir, 'unknown', 'dist');
    mkdirSync(semDist, { recursive: true });
    mkdirSync(unkDist, { recursive: true });
    writeFileSync(path.join(semDist, 'index.js'), '');
    writeFileSync(path.join(unkDist, 'index.js'), '');

    expect(findLatestStatusline(tmpDir)).toBe(path.join(semDist, 'index.js'));
  });
});
