/**
 * Display-width helpers for terminal-aware line wrapping.
 *
 * `displayWidth` returns the number of terminal columns a string occupies,
 * ignoring ANSI styling and OSC8 hyperlink escape sequences and counting
 * East-Asian wide / emoji code points as two columns. This is an
 * approximation (full grapheme/emoji width is terminal-dependent), which is
 * acceptable for the opt-in `autoWrap` layout.
 *
 * @tested scripts/__tests__/width.test.ts
 */

// SGR color/style sequences (\x1b[...m) and OSC8 hyperlink open/close
// (\x1b]8;;URL\x07 or \x1b]8;;URL\x1b\\). Stripped before measuring width.
// eslint-disable-next-line no-control-regex
const OSC8_RE = /\x1b\]8;;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
// eslint-disable-next-line no-control-regex
const SGR_RE = /\x1b\[[0-9;]*m/g;

/**
 * Remove ANSI SGR styling and OSC8 hyperlink sequences from a string.
 */
export function stripAnsi(value: string): string {
  return value.replace(OSC8_RE, '').replace(SGR_RE, '');
}

/**
 * Code points that occupy zero terminal columns: combining marks,
 * zero-width spaces/joiners, and the emoji variation selector (VS16).
 */
function isZeroWidth(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacritical marks
    (cp >= 0x200b && cp <= 0x200f) || // zero-width space..RLM
    cp === 0x2028 || cp === 0x2029 || // line/paragraph separators
    (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors (incl. VS16)
    cp === 0xfeff // BOM / zero-width no-break space
  );
}

/**
 * Code points that occupy two terminal columns: CJK, Hangul, fullwidth
 * forms, and the high emoji planes (U+1F000+).
 *
 * The ambiguous BMP symbol/dingbat range (U+2600–U+27BF, e.g. ✓ ✽ ⚡) is
 * deliberately excluded: monospace terminals render those as a single column
 * unless an emoji variation selector forces emoji presentation, so counting
 * them as one matches the common case (and our provider marks).
 */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals .. punctuation
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana .. CJK compat
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat ideographs
    (cp >= 0xfe10 && cp <= 0xfe19) || // vertical forms
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK compat forms + small forms
    (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) || // fullwidth signs
    (cp >= 0x1f000 && cp <= 0x1faff) || // emoji + symbols & pictographs
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK Ext B+ (supplementary ideographs)
  );
}

/**
 * Number of terminal columns the string occupies (ANSI/OSC8 ignored).
 */
export function displayWidth(value: string): number {
  const plain = stripAnsi(value);
  let width = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0);
    if (cp === undefined || isZeroWidth(cp)) continue;
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}

/**
 * Pack pre-rendered segments into physical lines so that no line exceeds
 * `maxWidth` columns, breaking only at separator boundaries. A single segment
 * wider than `maxWidth` is kept on its own line rather than split.
 */
export function wrapSegments(segments: string[], separator: string, maxWidth: number): string[] {
  if (segments.length === 0) return [];
  const sepWidth = displayWidth(separator);
  const lines: string[] = [];
  let current: string[] = [];
  let currentWidth = 0;

  for (const segment of segments) {
    const segWidth = displayWidth(segment);
    if (current.length === 0) {
      current = [segment];
      currentWidth = segWidth;
      continue;
    }
    if (currentWidth + sepWidth + segWidth > maxWidth) {
      lines.push(current.join(separator));
      current = [segment];
      currentWidth = segWidth;
    } else {
      current.push(segment);
      currentWidth += sepWidth + segWidth;
    }
  }
  if (current.length > 0) lines.push(current.join(separator));
  return lines;
}
