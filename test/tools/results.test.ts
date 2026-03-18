import { describe, it, expect } from 'vitest';
import {
  textResult,
  jsonResult,
  jsonResultWithUi,
  safeResult,
} from '../../src/tools/results';

describe('textResult', () => {
  it('creates text content result', () => {
    const result = textResult('hello world');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: 'text', text: 'hello world' });
    expect(result.isError).toBeUndefined();
  });

  it('creates error result when isError is true', () => {
    const result = textResult('error message', true);
    expect(result.content[0].text).toBe('error message');
    expect(result.isError).toBe(true);
  });

  it('creates non-error result when isError is false', () => {
    const result = textResult('ok', false);
    expect(result.isError).toBe(false);
  });
});

describe('jsonResult', () => {
  it('creates JSON result from object', () => {
    const result = jsonResult({ foo: 'bar' });
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ foo: 'bar' });
  });

  it('includes metadata when provided', () => {
    const result = jsonResult(
      { items: [1, 2, 3] },
      { truncated: true, total_size: 100 },
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data).toEqual({ items: [1, 2, 3] });
    expect(parsed.truncated).toBe(true);
    expect(parsed.total_size).toBe(100);
  });

  it('formats JSON with indentation', () => {
    const result = jsonResult({ a: 1 });
    expect(result.content[0].text).toContain('\n');
  });
});

describe('jsonResultWithUi', () => {
  it('creates result with structuredContent', () => {
    const result = jsonResultWithUi({ name: 'test' });
    expect(result.structuredContent).toEqual({ name: 'test' });
  });

  it('includes metadata in structuredContent when provided', () => {
    const result = jsonResultWithUi({ items: [1, 2] }, { truncated: true });
    expect(result.structuredContent).toEqual({
      items: [1, 2],
      truncated: true,
    });
  });
});

describe('safeResult', () => {
  it('returns text content under 4MB', () => {
    const result = safeResult('small text');
    expect(result.content[0]).toEqual({ type: 'text', text: 'small text' });
  });

  it('truncates text over 4MB', () => {
    const longText = 'a'.repeat(5 * 1024 * 1024);
    const result = safeResult(longText);
    expect(result.content[0].text.length).toBeLessThan(longText.length);
    expect(result.content[0].text).toContain('[TRUNCATED');
  });

  it('preserves isError flag', () => {
    expect(safeResult('error', true).isError).toBe(true);
    expect(safeResult('ok', false).isError).toBe(false);
    expect(safeResult('neutral').isError).toBeUndefined();
  });
});
