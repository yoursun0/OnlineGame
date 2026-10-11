import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createPlayingState } from '@playroom/cat-and-dog';
import { snapshotAfterCpuTurn } from '../app/api/_lib/apply-cpu-turn';
import { translateError } from '../app/language';
import { PLAYROOM_ROOM_CODE_HINT } from '../app/room-code';
import { roomHeadline } from '../app/room-headline';

test('the homepage shelf names Cat-and-Dog / 貓狗大作戰', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  expect(page).toContain("slug === 'cat-and-dog'");
  expect(page).toContain('game-card-cad');
  expect(page).toContain('Cat-and-Dog');
  expect(page).toContain('貓狗大作戰');
  expect(page).toContain('Hold, release, and throw over the fence until the other side gives up.');
  expect(page).toContain('按住、放開，把東西扔過圍欄，直到對方放棄。');
});

test('CAD codes are accepted and the create migration allows the slug', async () => {
  const rooms = await readFile(new URL('../app/api/rooms/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20261011000100_cat_and_dog_rooms.sql', import.meta.url), 'utf8');
  expect(PLAYROOM_ROOM_CODE_HINT).toContain('CAD-7KQ');
  expect(translateError(PLAYROOM_ROOM_CODE_HINT, 'zh-Hant')).toBe('請輸入類似 TIK-7Q4、CON-K8P、LAD-ZHW、TGW-4K8 或 CAD-7KQ 的房號。');
  expect(rooms).toContain("'cat-and-dog': 'turn_based'");
  expect(migration).toContain("p_game_slug not in ('tic-tac-toe', 'connect-four', 'downstairs', 'tien-gow', 'cat-and-dog')");
  expect(migration).toContain("v_prefix := 'CAD-'");
});

test('a playing heading names the guest whose side is to act, and a win names guest and side', () => {
  const state = createPlayingState({ roomCode: 'CAD-7KQ', difficulty: null });
  const members = [
    { seat: 0, display_name: 'Ada' },
    { seat: 1, display_name: 'Bo' },
  ];
  expect(roomHeadline({ status: 'playing', state, members, language: 'en', gameSlug: 'cat-and-dog' })).toBe('Turn: Dog · Bo');
  expect(roomHeadline({ status: 'playing', state, members, language: 'zh-Hant', gameSlug: 'cat-and-dog' })).toBe('輪到: 狗 · Bo');
  const won = { ...state, phase: 'won' as const, winner: 'cat' as const, meters: { cat: 1, dog: 23 } };
  expect(roomHeadline({ status: 'finished', state: won, members, language: 'en', gameSlug: 'cat-and-dog' })).toBe('Cat wins — Ada');
  expect(roomHeadline({ status: 'finished', state: won, members, language: 'zh-Hant', gameSlug: 'cat-and-dog' })).toBe('貓勝 — Ada');
});

test('a solo CPU on Dog is applied, and a two-guest room does not invent a CPU throw', async () => {
  const state = createPlayingState({ roomCode: 'CAD-7KQ', difficulty: 'level1' });
  const snapshot = {
    room: { id: 'room', status: 'playing' as const, version: 1, state, game_slug: 'cat-and-dog' },
    members: [
      { guest_id: 'host', seat: 0, is_cpu: false },
      { guest_id: 'cpu', seat: 1, is_cpu: true },
    ],
  };
  let applied = 0;
  await snapshotAfterCpuTurn(snapshot, async () => snapshot, async () => { applied += 1; });
  expect(applied).toBe(1);

  const quiet = createPlayingState({ roomCode: 'CAD-7KQ', difficulty: null });
  const twoGuest = {
    room: { ...snapshot.room, state: quiet },
    members: [
      { guest_id: 'host', seat: 0, is_cpu: false },
      { guest_id: 'friend', seat: 1, is_cpu: false },
    ],
  };
  const result = await snapshotAfterCpuTurn(twoGuest, async () => { throw new Error('reload should not run.'); }, async () => { throw new Error('CPU apply should not run.'); });
  expect(result).toBe(twoGuest);
});
