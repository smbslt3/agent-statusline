/**
 * @covers scripts/utils/stdin-stream.ts
 */
import { describe, it, expect } from 'vitest';
import { PassThrough, Readable } from 'stream';
import { takeFirstJsonObject, streamJsonObjects } from '../utils/stdin-stream.js';

async function collect(stream: NodeJS.ReadableStream): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const obj of streamJsonObjects(stream)) out.push(obj);
  return out;
}

describe('takeFirstJsonObject', () => {
  it('returns null while the object is incomplete', () => {
    expect(takeFirstJsonObject('{"a":1')).toBeNull();
    expect(takeFirstJsonObject('')).toBeNull();
    expect(takeFirstJsonObject('   ')).toBeNull();
  });

  it('parses a single complete object and reports no remainder', () => {
    expect(takeFirstJsonObject('{"a":1}')).toEqual({ value: { a: 1 }, rest: '' });
  });

  it('parses the first object and returns the trailing remainder', () => {
    expect(takeFirstJsonObject('{"a":1}{"b":2}')).toEqual({
      value: { a: 1 },
      rest: '{"b":2}',
    });
  });

  it('ignores braces inside string values', () => {
    expect(takeFirstJsonObject('{"a":"}{"}')).toEqual({ value: { a: '}{' }, rest: '' });
  });

  it('respects escaped quotes inside strings', () => {
    expect(takeFirstJsonObject('{"a":"x\\"y"}')).toEqual({ value: { a: 'x"y' }, rest: '' });
  });

  it('skips leading whitespace/newlines before the object', () => {
    expect(takeFirstJsonObject('\n  {"a":1}\n')).toEqual({ value: { a: 1 }, rest: '\n' });
  });

  it('returns null for balanced-but-invalid JSON rather than throwing', () => {
    expect(takeFirstJsonObject('{bad}')).toBeNull();
  });
});

describe('streamJsonObjects', () => {
  it('yields one object then completes on EOF (Claude one-shot)', async () => {
    expect(await collect(Readable.from(['{"model":"x"}']))).toEqual([{ model: 'x' }]);
  });

  it('reassembles an object split across chunks', async () => {
    expect(await collect(Readable.from(['{"a":', '1}']))).toEqual([{ a: 1 }]);
  });

  it('yields multiple newline-delimited objects from one stream', async () => {
    expect(await collect(Readable.from(['{"a":1}\n{"b":2}']))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('emits each object as it completes WITHOUT waiting for EOF (agy streaming)', async () => {
    const pass = new PassThrough();
    const gen = streamJsonObjects(pass);

    const first = gen.next();
    pass.write('{"a":1}');
    expect((await first).value).toEqual({ a: 1 });

    const second = gen.next();
    pass.write('{"b":2}');
    expect((await second).value).toEqual({ b: 2 });

    pass.end();
    expect((await gen.next()).done).toBe(true);
  });

  it('reassembles a multi-byte character split across chunk boundaries', async () => {
    const full = Buffer.from('{"x":"café"}', 'utf8'); // 'é' = 0xC3 0xA9
    const splitAt = full.length - 3; // mid-way through the 'é' bytes
    const chunks = [full.subarray(0, splitAt), full.subarray(splitAt)];
    expect(await collect(Readable.from(chunks))).toEqual([{ x: 'café' }]);
  });

  it('skips a balanced-but-invalid object and still yields the following valid one (no wedge)', async () => {
    expect(await collect(Readable.from(['{bad}{"b":2}']))).toEqual([{ b: 2 }]);
  });

  it('keeps streaming after a malformed object arrives mid-stream (agy stays alive)', async () => {
    const pass = new PassThrough();
    const gen = streamJsonObjects(pass);

    const first = gen.next();
    pass.write('{bad}{"a":1}'); // bad object must not freeze the stream
    expect((await first).value).toEqual({ a: 1 });

    const second = gen.next();
    pass.write('{"b":2}');
    expect((await second).value).toEqual({ b: 2 });

    pass.end();
    expect((await gen.next()).done).toBe(true);
  });
});
