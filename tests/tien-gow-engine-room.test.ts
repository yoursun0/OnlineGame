import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  applyMove,
  createHand,
  nextCpuMove,
  projectView,
  validateMove,
  DEFAULT_TABLE,
} from '@playroom/tien-gow';
import { snapshotAfterCpuTurn, type CpuMember } from '../app/api/_lib/apply-cpu-turn';
import {
  drainTienGowCpuState,
  isTienGowView,
  parseTienGowMove,
  pendingTienGowCpuSeat,
  projectTienGowSnapshot,
  publicTienGowMovePayload,
  TGW_CPU_DRAIN_CAP,
} from '../app/api/_lib/tien-gow-room';
import { translateError } from '../app/language';
import { roomHeadline } from '../app/room-headline';

const oneHumanThreeCpu: CpuMember[] = [
  { guest_id: 'human', seat: 0, is_cpu: false },
  { guest_id: 'cpu-1', seat: 1, is_cpu: true },
  { guest_id: 'cpu-2', seat: 2, is_cpu: true },
  { guest_id: 'cpu-3', seat: 3, is_cpu: true },
];

const twoHumanTwoCpu: CpuMember[] = [
  { guest_id: 'west', seat: 3, is_cpu: false },
  { guest_id: 'south', seat: 0, is_cpu: false },
  { guest_id: 'cpu-east', seat: 1, is_cpu: true },
  { guest_id: 'cpu-north', seat: 2, is_cpu: true },
];

function hiddenTilesFor(state: ReturnType<typeof createHand>, seat: number, viewerSeat: number) {
  const publicTiles = new Set([
    ...state.hands[viewerSeat],
    ...state.dongPublic.flat(),
    ...state.trick?.plays.flatMap((play) => play.type === 'dump' ? [] : play.tiles) ?? [],
  ]);
  return state.hands[seat].filter((tile) => !publicTiles.has(tile));
}

test('1H+3CPU drain + human replies finishes a hand', () => {
  let state = createHand({
    seed: 'tgw-room-1h',
    table: { ...DEFAULT_TABLE, examples: false },
    bankerSeat: 0,
  });
  let guard = 0;
  while (state.phase !== 'recap' && guard < 400) {
    const drained = drainTienGowCpuState(state, oneHumanThreeCpu);
    state = drained.state;
    if (state.phase === 'recap') break;
    expect(pendingTienGowCpuSeat(state, oneHumanThreeCpu)).toBeUndefined();
    expect(state.toAct).toBe(0);
    const move = nextCpuMove(state, 0);
    expect(move).not.toBeNull();
    state = applyMove(state, move!, { id: 'human', seat: 0 });
    guard += 1;
  }
  expect(state.phase).toBe('recap');
  expect(state.jieSeat).not.toBeNull();
  expect(state.recap).not.toBeNull();
});

test('CPU drain stops on a human toAct and does not wait a human-length timeout', () => {
  const state = createHand({
    seed: 'tgw-cpu-lead',
    table: { examples: false },
    bankerSeat: 1,
  });
  expect(state.toAct).toBe(1);
  const started = Date.now();
  const drained = drainTienGowCpuState(state, oneHumanThreeCpu);
  expect(Date.now() - started).toBeLessThan(200);
  expect(drained.applied.length).toBeGreaterThan(0);
  expect(drained.state.toAct).toBe(0);
  expect(pendingTienGowCpuSeat(drained.state, oneHumanThreeCpu)).toBeUndefined();
});

test('CPU drain respects the per-request cap so a later snapshot can continue', () => {
  const state = createHand({
    seed: 'tgw-cpu-cap',
    table: { examples: false },
    bankerSeat: 1,
  });
  const once = drainTienGowCpuState(state, oneHumanThreeCpu, 1);
  expect(once.applied).toHaveLength(1);
  expect(TGW_CPU_DRAIN_CAP).toBeGreaterThan(1);
  expect(pendingTienGowCpuSeat(once.state, oneHumanThreeCpu) || once.state.toAct === 0).toBeTruthy();
});

test('each human snapshot is projectView only — the other hidden hand never appears', () => {
  const state = createHand({ seed: 'tgw-2h-hidden', table: { examples: false }, bankerSeat: 0 });
  const snapshot = {
    room: { game_slug: 'tien-gow' as const, state },
    members: twoHumanTwoCpu,
    events: [{
      version: 1,
      event_type: 'move',
      payload: { type: 'dump', seat: 1, tiles: [state.hands[1][0]] },
    }],
  };

  const south = projectTienGowSnapshot(snapshot, 'south');
  const west = projectTienGowSnapshot(snapshot, 'west');
  expect(south.room.state).toEqual(projectView(state, 0));
  expect(west.room.state).toEqual(projectView(state, 3));
  expect(isTienGowView(south.room.state)).toBe(true);
  expect(isTienGowView(west.room.state)).toBe(true);
  if (!isTienGowView(south.room.state) || !isTienGowView(west.room.state)) throw new Error('expected projected views');
  expect(south.room.state.hand).toEqual(state.hands[0]);
  expect(west.room.state.hand).toEqual(state.hands[3]);

  const southJson = JSON.stringify(south);
  for (const tile of hiddenTilesFor(state, 3, 0)) {
    expect(southJson).not.toContain(tile);
  }
  const westJson = JSON.stringify(west);
  for (const tile of hiddenTilesFor(state, 0, 3)) {
    expect(westJson).not.toContain(tile);
  }
  expect(south.events?.[0]?.payload).toEqual({ type: 'dump', seat: 1, count: 1 });
  expect(JSON.stringify(south.events)).not.toContain(state.hands[1][0]);
});

test('illegal TGW moves are rejected by parse or validateMove', () => {
  const state = createHand({ seed: 'tgw-illegal', table: { examples: false }, bankerSeat: 0 });
  expect(parseTienGowMove({})).toEqual({ ok: false, reason: 'Choose a legal 打天九 move.' });
  expect(parseTienGowMove({ type: 'lead', tiles: [] }).ok).toBe(false);
  expect(parseTienGowMove({ type: 'lead', tiles: [1] }).ok).toBe(false);
  const parsed = parseTienGowMove({ type: 'skipExample' });
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(validateMove(state, parsed.move, { id: 'human', seat: 0 }).ok).toBe(false);
  }
  const notYourTurn = validateMove(state, { type: 'lead', tiles: state.hands[1].slice(0, 1) }, { id: 'cpu-1', seat: 1 });
  expect(notYourTurn).toEqual({ ok: false, reason: 'It is not this player’s turn.' });
});

test('dump event payloads never include tile faces', () => {
  expect(publicTienGowMovePayload({ type: 'dump', tiles: ['wen:tian:0', 'wen:tian:1'] }, 2))
    .toEqual({ type: 'dump', seat: 2, count: 2 });
  expect(publicTienGowMovePayload({ type: 'lead', tiles: ['wen:tian:0'] }, 0))
    .toEqual({ type: 'lead', seat: 0, tiles: ['wen:tian:0'] });
});

test('a playing snapshot with CPU toAct asks snapshotAfterCpuTurn to apply', async () => {
  const state = createHand({ seed: 'tgw-pending-cpu', table: { examples: false }, bankerSeat: 1 });
  const snapshot = {
    room: { id: 'room', status: 'playing' as const, version: 0, state, game_slug: 'tien-gow' },
    members: oneHumanThreeCpu,
  };
  let applied = false;
  await snapshotAfterCpuTurn(snapshot, async () => snapshot, async () => {
    applied = true;
  });
  expect(applied).toBe(true);
});

test('a playing TGW headline names the seat to act, not a tic-tac-toe mark', () => {
  const state = createHand({ seed: 'tgw:TGW-4K8', table: { examples: false }, bankerSeat: 0 });
  const members = [
    { seat: 0, display_name: 'aa' },
    { seat: 1, display_name: 'CPU' },
    { seat: 2, display_name: 'CPU' },
    { seat: 3, display_name: 'CPU' },
  ];
  expect(roomHeadline({ status: 'playing', state, members, language: 'en', gameSlug: 'tien-gow' }))
    .toBe('Turn: South · aa');
  expect(roomHeadline({ status: 'playing', state, members, language: 'zh-Hant', gameSlug: 'tien-gow' }))
    .toBe('輪到: 南 · aa');
  const recap = { ...state, phase: 'recap' as const, jieSeat: 2 };
  expect(roomHeadline({ status: 'playing', state: recap, members, language: 'en', gameSlug: 'tien-gow' }))
    .toBe('Hand over — North 結');
});

test('traditional chinese names TGW move errors', () => {
  expect(translateError('Choose a legal 打天九 move.', 'zh-Hant')).toBe('請選擇合法的打天九出牌。');
  expect(translateError('Choose a valid tile set.', 'zh-Hant')).toBe('請選擇有效的牌組。');
  expect(translateError('The hand is over.', 'zh-Hant')).toBe('這一局已經結束。');
});

test('the move API validates actor seat and returns projectView after CPU drain', async () => {
  const moveRoute = await readFile(new URL('../app/api/rooms/[code]/move/route.ts', import.meta.url), 'utf8');
  expect(moveRoute).not.toContain('打天九 moves are not available yet.');
  expect(moveRoute).toContain('validateMove');
  expect(moveRoute).toContain('applyMove');
  expect(moveRoute).toContain('parseTienGowMove');
  expect(moveRoute).toContain('projectTienGowSnapshot');
  expect(moveRoute).toContain('snapshotAfterCpuTurn');

  const roomRoute = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  expect(roomRoute).toContain('projectTienGowSnapshot');

  const cpu = await readFile(new URL('../app/api/_lib/apply-cpu-turn.ts', import.meta.url), 'utf8');
  expect(cpu).toContain('applyTienGowCpuTurns');
  expect(cpu).not.toContain("room.game_slug === 'downstairs' || room.game_slug === 'tien-gow'");
});

test('the playroom board plays from the projected view and never mounts other hands', async () => {
  const board = await readFile(new URL('../app/tien-gow-board.tsx', import.meta.url), 'utf8');
  expect(board).toContain('view.hand');
  expect(board).toContain('data-viewer-seat');
  expect(board).not.toContain('view.hands');
  expect(board).not.toContain('state.hands');
  expect(board).toContain('legal');

  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  expect(client).toContain('TienGowBoard');
  expect(client).toContain('isTienGowView');
  expect(client).not.toContain('打天九 moves are not available yet.');
});
