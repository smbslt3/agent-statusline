/**
 * @covers scripts/utils/width.ts
 */
import { describe, it, expect } from 'vitest';
import { stripAnsi, displayWidth, wrapSegments } from '../utils/width.js';

describe('width utils', () => {
  describe('stripAnsi', () => {
    it('removes SGR color sequences', () => {
      expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
      expect(stripAnsi('\x1b[38;5;222myellow\x1b[0m')).toBe('yellow');
    });

    it('removes OSC8 hyperlink sequences, keeping the visible text', () => {
      const link = '\x1b]8;;https://example.com\x1b\\repo\x1b]8;;\x1b\\';
      expect(stripAnsi(link)).toBe('repo');
    });
  });

  describe('displayWidth', () => {
    it('counts ASCII as one column each, ignoring ANSI', () => {
      expect(displayWidth('\x1b[36mabc\x1b[0m')).toBe(3);
    });

    it('counts CJK / Hangul as two columns', () => {
      expect(displayWidth('한글')).toBe(4); // 2 syllables × 2
      expect(displayWidth('中文')).toBe(4);
    });

    it('counts emoji as two columns and ignores variation selectors', () => {
      expect(displayWidth('🔥')).toBe(2);
      // Ambiguous BMP dingbats (✓ U+2713, ✽ U+273D) render as one column.
      expect(displayWidth('✓')).toBe(1);
      expect(displayWidth('✽')).toBe(1);
    });
  });

  describe('wrapSegments', () => {
    const sep = ' | '; // 3-wide plain separator

    it('keeps everything on one line when it fits', () => {
      expect(wrapSegments(['ab', 'cd', 'ef'], sep, 80)).toEqual(['ab | cd | ef']);
    });

    it('breaks at separator boundaries when exceeding the budget', () => {
      // "aaaa| bbbb" = 4 + 3 + 4 = 11 > 10 → split.
      expect(wrapSegments(['aaaa', 'bbbb'], sep, 10)).toEqual(['aaaa', 'bbbb']);
    });

    it('packs greedily up to the width budget', () => {
      // width 12: "ab | cd" = 7, + " | ef" = 12 (fits) → one line.
      expect(wrapSegments(['ab', 'cd', 'ef'], sep, 12)).toEqual(['ab | cd | ef']);
      // width 11: "ab | cd" = 7, + " | ef" = 12 (>11) → wrap.
      expect(wrapSegments(['ab', 'cd', 'ef'], sep, 11)).toEqual(['ab | cd', 'ef']);
    });

    it('keeps an oversized single segment on its own line', () => {
      expect(wrapSegments(['x'.repeat(20), 'y'], sep, 10)).toEqual(['x'.repeat(20), 'y']);
    });

    it('returns an empty array for no segments', () => {
      expect(wrapSegments([], sep, 80)).toEqual([]);
    });
  });
});
