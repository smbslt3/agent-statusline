/**
 * @covers scripts/utils/i18n.ts
 */
import { describe, it, expect } from 'vitest';
import { getTranslations } from '../utils/i18n.js';

describe('i18n', () => {
  describe('getTranslations', () => {
    it('returns the English label strings', () => {
      const t = getTranslations();
      expect(t.labels['5h']).toBe('5h');
      expect(t.time.hours).toBe('h');
      expect(t.widgets.working).toBe('working');
    });

    it('returns a stable object across calls', () => {
      expect(getTranslations()).toBe(getTranslations());
    });
  });
});
