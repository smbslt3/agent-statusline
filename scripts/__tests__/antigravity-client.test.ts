/**
 * @covers scripts/utils/antigravity-client.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';

const ORIGINAL_ENV = { ...process.env };

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

async function loadClient(testDir: string) {
  vi.resetModules();
  process.env.ANTIGRAVITY_HOME = path.join(testDir, 'antigravity-home');
  process.env.AGENT_STATUSLINE_CACHE_DIR = path.join(testDir, 'cache');
  const mod = await import('../utils/antigravity-client.js');
  mod.clearAntigravityCache();
  return mod;
}

describe('antigravity-client', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `antigravity-client-test-${Date.now()}-${Math.random()}`);
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    process.env = { ...ORIGINAL_ENV };
    spawnMock.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    await rm(testDir, { recursive: true, force: true });
  });

  describe('isAntigravityInstalled', () => {
    it('returns true when the home directory exists', async () => {
      const client = await loadClient(testDir);
      await mkdir(process.env.ANTIGRAVITY_HOME!, { recursive: true });

      await expect(client.isAntigravityInstalled()).resolves.toBe(true);
    });

    it('returns false when no local state and no executable exist', async () => {
      const client = await loadClient(testDir);
      process.env.PATH = '';

      await expect(client.isAntigravityInstalled()).resolves.toBe(false);
    });
  });

  describe('parseAntigravityUserStatus', () => {
    it('maps clientModelConfigs to quota buckets', async () => {
      const client = await loadClient(testDir);
      const result = client.parseAntigravityUserStatus({
        userStatus: {
          cascadeModelConfigData: {
            clientModelConfigs: [
              { modelName: 'Gemini 3.5 Flash (High)', quotaInfo: { remainingFraction: 0.8, resetTime: '2026-06-13T12:00:00Z' } },
              { modelName: 'Claude Opus 4.6 (Thinking)', quotaInfo: { remainingFraction: 1, resetTime: '2026-06-13T14:00:00Z' } },
              { modelName: 'Mystery Model', quotaInfo: {} },
            ],
          },
        },
      }, 'Gemini 3.5 Flash (High)');

      expect(result).not.toBeNull();
      expect(result?.model).toBe('Gemini 3.5 Flash (High)');
      expect(result?.usedPercent).toBe(20);
      expect(result?.resetAt).toBe('2026-06-13T12:00:00Z');
      expect(result?.modelCount).toBe(3);
      expect(result?.buckets[1].usedPercent).toBe(0);
      // Entries without remainingFraction stay unknown, not 100% used.
      expect(result?.buckets[2].usedPercent).toBeNull();
    });

    it('returns null when the response has no model configs', async () => {
      const client = await loadClient(testDir);
      expect(client.parseAntigravityUserStatus({}, null)).toBeNull();
      expect(client.parseAntigravityUserStatus({ userStatus: {} }, null)).toBeNull();
    });

    it('extracts available credits alongside quota buckets', async () => {
      const client = await loadClient(testDir);
      const result = client.parseAntigravityUserStatus({
        userStatus: {
          cascadeModelConfigData: {
            clientModelConfigs: [
              { modelName: 'Gemini 3.5 Flash (High)', quotaInfo: { remainingFraction: 0.8 } },
            ],
          },
          userTier: {
            name: 'Google AI Pro',
            availableCredits: [
              { creditType: 'GOOGLE_ONE_AI', creditAmount: '1000', minimumCreditAmountForUsage: '50' },
            ],
          },
        },
      }, 'Gemini 3.5 Flash (High)');

      expect(result?.credits).toEqual({ amount: 1000, type: 'GOOGLE_ONE_AI', minForUsage: 50 });
    });

    it('sums multiple credit types and drops the type label when mixed', async () => {
      const client = await loadClient(testDir);
      const result = client.parseAntigravityUserStatus({
        userStatus: {
          cascadeModelConfigData: { clientModelConfigs: [{ modelName: 'X', quotaInfo: { remainingFraction: 1 } }] },
          userTier: {
            availableCredits: [
              { creditType: 'GOOGLE_ONE_AI', creditAmount: '1000' },
              { creditType: 'PROMO', creditAmount: '250' },
            ],
          },
        },
      }, null);

      expect(result?.credits).toEqual({ amount: 1250, type: null, minForUsage: null });
    });

    it('surfaces credits even when no model configs are present', async () => {
      const client = await loadClient(testDir);
      const result = client.parseAntigravityUserStatus({
        userStatus: {
          userTier: { availableCredits: [{ creditType: 'GOOGLE_ONE_AI', creditAmount: '500' }] },
        },
      }, 'Gemini 3.5 Flash');

      expect(result).not.toBeNull();
      expect(result?.usedPercent).toBeNull();
      expect(result?.credits).toEqual({ amount: 500, type: 'GOOGLE_ONE_AI', minForUsage: null });
    });

    it('leaves credits null when the tier reports none', async () => {
      const client = await loadClient(testDir);
      const result = client.parseAntigravityUserStatus({
        userStatus: {
          cascadeModelConfigData: { clientModelConfigs: [{ modelName: 'X', quotaInfo: { remainingFraction: 0.5 } }] },
        },
      }, null);

      expect(result?.credits ?? null).toBeNull();
    });
  });

  describe('fetchAntigravityUsage', () => {
    it('reads the real agy settings shape (top-level string model)', async () => {
      const client = await loadClient(testDir);
      const home = process.env.ANTIGRAVITY_HOME!;
      await mkdir(home, { recursive: true });
      await writeFile(path.join(home, 'settings.json'), JSON.stringify({
        model: 'Gemini 3.5 Flash (High)',
        colorScheme: 'tokyo night',
      }));
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await client.fetchAntigravityUsage(60);

      expect(result).toEqual({
        model: 'Gemini 3.5 Flash (High)',
        usedPercent: null,
        resetAt: null,
        modelCount: null,
        buckets: [],
      });
      expect(spawnMock).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('accepts object-shaped model settings defensively', async () => {
      const client = await loadClient(testDir);
      const home = process.env.ANTIGRAVITY_HOME!;
      await mkdir(home, { recursive: true });
      await writeFile(path.join(home, 'settings.json'), JSON.stringify({
        model: { name: 'gemini-3-pro' },
      }));

      const result = await client.fetchAntigravityUsage(60);

      expect(result?.model).toBe('gemini-3-pro');
    });

    it('returns null when nothing local exists', async () => {
      const client = await loadClient(testDir);
      process.env.PATH = '';

      const result = await client.fetchAntigravityUsage(60);

      expect(result).toBeNull();
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('uses file cache before re-reading local state', async () => {
      const client = await loadClient(testDir);
      const home = process.env.ANTIGRAVITY_HOME!;
      await mkdir(home, { recursive: true });
      await writeFile(path.join(home, 'settings.json'), JSON.stringify({
        model: 'Gemini 3.5 Flash (High)',
      }));

      const first = await client.fetchAntigravityUsage(60);
      client.clearAntigravityCache();
      await rm(path.join(home, 'settings.json'));
      process.env.PATH = '';
      const second = await client.fetchAntigravityUsage(60);

      expect(first?.model).toBe('Gemini 3.5 Flash (High)');
      expect(second).toEqual(first);
    });
  });
});
