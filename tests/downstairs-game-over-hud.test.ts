import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_LIFE } from '@playroom/downstairs';
import { FloorWidget, LifeBlock } from '../app/downstairs-hud';

test('LifeBlock is a 12-pip HP bar, empty at final life 0', () => {
  const html = renderToStaticMarkup(createElement(LifeBlock, { label: '生命', life: 0 }));
  expect(html).toContain('well-life-bar');
  expect(html).toContain('role="meter"');
  expect(html).toContain('aria-valuenow="0"');
  expect(html).toContain(`aria-valuemax="${MAX_LIFE}"`);
  expect((html.match(/well-life-pip/g) ?? []).length).toBe(MAX_LIFE);
  expect(html).not.toContain('is-on');
  expect(html).not.toContain('生命 0');
});

test('LifeBlock fills pips for remaining life', () => {
  const html = renderToStaticMarkup(createElement(LifeBlock, { label: 'Life', life: 3 }));
  expect(html).toContain('aria-valuenow="3"');
  expect((html.match(/is-on/g) ?? []).length).toBe(3);
});

test('FloorWidget shows depth as the primary figure, not 樓層 N text', () => {
  const html = renderToStaticMarkup(createElement(FloorWidget, { label: '樓層', depth: 16 }));
  expect(html).toContain('well-floor-value');
  expect(html).toContain('class="well-floor-value">16</strong>');
  expect(html).toContain('class="well-floor-label">樓層</span>');
  expect(html).not.toContain('>樓層 16<');
});

test('Game Over HUD reuses LifeBlock + FloorWidget and keeps reason + Replay', async () => {
  const well = await readFile(new URL('../app/downstairs-well.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  expect(well.includes("from './downstairs-hud'")).toBe(true);
  expect(well.includes('well-hud-over')).toBe(true);
  expect(well.includes('<LifeBlock label={zh ? \'生命\' : \'Life\'} life={life} />')).toBe(true);
  expect(well.includes('<FloorWidget label={zh ? \'樓層\' : \'Floors\'} depth={depth} />')).toBe(true);
  expect(well.includes('className="well-over"')).toBe(true);
  expect(well.includes("zh ? '重玩一次' : 'Replay'")).toBe(true);
  expect(well.includes('onReplay')).toBe(true);
  expect(well.includes('{over && <span className="well-over">{resultLabel}</span>}')).toBe(false);

  expect(css.includes('.well-hud-over')).toBe(true);
  expect(css.includes('.well-life-bar')).toBe(true);
  expect(css.includes('.well-floor')).toBe(true);
  expect(css.includes('.well-hud-over .well-over')).toBe(true);
});
