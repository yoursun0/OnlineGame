import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WellHudBar,
  wellHudAriaLabel,
  wellHudDepthUnit,
  wellHudSeatLabel,
  wellHudSeatsFromKids,
} from '../app/well-hud-bar';

test('seat labels stay P1–P4 and seatsFromKids never pads missing kids', () => {
  expect(wellHudSeatLabel(0)).toBe('P1');
  expect(wellHudSeatLabel(3)).toBe('P4');

  const solo = wellHudSeatsFromKids([{ life: 12, best: 4 }]);
  expect(solo).toHaveLength(1);
  expect(solo[0]).toEqual({ label: 'P1', life: 12, floor: 4, tone: 0 });

  const pair = wellHudSeatsFromKids([{ life: 11 }, { life: 7, best: 2 }]);
  expect(pair).toHaveLength(2);
  expect(pair.map((seat) => seat.label)).toEqual(['P1', 'P2']);
  expect(pair[1]).toEqual({ label: 'P2', life: 7, floor: 2, tone: 1 });
});

test('center depth copy is 層 / floors (warn-style pause is optional)', () => {
  expect(wellHudDepthUnit('zh-Hant')).toBe('層');
  expect(wellHudDepthUnit('en')).toBe('floors');
  expect(wellHudDepthUnit('zh-Hant', true)).toBe('暫停');
  expect(wellHudDepthUnit('en', true)).toBe('Paused');
  expect(wellHudAriaLabel(16, 'zh-Hant')).toBe('井深 16層');
  expect(wellHudAriaLabel(16, 'en')).toBe('Well depth 16 floors');
});

test('solo HudBar is P1 + center depth + 92px spacer (no empty P2 bar)', () => {
  const html = renderToStaticMarkup(createElement(WellHudBar, {
    seats: wellHudSeatsFromKids([{ life: 9, best: 3 }]),
    depth: 5,
    language: 'en',
  }));
  expect(html).toContain('data-seats="1"');
  expect(html).toContain('P1 · 3 floors');
  expect(html).toContain('class="well-hud-depth"');
  expect(html).toContain('>5<');
  expect(html).toContain('floors');
  expect(html).toContain('class="well-hud-spacer"');
  expect(html).not.toContain('P2');
  expect(html).not.toContain('P3');
  expect(html).not.toContain('P4');
  expect(html.match(/class="well-life-block"/g)?.length).toBe(1);
});

test('shared 2-kid HudBar is P1 | depth | P2 with per-seat tones and no P3/P4', () => {
  const html = renderToStaticMarkup(createElement(WellHudBar, {
    seats: wellHudSeatsFromKids([
      { life: 12, best: 1 },
      { life: 4, best: 8 },
    ]),
    depth: 10,
    language: 'zh-Hant',
  }));
  expect(html).toContain('data-seats="2"');
  expect(html).toContain('P1 · 1層');
  expect(html).toContain('P2 · 8層');
  expect(html).toContain('data-tone="0"');
  expect(html).toContain('data-tone="1"');
  expect(html).toContain('is-right');
  expect(html).toContain('aria-label="井深 10層"');
  expect(html).toContain('>10<');
  expect(html).toContain('層');
  expect(html).not.toContain('class="well-hud-spacer"');
  expect(html).not.toContain('P3');
  expect(html).not.toContain('P4');
  expect(html.match(/well-life-block/g)?.length).toBe(2);
});

test('3 kids add a second row with P3 + spacer; 4 kids fill P4', () => {
  const three = renderToStaticMarkup(createElement(WellHudBar, {
    seats: wellHudSeatsFromKids([
      { life: 12 },
      { life: 10 },
      { life: 0, best: 6 },
    ]),
    depth: 6,
    language: 'en',
  }));
  expect(three).toContain('data-seats="3"');
  expect(three).toContain('P3 · 6 floors');
  expect(three).toContain('data-tone="2"');
  expect(three).toContain('class="well-hud-spacer"');
  expect(three).not.toContain('P4');

  const four = renderToStaticMarkup(createElement(WellHudBar, {
    seats: wellHudSeatsFromKids([
      { life: 12 },
      { life: 11 },
      { life: 10 },
      { life: 8, best: 2 },
    ]),
    depth: 2,
    language: 'en',
  }));
  expect(four).toContain('data-seats="4"');
  expect(four).toContain('P4 · 2 floors');
  expect(four).toContain('data-tone="3"');
  expect(four).not.toContain('class="well-hud-spacer"');
});

test('downstairs well drives HudBar from engine/checkpoint kids (no fake peers)', async () => {
  const well = await readFile(new URL('../app/downstairs-well.tsx', import.meta.url), 'utf8');
  expect(well).toContain("from './well-hud-bar'");
  expect(well).toContain('<WellHudBar');
  expect(well).toContain('wellHudSeatsFromKids');
  expect(well).toContain('engine.players');
  expect(well).not.toContain("label={zh ? '生命' : 'Life'}");
  expect(well).not.toContain("{shared && <span>{zh ? '共用井' : 'Shared'}</span>}");
});

test('PLAYROOM CSS has HudBar row, 92px spacer, and large center depth', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('.well-hud-bar');
  expect(css).toContain('.well-hud-row');
  expect(css).toContain('.well-hud-spacer { width: 92px; flex: 0 0 92px; }');
  expect(css).toContain('.well-hud-depth');
  expect(css).toContain('font-variant-numeric: tabular-nums');
});
