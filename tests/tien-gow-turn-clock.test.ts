import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHand, fillHands, projectView, wenId } from '@playroom/tien-gow';
import { drainTienGowCpuState } from '../app/api/_lib/tien-gow-room';
import { TienGowBoard } from '../app/tien-gow-board';
import {
  TGW_HUMAN_TURN_MS,
  formatTienGowTurnRemaining,
  tienGowTurnActor,
  tienGowTurnClockCopy,
  tienGowTurnClockKey,
  tienGowTurnClockState,
  tienGowTurnClockView,
} from '../app/tien-gow-turn-clock';

const members = [
  { guest_id: 'south', display_name: 'aa', seat: 0, is_cpu: false },
  { guest_id: 'cpu-east', display_name: 'CPU', seat: 1, is_cpu: true },
  { guest_id: 'cpu-north', display_name: 'CPU', seat: 2, is_cpu: true },
  { guest_id: 'west', display_name: 'bb', seat: 3, is_cpu: false },
];

const oneHumanThreeCpu = [
  { guest_id: 'human', seat: 0, is_cpu: false },
  { guest_id: 'cpu-1', seat: 1, is_cpu: true },
  { guest_id: 'cpu-2', seat: 2, is_cpu: true },
  { guest_id: 'cpu-3', seat: 3, is_cpu: true },
];

function sampleState(bankerSeat = 0) {
  const hands = fillHands([
    [wenId('bandeng', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('di', 0), wenId('tian', 0), wenId('tian', 1)],
    [wenId('lingren', 0), wenId('gaojiao', 0), wenId('pingfeng', 0), wenId('lingren', 1), wenId('gaojiao', 1), wenId('di', 1), wenId('ren', 1), wenId('he', 1)],
    undefined,
    [wenId('meihua', 0), wenId('meihua', 1), wenId('changsan', 1), wenId('bandeng', 1), wenId('futou', 1), wenId('pingfeng', 1)],
  ]);
  return createHand({ seed: 'tgw-clock', table: { examples: false }, bankerSeat, hands });
}

function renderBoard({
  viewerSeat,
  language,
  disabled,
  isHost,
  clockNow,
  clockStartedAt,
  bankerSeat = 0,
}: {
  viewerSeat: number;
  language: 'en' | 'zh-Hant';
  disabled: boolean;
  isHost?: boolean;
  clockNow: number;
  clockStartedAt: number;
  bankerSeat?: number;
}) {
  return renderToStaticMarkup(createElement(TienGowBoard, {
    view: projectView(sampleState(bankerSeat), viewerSeat),
    members,
    onMove: () => {},
    disabled,
    language,
    isHost,
    clockNow,
    clockStartedAt,
  }));
}

test('human turn deadline is a 60–90s configurable constant', () => {
  expect(TGW_HUMAN_TURN_MS).toBeGreaterThanOrEqual(60_000);
  expect(TGW_HUMAN_TURN_MS).toBeLessThanOrEqual(90_000);
});

test('human toAct is counting before the deadline and warn after — never idle-out', () => {
  expect(tienGowTurnActor('lead', 0, members)).toEqual({ kind: 'human', seat: 0 });
  expect(tienGowTurnClockState({ kind: 'human', now: 0, startedAt: 0 })).toBe('counting');
  expect(tienGowTurnClockState({ kind: 'human', now: TGW_HUMAN_TURN_MS - 1, startedAt: 0 })).toBe('counting');
  expect(tienGowTurnClockState({ kind: 'human', now: TGW_HUMAN_TURN_MS, startedAt: 0 })).toBe('warn');
  expect(tienGowTurnClockState({ kind: 'human', now: TGW_HUMAN_TURN_MS * 4, startedAt: 0 })).toBe('warn');
});

test('CPU toAct never enters the human warn state, even after the human deadline', () => {
  expect(tienGowTurnActor('lead', 1, members)).toEqual({ kind: 'cpu', seat: 1 });
  expect(tienGowTurnClockState({ kind: 'cpu', now: TGW_HUMAN_TURN_MS * 10, startedAt: 0 })).toBe('idle');
  expect(tienGowTurnClockState({ kind: 'idle', now: TGW_HUMAN_TURN_MS * 10, startedAt: 0 })).toBe('idle');
  expect(tienGowTurnActor('recap', 0, members)).toEqual({ kind: 'idle', seat: 0 });
});

test('a new human toAct gets a new clock key so the countdown restarts', () => {
  const first = tienGowTurnClockKey({ phase: 'lead', toAct: 0, playCount: 0 });
  const afterLead = tienGowTurnClockKey({ phase: 'follow', toAct: 1, playCount: 1 });
  const backToHuman = tienGowTurnClockKey({ phase: 'follow', toAct: 0, playCount: 2 });
  expect(first).not.toBe(afterLead);
  expect(afterLead).not.toBe(backToHuman);
  expect(first).not.toBe(backToHuman);
});

test('warn copy is bilingual; host nudge does not force a play', () => {
  const ownEn = tienGowTurnClockCopy({
    language: 'en', clock: 'warn', kind: 'human', wind: 'South', isOwnTurn: true, isHost: true,
  });
  const ownZh = tienGowTurnClockCopy({
    language: 'zh-Hant', clock: 'warn', kind: 'human', wind: '南', isOwnTurn: true, isHost: false,
  });
  const hostEn = tienGowTurnClockCopy({
    language: 'en', clock: 'warn', kind: 'human', wind: 'South', isOwnTurn: false, isHost: true,
  });
  const hostZh = tienGowTurnClockCopy({
    language: 'zh-Hant', clock: 'warn', kind: 'human', wind: '南', isOwnTurn: false, isHost: true,
  });
  expect(ownEn.toast).toBe('Still your turn — the table is waiting.');
  expect(ownZh.toast).toBe('仍輪到你出牌 — 牌桌在等你。');
  expect(hostEn.nudge).toBe('South is past the turn clock. They can still play.');
  expect(hostZh.nudge).toBe('南已超過出牌時限，仍可出牌（不會代打）。');
  expect(JSON.stringify(hostEn)).not.toMatch(/auto-?play|skip|forfeit/i);
  expect(tienGowTurnClockCopy({
    language: 'en', clock: 'counting', kind: 'human', wind: 'South', isOwnTurn: true, isHost: false,
  }).toast).toBeNull();
  expect(tienGowTurnClockCopy({
    language: 'en', clock: 'warn', kind: 'cpu', wind: 'East', isOwnTurn: false, isHost: true,
  })).toEqual({ toast: null, nudge: null });
});

test('clock view keeps remaining time during counting and 0:00 on warn', () => {
  const counting = tienGowTurnClockView({
    phase: 'lead',
    toAct: 0,
    playCount: 0,
    members,
    now: 15_000,
    startedAt: 0,
    language: 'en',
    viewerSeat: 0,
    isHost: true,
    wind: 'South',
  });
  expect(counting.phase).toBe('counting');
  expect(counting.remainingLabel).toBe(formatTienGowTurnRemaining(TGW_HUMAN_TURN_MS - 15_000));
  expect(counting.toast).toBeNull();

  const warned = tienGowTurnClockView({
    phase: 'lead',
    toAct: 0,
    playCount: 0,
    members,
    now: TGW_HUMAN_TURN_MS + 2_000,
    startedAt: 0,
    language: 'en',
    viewerSeat: 0,
    isHost: true,
    wind: 'South',
  });
  expect(warned.phase).toBe('warn');
  expect(warned.remainingMs).toBe(0);
  expect(warned.toast).toBe('Still your turn — the table is waiting.');
});

test('human past deadline sees warn chrome and can still play', () => {
  const html = renderBoard({
    viewerSeat: 0,
    language: 'en',
    disabled: false,
    clockNow: TGW_HUMAN_TURN_MS + 1,
    clockStartedAt: 0,
  });
  expect(html).toContain('data-clock="warn"');
  expect(html).toContain('clock-warn');
  expect(html).toContain('Still your turn — the table is waiting.');
  expect(html).toContain('is-button');
  expect(html).toContain('Your lead');
});

test('zh-Hant warn toast appears on the acting human seat', () => {
  const html = renderBoard({
    viewerSeat: 0,
    language: 'zh-Hant',
    disabled: false,
    clockNow: TGW_HUMAN_TURN_MS,
    clockStartedAt: 0,
  });
  expect(html).toContain('data-clock="warn"');
  expect(html).toContain('仍輪到你出牌 — 牌桌在等你。');
});

test('host watching another human past the clock sees nudge copy only', () => {
  const html = renderBoard({
    viewerSeat: 3,
    language: 'en',
    disabled: true,
    isHost: true,
    clockNow: TGW_HUMAN_TURN_MS + 1,
    clockStartedAt: 0,
  });
  expect(html).toContain('data-clock="warn"');
  expect(html).toContain('South is past the turn clock. They can still play.');
  expect(html).not.toContain('Still your turn');
  expect(html).not.toContain('Play for');
});

test('CPU toAct does not show the human warn state after the human deadline', () => {
  const html = renderBoard({
    viewerSeat: 0,
    language: 'en',
    disabled: true,
    isHost: true,
    bankerSeat: 1,
    clockNow: TGW_HUMAN_TURN_MS * 8,
    clockStartedAt: 0,
  });
  expect(html).toContain('data-clock="idle"');
  expect(html).not.toContain('data-clock="warn"');
  expect(html).not.toContain('clock-warn');
  expect(html).not.toContain('Still your turn');
  expect(html).not.toContain('past the turn clock');
});

test('CPU drain still finishes without waiting the human deadline', () => {
  const state = createHand({
    seed: 'tgw-cpu-lead',
    table: { examples: false },
    bankerSeat: 1,
  });
  const started = Date.now();
  const drained = drainTienGowCpuState(state, oneHumanThreeCpu);
  expect(Date.now() - started).toBeLessThan(200);
  expect(Date.now() - started).toBeLessThan(TGW_HUMAN_TURN_MS);
  expect(drained.applied.length).toBeGreaterThan(0);
  expect(drained.state.toAct).toBe(0);
});

test('Playroom clock is warn-only chrome — no auto-move, skip, or forfeit', async () => {
  const clock = await readFile(new URL('../app/tien-gow-turn-clock.ts', import.meta.url), 'utf8');
  const board = await readFile(new URL('../app/tien-gow-board.tsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  const cpu = await readFile(new URL('../app/api/_lib/tien-gow-room.ts', import.meta.url), 'utf8');
  expect(clock).toContain('TGW_HUMAN_TURN_MS');
  expect(clock).not.toMatch(/applyMove|nextCpuMove|forfeit|skipExample/);
  expect(board).toContain('tienGowTurnClockView');
  expect(board).toContain('clock-warn');
  expect(board).toContain('data-clock');
  expect(client).toContain('isHost={snapshot.room.host_guest_id === guestId}');
  expect(cpu).not.toContain('TGW_HUMAN_TURN_MS');
  expect(cpu).not.toContain('tien-gow-turn-clock');
});
