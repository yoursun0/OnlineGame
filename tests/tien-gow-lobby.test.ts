import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createHand } from '@playroom/tien-gow';
import { translateError } from '../app/language';
import { roomHeadline } from '../app/room-headline';
import { canHostStartRoom } from '../app/room-start';
import {
  assignTienGowSeats,
  fillTienGowCpuSeats,
  tienGowLobbySlots,
  tienGowSeatWind,
  TGW_SEAT_COUNT,
  TGW_SEAT_WIND_ZH,
} from '../app/tien-gow-seats';

test('filling a TGW table with one human adds three CPU seats', () => {
  const filled = fillTienGowCpuSeats([{ id: 'host' }], (index) => ({ id: `cpu-${index}` }));
  expect(filled).toHaveLength(TGW_SEAT_COUNT);
  expect(filled.map((member) => member.id)).toEqual(['host', 'cpu-0', 'cpu-1', 'cpu-2']);
});

test('filling a TGW table with four humans adds no CPU seats', () => {
  const humans = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  expect(fillTienGowCpuSeats(humans, () => ({ id: 'cpu' }))).toEqual(humans);
});

test('seeded TGW seat assignment is a stable permutation of 0–3', () => {
  const members = fillTienGowCpuSeats(
    [{ id: 'host' }, { id: 'guest' }],
    (index) => ({ id: `cpu-${index}` }),
  );
  const first = assignTienGowSeats(members, 'tgw-seed-a');
  const second = assignTienGowSeats(members, 'tgw-seed-a');
  expect(first.map((member) => `${member.seat}:${member.id}`)).toEqual(
    second.map((member) => `${member.seat}:${member.id}`),
  );
  expect(new Set(first.map((member) => member.seat))).toEqual(new Set([0, 1, 2, 3]));
  expect(first.map((member) => member.id).sort()).toEqual(['cpu-0', 'cpu-1', 'guest', 'host']);

  const other = assignTienGowSeats(members, 'tgw-seed-b');
  expect(other.map((member) => member.id)).not.toEqual(first.map((member) => member.id));
});

test('absolute TGW seats are 南/東/北/西 counterclockwise (lab order)', () => {
  expect(TGW_SEAT_WIND_ZH).toEqual(['南', '東', '北', '西']);
  expect(tienGowSeatWind(0, 'zh-Hant')).toBe('南');
  expect(tienGowSeatWind(1, 'en')).toBe('East');
  expect(tienGowSeatWind(2, 'zh-Hant')).toBe('北');
  expect(tienGowSeatWind(3, 'en')).toBe('West');
});

test('the TGW lobby always shows four seat slots, with empty seats marked for CPU fill', () => {
  const slots = tienGowLobbySlots([
    { seat: 0, is_cpu: false, id: 'host' },
    { seat: 1, is_cpu: false, id: 'guest' },
  ]);
  expect(slots.map((slot) => [slot.seat, slot.occupied, slot.member?.id ?? null])).toEqual([
    [0, true, 'host'],
    [1, true, 'guest'],
    [2, false, null],
    [3, false, null],
  ]);
});

test('a solo TGW host can start; two humans must both be ready', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: false }],
    maxPlayers: 4,
    gameSlug: 'tien-gow',
  })).toBe(true);
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: false }],
    maxPlayers: 4,
    gameSlug: 'tien-gow',
  })).toBe(false);
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }],
    maxPlayers: 4,
    gameSlug: 'tien-gow',
  })).toBe(true);
});

test('a TGW table of four ready humans can start', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }, { is_ready: true }, { is_ready: true }],
    maxPlayers: 4,
    gameSlug: 'tien-gow',
  })).toBe(true);
});

test('a playing TGW room names the seat to act, not a tic-tac-toe turn', () => {
  const hand = createHand({ seed: 'tgw:TGW-4K8', table: { examples: false }, bankerSeat: 0 });
  const members = [
    { seat: 0, display_name: 'aa' },
    { seat: 1, display_name: 'CPU' },
    { seat: 2, display_name: 'CPU' },
    { seat: 3, display_name: 'CPU' },
  ];
  expect(roomHeadline({
    status: 'playing',
    state: hand,
    members,
    language: 'en',
    gameSlug: 'tien-gow',
  })).toBe('Turn: South · aa');
  expect(roomHeadline({
    status: 'playing',
    state: hand,
    members,
    language: 'zh-Hant',
    gameSlug: 'tien-gow',
  })).toBe('輪到: 南 · aa');
});

test('traditional chinese names the 1–4 human start rule', () => {
  expect(translateError('A 打天九 table needs 1–4 humans.', 'zh-Hant')).toBe('打天九一桌需要 1 至 4 位玩家。');
});

test('start_room fills empty TGW seats with CPU and shuffles 0–3', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260920000300_tien_gow_lobby_cpu_seats.sql', import.meta.url), 'utf8');
  expect(sql).toContain("v_room.game_slug = 'tien-gow'");
  expect(sql).toContain('A 打天九 table needs 1–4 humans.');
  expect(sql).toContain('is_cpu');
  expect(sql).toContain("display_name, seat, is_ready, is_cpu");
  expect(sql).toContain('order by random()');
  expect(sql).toContain('new_seat');
  expect(sql).toContain("v_room.game_slug <> 'tien-gow'");
});

test('the playroom client shows four TGW winds and CPU-on-start empty seats', async () => {
  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  expect(client).toContain('tienGowLobbySlots');
  expect(client).toContain('tienGowSeatWind');
  expect(client).toContain('cpuAtStart');
  expect(client).toContain('empty seats become CPU');
  expect(client).not.toContain('Play starts in a later update');
});

test('the room start API deals a TGW hand and no longer blocks start', async () => {
  const route = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  expect(route).not.toContain("normalizedCode.startsWith('TGW-')");
  expect(route).not.toContain('打天九 cannot start yet.');
  expect(route).toContain("dealPlayroomHand");
  expect(route).toContain("started.room.game_slug === 'tien-gow'");
});

test('TGW seat marks have four distinct colours', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('.player-mark-2');
  expect(css).toContain('.player-mark-3');
  expect(css).toContain('.player-row-empty');
});
