import { describe, it, expect } from 'vitest';
import { runRenderLoop } from '../render-loop.js';
import { ICON } from '../utils/emoji.js';

/** Minimal async iterable over a fixed list of frames (mimics streamJsonObjects). */
async function* frames(items: unknown[]): AsyncGenerator<unknown> {
  for (const item of items) yield item;
}

describe('runRenderLoop', () => {
  it('writes exactly one line per frame on success', async () => {
    const out: string[] = [];
    await runRenderLoop(frames([1, 2, 3]), async (r) => `line${r}`, (l) => out.push(l));
    expect(out).toEqual(['line1\n', 'line2\n', 'line3\n']);
  });

  it('keeps consuming the stream when a single frame throws (agy resilience)', async () => {
    const out: string[] = [];
    const render = async (r: unknown): Promise<string> => {
      if (r === 2) throw new Error('boom');
      return `line${r}`;
    };
    await runRenderLoop(frames([1, 2, 3]), render, (l) => out.push(l));

    expect(out).toHaveLength(3);             // every frame still emits exactly one line
    expect(out[0]).toBe('line1\n');
    expect(out[1]).toContain(ICON.warning);  // the bad frame degraded to ⚠️ ...
    expect(out[2]).toBe('line3\n');          // ... and the loop survived to render the next
  });

  it('emits exactly one warning (no double-print) when the only frame throws', async () => {
    const out: string[] = [];
    await runRenderLoop(frames([1]), async () => { throw new Error('x'); }, (l) => out.push(l));
    // The catch already emitted a line, so the empty-stream fallback must NOT fire again.
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(ICON.warning);
  });

  it('emits a single warning when the stream yields nothing', async () => {
    const out: string[] = [];
    await runRenderLoop(frames([]), async () => 'unused', (l) => out.push(l));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(ICON.warning);
  });
});
