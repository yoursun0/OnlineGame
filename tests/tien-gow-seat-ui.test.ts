import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHand, fillHands, getTile, projectView, wenId } from '@playroom/tien-gow';
import { TienGowBoard } from '../app/tien-gow-board';
import {
  tienGowSeatWind,
  tienGowViewportLayout,
  TGW_SEAT_WIND_EN,
  TGW_SEAT_WIND_ZH,
} from '../app/tien-gow-seats';

const members = [
  { guest_id: 'south', display_name: 'aa', seat: 0, is_cpu: false },
  { guest_id: 'cpu-east', display_name: 'CPU', seat: 1, is_cpu: true },
  { guest_id: 'cpu-north', display_name: 'CPU', seat: 2, is_cpu: true },
  { guest_id: 'west', display_name: 'bb', seat: 3, is_cpu: false },
];

function regionOf(html: string, region: string) {
  const match = html.match(new RegExp(
    `<div class="tgw-seat [^"]*" data-seat="(\\d)" data-region="${region}"`,
  ));
  expect(match?.[1]).toBeDefined();
  return Number(match![1]);
}

function seatBlock(html: string, region: string) {
  const start = html.search(new RegExp(`<div class="tgw-seat [^"]*" data-seat="\\d" data-region="${region}"`));
  expect(start).toBeGreaterThanOrEqual(0);
  const from = html.indexOf('>', start);
  const end = html.indexOf('</div>', from);
  return html.slice(from, end);
}

function renderBoard(viewerSeat: number, language: 'en' | 'zh-Hant', state = sampleState()) {
  return renderToStaticMarkup(createElement(TienGowBoard, {
    view: projectView(state, viewerSeat),
    members,
    onMove: () => {},
    disabled: true,
    language,
  }));
}

function sampleState() {
  const hands = fillHands([
    [wenId('bandeng', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('di', 0), wenId('tian', 0), wenId('tian', 1)],
    [wenId('lingren', 0), wenId('gaojiao', 0), wenId('pingfeng', 0), wenId('lingren', 1), wenId('gaojiao', 1), wenId('di', 1), wenId('ren', 1), wenId('he', 1)],
    undefined,
    [wenId('meihua', 0), wenId('meihua', 1), wenId('changsan', 1), wenId('bandeng', 1), wenId('futou', 1), wenId('pingfeng', 1)],
  ]);
  return createHand({ seed: 'tgw-seat-ui', table: { examples: false }, bankerSeat: 0, hands });
}

test('absolute TGW seats stay 0=南 1=東 2=北 3=西 counterclockwise', () => {
  expect(TGW_SEAT_WIND_ZH).toEqual(['南', '東', '北', '西']);
  expect(TGW_SEAT_WIND_EN).toEqual(['South', 'East', 'North', 'West']);
  expect([0, 1, 2, 3].map((seat) => tienGowSeatWind(seat, 'en'))).toEqual(['South', 'East', 'North', 'West']);
});

test('West viewerSeat puts West at the bottom, North left, East top, South right', () => {
  expect(tienGowViewportLayout(3).map((slot) => [slot.region, slot.seat, TGW_SEAT_WIND_EN[slot.seat]])).toEqual([
    ['bottom', 3, 'West'],
    ['right', 0, 'South'],
    ['top', 1, 'East'],
    ['left', 2, 'North'],
  ]);
  expect(tienGowViewportLayout(3).map((slot) => slot.place)).toEqual(['south', 'east', 'north', 'west']);
});

test('each viewerSeat sits at the bottom and the table stays counterclockwise', () => {
  expect(tienGowViewportLayout(0).map((slot) => slot.seat)).toEqual([0, 1, 2, 3]);
  expect(tienGowViewportLayout(1).map((slot) => [slot.region, slot.seat])).toEqual([
    ['bottom', 1],
    ['right', 2],
    ['top', 3],
    ['left', 0],
  ]);
  expect(tienGowViewportLayout(2).map((slot) => slot.seat)).toEqual([2, 3, 0, 1]);
});

test('West Playroom table labels regions 西/北/東/南 and marks You on the bottom seat', () => {
  const en = renderBoard(3, 'en');
  expect(regionOf(en, 'bottom')).toBe(3);
  expect(regionOf(en, 'left')).toBe(2);
  expect(regionOf(en, 'top')).toBe(1);
  expect(regionOf(en, 'right')).toBe(0);
  expect(seatBlock(en, 'bottom')).toContain('West');
  expect(seatBlock(en, 'bottom')).toContain('You');
  expect(seatBlock(en, 'left')).toContain('North');
  expect(seatBlock(en, 'top')).toContain('East');
  expect(seatBlock(en, 'right')).toContain('South');
  expect(seatBlock(en, 'left')).not.toContain('You');

  const zh = renderBoard(3, 'zh-Hant');
  expect(seatBlock(zh, 'bottom')).toContain('西');
  expect(seatBlock(zh, 'bottom')).toContain('你');
  expect(seatBlock(zh, 'left')).toContain('北');
  expect(seatBlock(zh, 'top')).toContain('東');
  expect(seatBlock(zh, 'right')).toContain('南');
});

test('two viewers see different bottom seats', () => {
  const south = renderBoard(0, 'en');
  const west = renderBoard(3, 'en');
  expect(regionOf(south, 'bottom')).toBe(0);
  expect(seatBlock(south, 'bottom')).toContain('South');
  expect(regionOf(west, 'bottom')).toBe(3);
  expect(seatBlock(west, 'bottom')).toContain('West');
  expect(south).toContain('data-viewer-seat="0"');
  expect(west).toContain('data-viewer-seat="3"');
});

test('Playroom DOM does not leak other hidden hands', () => {
  const state = sampleState();
  const html = renderBoard(3, 'en', state);
  expect(html).toContain(getTile(wenId('meihua', 0)).label);

  const publicIds = new Set([
    ...state.hands[3],
    ...state.dongPublic.flat(),
    ...state.trick?.plays.flatMap((play) => play.type === 'dump' ? [] : play.tiles) ?? [],
  ]);
  for (const seat of [0, 1, 2]) {
    for (const tile of state.hands[seat]) {
      if (publicIds.has(tile)) continue;
      expect(html).not.toContain(tile);
      const label = getTile(tile).label;
      const ownHasLabel = state.hands[3].some((id) => getTile(id).label === label);
      if (!ownHasLabel) expect(html).not.toContain(`>${label}<`);
    }
  }
  expect(html).not.toContain('view.hands');
  for (const region of ['bottom', 'right', 'top', 'left'] as const) {
    expect(seatBlock(html, region)).not.toContain('tgw-bone');
  }
});

test('the playroom board maps seats from viewerSeat and never mounts other hands', async () => {
  const board = await readFile(new URL('../app/tien-gow-board.tsx', import.meta.url), 'utf8');
  expect(board).toContain('tienGowViewportLayout(view.seat)');
  expect(board).toContain('data-region={region}');
  expect(board).toContain('view.hand');
  expect(board).not.toContain('view.hands');
  expect(board).not.toContain('state.hands');
  expect(board).not.toContain('god');
});
