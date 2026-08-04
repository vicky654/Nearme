import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../../src/utils/sanitize';

describe('sanitizeText', () => {
  it('strips HTML tags from the input', () => {
    expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('Hello');
  });

  it('strips tags but keeps their inner text', () => {
    expect(sanitizeText('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  plain text  ')).toBe('plain text');
  });

  it('leaves plain text without markup unchanged', () => {
    expect(sanitizeText('Just a normal bio')).toBe('Just a normal bio');
  });

  it('does not double-escape an ampersand into &amp;', () => {
    expect(sanitizeText('Tom & Jerry')).toBe('Tom & Jerry');
  });

  it('still strips tags after decoding entities', () => {
    expect(sanitizeText('<script>x</script>hi')).toBe('hi');
  });

  it('decodes lt/gt entities produced by escaping raw angle brackets in text', () => {
    expect(sanitizeText('5 < 10 and 10 > 5')).toBe('5 < 10 and 10 > 5');
  });
});
