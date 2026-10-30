import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChoice, resolveTheme, THEME_KEY } from '../src/lib/theme';

const css = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

describe('theme choice', () => {
  it('defaults to system for anything unrecognised', () => {
    for (const value of [null, undefined, '', 'blue', 1]) expect(parseChoice(value)).toBe('system');
    expect(parseChoice('light')).toBe('light');
    expect(parseChoice('dark')).toBe('dark');
  });
  it('system follows the device; light and dark ignore it', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('the pre-paint script in index.html reads the same key', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`);
    expect(html.indexOf('dataset.theme')).toBeLessThan(html.indexOf('/src/main.tsx'));
  });
});

describe('dark palette', () => {
  const theme = css('theme.css');
  const dark = theme.slice(theme.indexOf(":root[data-theme='dark']"));
  const light = theme.slice(0, theme.indexOf(":root[data-theme='dark']"));
  it('defines every token the light theme adds', () => {
    for (const [, token] of light.matchAll(/(--[\w-]+):/g)) expect(dark, token).toContain(`${token}:`);
  });
  it('redefines the core surface, text and line tokens', () => {
    for (const token of ['--ground', '--surface', '--raised', '--ink', '--ink-2', '--ink-3', '--line', '--line-strong', '--accent', '--shadow-1', '--shadow-2']) expect(dark, token).toContain(`${token}:`);
  });
  it('text on surfaces uses the accessible accent, not the fill', () => {
    for (const name of ['styles.css', 'workspaces.css', 'brand.css', 'portion.css', 'journeys.css']) expect(css(name), name).not.toMatch(/(?<![-\w])color:\s*var\(--accent(-strong)?\)/);
  });
});
