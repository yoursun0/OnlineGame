import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WellLifeBlock } from '../app/well-life-block';

test('Game Over HUD reuses WellHudBar LifeBlocks (not plain 生命 N / 樓層 N) and keeps reason + Replay', async () => {
  const well = await readFile(new URL('../app/downstairs-well.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  expect(well.includes("from './well-hud-bar'")).toBe(true);
  expect(well.includes('well-hud-over')).toBe(true);
  expect(well.includes('<WellHudBar')).toBe(true);
  expect(well.includes('seats={hud.seats}')).toBe(true);
  expect(well.includes('depth={hud.depth}')).toBe(true);
  expect(well.includes('className="well-over"')).toBe(true);
  expect(well.includes("zh ? '重玩一次' : 'Replay'")).toBe(true);
  expect(well.includes('onReplay')).toBe(true);
  expect(well.includes("{over ? (\n          <>\n            <span>{zh ? '生命' : 'Life'} {life}</span>")).toBe(false);
  expect(well.includes("<span>{zh ? '樓層' : 'Floors'} {depth}</span>")).toBe(false);

  expect(css.includes('.well-hud-over')).toBe(true);
  expect(css.includes('.well-hud-over .well-over')).toBe(true);
});

test('WellLifeBlock at life 0 still shows floor and empty meter for Game Over', () => {
  const html = renderToStaticMarkup(
    createElement(WellLifeBlock, {
      label: '生命',
      life: 0,
      floor: 16,
      language: 'zh-Hant',
    }),
  );
  expect(html).toContain('role="meter"');
  expect(html).toContain('aria-valuenow="0"');
  expect(html).toContain('16層');
  expect(html).not.toContain('is-filled');
});
