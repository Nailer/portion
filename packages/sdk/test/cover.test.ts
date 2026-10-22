import { describe, expect, it } from 'vitest';
import { generateCover } from '../src/cover';
import { MAX_DOC_BYTES } from '../src/storage';

describe('onchain cover documents', () => {
  it('keeps XML entities valid when rendering category labels', () => {
    const svg = generateCover('Cold storage', 2);
    expect(svg).toContain('FOOD &amp; AGRICULTURE');
    expect(svg).not.toContain('&AMP;');
  });
  it('is deterministic, does not embed user markup, and fits the document limit', () => {
    const name = '<script>alert("unsafe")</script>';
    for (let category = 0; category < 8; category++) {
      const svg = generateCover(name, category);
      expect(svg).toBe(generateCover(name, category));
      expect(svg).not.toContain('<script');
      expect(new TextEncoder().encode(svg).length).toBeLessThan(MAX_DOC_BYTES);
    }
  });
});
