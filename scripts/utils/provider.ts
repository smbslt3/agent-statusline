/**
 * Provider identity (mark + brand colors) for the active model.
 *
 * The same plugin renders on Claude Code and Antigravity (agy). The model
 * widget's mark + name reflect which provider's model is active, detected from
 * the model name — so the identity is correct regardless of which host invoked
 * the status line.
 *
 * Brand styling was sampled from the products themselves:
 *   - Claude: heavy asterisk ✽ in coral/orange #D97757, name in the same coral.
 *   - agy:    bold lambda Λ (the Antigravity "A" peak) in blue #588DE1 + the
 *             model name as a rainbow gradient across the Antigravity logo
 *             colors (blue→green→orange→red). A single text-height glyph is used
 *             because box-drawing diagonals (╱╲) render full cell height.
 * 24-bit truecolor is used (matches the existing themes in colors.ts).
 *
 * @tested scripts/__tests__/widgets.test.ts
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const tc = (r: number, g: number, b: number): string => `\x1b[38;2;${r};${g};${b}m`;

const CLAUDE_CORAL = tc(217, 119, 87); // #D97757 (official Anthropic Claude brand coral)
const AGY_BLUE = tc(88, 141, 225); // #588DE1

// Antigravity logo gradient stops (sampled): blue → green → orange → red.
const AGY_PALETTE: Array<[number, number, number]> = [
  [88, 141, 225],
  [120, 194, 94],
  [233, 140, 55],
  [234, 96, 70],
];

export type ProviderId = 'claude' | 'gemini';

/**
 * Detect the provider from the model name. Gemini models (Antigravity runs
 * Gemini) → 'gemini'; everything else (Opus/Sonnet/Haiku/…) → 'claude'.
 */
export function detectProvider(modelName: string): ProviderId {
  return /gemini/i.test(modelName) ? 'gemini' : 'claude';
}

/**
 * Colored provider mark glyph, self-terminated with a reset.
 * - claude: heavy teardrop-spoked asterisk ✽ in coral.
 * - gemini: bold lambda Λ (the Antigravity "A" peak) in blue. A single
 *   text-height glyph — box-drawing diagonals (╱╲) render full cell height and
 *   looked oversized next to the text.
 */
export function providerMark(provider: ProviderId): string {
  if (provider === 'gemini') {
    return `${BOLD}${AGY_BLUE}Λ${RESET}`;
  }
  return `${CLAUDE_CORAL}✽${RESET}`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Color `text` with a per-character gradient across `stops`.
 */
function gradient(text: string, stops: Array<[number, number, number]>): string {
  const chars = [...text];
  const n = chars.length;
  if (n === 0) return '';
  let out = '';
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    const seg = t * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(seg));
    const f = seg - k;
    const c0 = stops[k];
    const c1 = stops[k + 1];
    out += tc(lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)) + chars[i];
  }
  return out + RESET;
}

/**
 * Render the model name in the provider's brand style.
 * - claude: solid coral.
 * - gemini: rainbow gradient across the Antigravity logo colors.
 */
export function providerName(provider: ProviderId, text: string): string {
  if (provider === 'gemini') {
    return gradient(text, AGY_PALETTE);
  }
  return `${CLAUDE_CORAL}${text}${RESET}`;
}
