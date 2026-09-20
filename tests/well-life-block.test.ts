import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WELL_LIFE_SEGMENTS,
  WellLifeBlock,
  clampWellLife,
  wellLifeAriaLabel,
  wellLifeFloorText,
} from '../app/well-life-block';

test('well life uses 12 segments matching MAX_LIFE', () => {
  expect(WELL_LIFE_SEGMENTS).toBe(12);
});

test('clampWellLife fills 0 and 12 at the ends and rejects out of range', () => {
  expect(clampWellLife(0)).toBe(0);
  expect(clampWellLife(12)).toBe(12);
  expect(clampWellLife(7)).toBe(7);
  expect(clampWellLife(-3)).toBe(0);
  expect(clampWellLife(99)).toBe(12);
  expect(clampWellLife(Number.NaN)).toBe(0);
  expect(clampWellLife(4.2)).toBe(5);
});

test('floor unit stays clear in zh-Hant and English', () => {
  expect(wellLifeFloorText(3, 'zh-Hant')).toBe('3層');
  expect(wellLifeFloorText(3, 'en')).toBe('3 floors');
  expect(wellLifeAriaLabel('生命', 7, 3, 'zh-Hant')).toBe('生命 7，3層');
  expect(wellLifeAriaLabel('Life', 7, 3, 'en')).toBe('Life 7, 3 floors');
});

test('WellLifeBlock renders 12 segments with filled count equal to life', () => {
  const empty = renderToStaticMarkup(createElement(WellLifeBlock, {
    label: 'Life',
    life: 0,
    floor: 0,
    language: 'en',
  }));
  expect(empty).toContain('role="meter"');
  expect(empty).toContain('aria-valuenow="0"');
  expect(empty).toContain('aria-valuemax="12"');
  expect(empty).toContain('Life · 0 floors');
  expect(empty.match(/class="well-life-seg"/g)?.length).toBe(12);
  expect(empty).not.toContain('is-filled');

  const full = renderToStaticMarkup(createElement(WellLifeBlock, {
    label: '生命',
    life: 12,
    floor: 8,
    language: 'zh-Hant',
  }));
  expect(full).toContain('生命 · 8層');
  expect(full).toContain('aria-valuenow="12"');
  expect(full.match(/class="well-life-seg is-filled"/g)?.length).toBe(12);

  const mid = renderToStaticMarkup(createElement(WellLifeBlock, {
    label: 'Life',
    life: 5,
    floor: 2,
    language: 'en',
  }));
  expect(mid.match(/class="well-life-seg is-filled"/g)?.length).toBe(5);
  expect(mid.match(/class="well-life-seg"/g)?.length).toBe(7);
  expect(mid).toContain('aria-label="Life 5, 2 floors"');
});

test('downstairs HUD uses WellHudBar (WellLifeBlock via seats) for in-run and Game Over', async () => {
  const well = await readFile(new URL('../app/downstairs-well.tsx', import.meta.url), 'utf8');
  expect(well).toContain("from './well-hud-bar'");
  expect(well).toContain('<WellHudBar');
  expect(well).toContain('seats={hud.seats}');
  expect(well).toContain('depth={hud.depth}');
  expect(well).toContain('well-hud-over');
  expect(well).toContain('className="well-over"');
  expect(well).not.toContain("<span>{zh ? '生命' : 'Life'} {life}</span>");
  expect(well).not.toContain("<span>{zh ? '樓層' : 'Floors'} {depth}</span>");
});

test('PLAYROOM CSS copies prototype LifeBlock tokens and size', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('--color-surface-2: #164a78');
  expect(css).toContain('--color-p1: #e0b03a');
  expect(css).toContain('--color-hp: #3ec86a');
  expect(css).toContain('.well-life-block { width: 92px; flex: 0 0 92px; }');
  expect(css).toContain('height: 12px');
  expect(css).toContain('border-radius: 1px');
  expect(css).toContain('gap: 2px');
  expect(css).toContain('background: var(--color-surface-2)');
  expect(css).toContain('background: var(--well-life-fill, var(--color-hp))');
});
