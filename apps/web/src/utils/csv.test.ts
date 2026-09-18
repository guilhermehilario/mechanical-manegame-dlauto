import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('joins cells with ";" and rows with CRLF', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a;b\r\nc;d');
  });

  it('quotes cells containing the delimiter, quotes or newlines', () => {
    expect(toCsv([['a;b']])).toBe('"a;b"');
    expect(toCsv([['a"b']])).toBe('"a""b"');
    expect(toCsv([['a\nb']])).toBe('"a\nb"');
  });

  it('leaves simple cells untouched', () => {
    expect(toCsv([['1.234,56', 'Pix']])).toBe('1.234,56;Pix');
  });
});
