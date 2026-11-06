/**
 * Status-line label strings (English).
 *
 * The plugin renders English-only. This module is the single source for the
 * label strings consumed by widgets via `ctx.translations`.
 * @tested scripts/__tests__/i18n.test.ts
 */
import type { Translations } from '../types.js';
import en from '../../locales/en.json';

const TRANSLATIONS = en as Translations;

/**
 * Get the status-line label strings (English).
 */
export function getTranslations(): Translations {
  return TRANSLATIONS;
}
