import { describe, expect, it } from 'vitest';
import { initialDemoMode } from '../src/lib/start-mode';

describe('public demo entry', () => {
  it('opens the hosted walkthrough without a wallet or network connection', () => {
    expect(initialDemoMode('', null, 'demo')).toBe(true);
    expect(initialDemoMode('', null)).toBe(false);
  });
  it('preserves the visitor’s chosen mode and lets shared links override it', () => {
    expect(initialDemoMode('', '0', 'demo')).toBe(false);
    expect(initialDemoMode('', '1')).toBe(true);
    expect(initialDemoMode('?demo', '0')).toBe(true);
    expect(initialDemoMode('?live', '1', 'demo')).toBe(false);
  });
});
