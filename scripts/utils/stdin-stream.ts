/**
 * Incremental stdin JSON object stream parser.
 *
 * The same plugin binary serves two hosts with different invocation models:
 *   - Claude Code: writes ONE JSON object to stdin, then closes it (EOF). One
 *     status line is read from stdout, then the process exits.
 *   - Antigravity (`agy`): keeps the command alive and STREAMS state objects to
 *     stdin without ever sending EOF between updates, expecting one fresh status
 *     line per object (verified against 60ke/antigravity-statusline).
 *
 * A whole-stream `for await ... of stdin` (read-until-EOF) hangs forever on agy.
 * Instead we decode incrementally and emit each complete top-level `{...}` as
 * soon as it parses — which collapses to "one object then EOF" on Claude and to
 * "an object per update" on agy, with no host detection needed.
 *
 * @tested scripts/__tests__/stdin-stream.test.ts
 */

import { StringDecoder } from 'string_decoder';

/**
 * Hard cap on the retained stream buffer. A single top-level object larger than
 * this — or a never-terminating / malformed stream — is discarded and the
 * parser resyncs, rather than the buffer growing without bound for the life of
 * the long-lived agy process. agy state payloads are a few KB, so this ceiling
 * is far above any legitimate object.
 */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

interface ScanState {
  /** Resume position; persists across chunk appends to avoid O(n^2) re-scans. */
  i: number;
  depth: number;
  inString: boolean;
  escaped: boolean;
  /** Index of the current top-level object's opening brace, or -1. */
  start: number;
}

function freshScan(): ScanState {
  return { i: 0, depth: 0, inString: false, escaped: false, start: -1 };
}

type ScanResult =
  | { kind: 'parsed'; value: unknown; end: number }
  | { kind: 'invalid'; end: number }
  | { kind: 'incomplete' };

/**
 * Resume scanning `buffer` from `state.i`, updating `state` in place. Returns
 * the first complete top-level object boundary found at/after the resume point
 * (`parsed`), a balanced-but-invalid boundary so the caller can skip past it
 * (`invalid`), or `incomplete` when the buffer is exhausted without closing an
 * object. Braces inside string literals (with escape handling) are ignored.
 *
 * Because `state` (scan position + brace/string flags) persists across calls,
 * a buffer that grows by appended chunks is scanned at most once end-to-end
 * (O(total bytes)) instead of being re-scanned from index 0 on every chunk.
 */
function scanFrom(buffer: string, state: ScanState): ScanResult {
  for (; state.i < buffer.length; state.i += 1) {
    const ch = buffer[state.i];

    if (state.inString) {
      if (state.escaped) state.escaped = false;
      else if (ch === '\\') state.escaped = true;
      else if (ch === '"') state.inString = false;
      continue;
    }

    if (ch === '"') {
      state.inString = true;
      continue;
    }
    if (ch === '{') {
      if (state.depth === 0) state.start = state.i;
      state.depth += 1;
    } else if (ch === '}' && state.depth > 0) {
      state.depth -= 1;
      if (state.depth === 0 && state.start !== -1) {
        const end = state.i + 1;
        const slice = buffer.slice(state.start, end);
        try {
          return { kind: 'parsed', value: JSON.parse(slice), end };
        } catch {
          // Balanced braces but invalid JSON. Report the boundary so the caller
          // can advance past it — leaving it in the buffer would wedge the
          // stream permanently (and re-scan + accumulate it forever) on agy.
          return { kind: 'invalid', end };
        }
      }
    }
  }

  return { kind: 'incomplete' };
}

/**
 * Find and parse the first complete top-level JSON object in `buffer`.
 *
 * Stateless wrapper (fresh scan each call). Returns the parsed value plus the
 * unconsumed remainder, or null when no complete object is present yet (more
 * input needed) or the first object is balanced-but-invalid.
 */
export function takeFirstJsonObject(
  buffer: string
): { value: unknown; rest: string } | null {
  const r = scanFrom(buffer, freshScan());
  return r.kind === 'parsed' ? { value: r.value, rest: buffer.slice(r.end) } : null;
}

/**
 * Yield parsed JSON objects from a readable stream as each one completes.
 *
 * Works whether the producer closes the stream after one object (Claude) or
 * holds it open and streams many (agy). UTF-8 is decoded with a StringDecoder
 * so multi-byte characters split across chunk boundaries are reassembled.
 * Balanced-but-invalid objects are skipped (so one bad object can't freeze the
 * agy status line), the scan position is carried across chunks (no O(n^2)
 * re-scan), and the buffer is hard-capped (bounded memory).
 */
export async function* streamJsonObjects(
  stream: NodeJS.ReadableStream
): AsyncGenerator<unknown> {
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  let state = freshScan();

  function* drain(): Generator<unknown> {
    let r = scanFrom(buffer, state);
    while (r.kind !== 'incomplete') {
      const value = r.kind === 'parsed' ? r.value : undefined;
      const hasValue = r.kind === 'parsed';
      buffer = buffer.slice(r.end);
      state = freshScan();
      if (hasValue) yield value;
      r = scanFrom(buffer, state);
    }
    // r.kind === 'incomplete': state.i now sits at buffer.length, so the next
    // appended chunk resumes scanning from there rather than from index 0.
  }

  for await (const chunk of stream) {
    buffer += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));

    // Bound memory: if the buffer outgrows any legitimate object without ever
    // completing one, discard it and resync instead of retaining it forever.
    if (buffer.length > MAX_BUFFER_BYTES) {
      buffer = '';
      state = freshScan();
      continue;
    }

    yield* drain();
  }

  buffer += decoder.end();
  yield* drain();
}
