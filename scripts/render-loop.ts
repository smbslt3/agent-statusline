/**
 * The stdin render loop, extracted from statusline.ts so its per-frame
 * crash-resilience is unit-testable. (statusline.ts binds process.stdin/stdout
 * directly and auto-runs main() on import, so a test can't drive it there.)
 */

import { COLORS, colorize } from './utils/colors.js';
import { ICON } from './utils/emoji.js';
import { debugLog } from './utils/debug.js';

/**
 * Render one status line per object in `stream`, writing each line via `write`.
 *
 * A throw from `render` degrades that single frame to the ⚠️ glyph and the loop
 * keeps consuming. This matters on the agy host, where stdin is a long-lived
 * stream of state updates: an uncaught throw would exit the `for await` loop and
 * silently kill the status line for the rest of the session. On Claude (one
 * object then EOF) the loop renders once and returns, so the guard is a no-op on
 * the happy path. When the stream yields nothing, emit a single warning glyph.
 */
export async function runRenderLoop(
  stream: AsyncIterable<unknown>,
  render: (raw: unknown) => Promise<string>,
  write: (line: string) => void,
): Promise<void> {
  let rendered = false;

  for await (const raw of stream) {
    try {
      const output = await render(raw);
      write(`${output}\n`);
    } catch (err) {
      debugLog('statusline', 'render frame failed', err);
      write(`${colorize(ICON.warning, COLORS.yellow)}\n`);
    }
    // A line was emitted for this frame (real output or the warning glyph), so
    // the no-input fallback below must not also fire and double-print.
    rendered = true;
  }

  if (!rendered) {
    write(`${colorize(ICON.warning, COLORS.yellow)}\n`);
  }
}
