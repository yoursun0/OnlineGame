import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { snapshotAfterCpuTurn } from '../app/api/_lib/apply-cpu-turn';
import { translateError } from '../app/language';
import { PLAYROOM_ROOM_CODE_HINT } from '../app/room-code';
import { roomHeadline } from '../app/room-headline';

test('the homepage shelf has a fourth 打天九 / Tien Gow card with bilingual copy', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  expect(page).toContain("slug === 'tien-gow'");
  expect(page).toContain('game-card-tiengow');
  expect(page).toContain('Tien Gow');
  expect(page).toContain('打天九');
  expect(page).toContain('tienDescription');
  expect(page).toContain('CreateRoomButton gameSlug={game.slug}');
});

test('desktop catalogue is a four-card grid and the TGW card has its own colour', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  expect(css).toMatch(/\.game-grid \{[^}]*grid-template-columns: repeat\(2, 1fr\)/);
  expect(css).toContain('.game-card-tiengow');
  expect(css).not.toMatch(/\.game-card-featured \{ grid-column: 1 \/ -1; \}/);
});

test('join-code hints and the create-room API accept TGW alongside TIK, CON, and LAD', async () => {
  const lobby = await readFile(new URL('../app/lobby-actions.tsx', import.meta.url), 'utf8');
  const rooms = await readFile(new URL('../app/api/rooms/route.ts', import.meta.url), 'utf8');
  const roomRoute = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20260920000200_tien_gow_rooms.sql', import.meta.url), 'utf8');
  expect(PLAYROOM_ROOM_CODE_HINT).toContain('TGW-4K8');
  expect(lobby).toContain('isPlayroomRoomCode');
  expect(lobby).toContain('PLAYROOM_ROOM_CODE_HINT');
  expect(rooms).toContain("'tien-gow': 'turn_based'");
  expect(roomRoute).toContain('PLAYROOM_ROOM_CODE_HINT');
  expect(migration).toContain("p_game_slug not in ('tic-tac-toe', 'connect-four', 'downstairs', 'tien-gow')");
  expect(migration).toContain("v_prefix := 'TGW-'");
  expect(migration).toContain('v_max_players := 4');
});

test('traditional chinese join copy names TGW codes', () => {
  expect(translateError(PLAYROOM_ROOM_CODE_HINT, 'zh-Hant')).toBe('請輸入類似 TIK-7Q4、CON-K8P、LAD-ZHW 或 TGW-4K8 的房號。');
});

test('a TGW waiting room does not borrow tic-tac-toe turn copy', () => {
  expect(roomHeadline({
    status: 'open',
    state: { kind: 'tien-gow', phase: 'lobby' },
    members: [{ seat: 0, display_name: 'aa' }],
    language: 'en',
    gameSlug: 'tien-gow',
  })).toBe('Waiting room — 打天九 lobby');
  expect(roomHeadline({
    status: 'open',
    state: { kind: 'tien-gow', phase: 'lobby' },
    members: [{ seat: 0, display_name: 'aa' }],
    language: 'zh-Hant',
    gameSlug: 'tien-gow',
  })).toBe('等待開局（打天九大廳）');
});

test('Playroom TGW rooms skip the tic-tac-toe CPU drain', async () => {
  const snapshot = {
    room: {
      id: 'room',
      status: 'playing' as const,
      version: 0,
      state: { kind: 'tien-gow', phase: 'lobby' },
      game_slug: 'tien-gow',
    },
    members: [
      { guest_id: 'host', seat: 0, is_cpu: false },
      { guest_id: 'cpu', seat: 1, is_cpu: true },
    ],
  };
  const result = await snapshotAfterCpuTurn(snapshot, async () => {
    throw new Error('reload should not run.');
  }, async () => {
    throw new Error('CPU apply should not run.');
  });
  expect(result).toBe(snapshot);
});

test('the playroom client labels TGW and does not render a tic-tac-toe board for it', async () => {
  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  expect(client).toContain("snapshot?.room.game_slug === 'tien-gow'");
  expect(client).toContain("isTienGow ? '打天九'");
  expect(client).toContain("isTienGow ? 'Tien Gow'");
  expect(client).toContain('waiting-mark-tiengow');
});
