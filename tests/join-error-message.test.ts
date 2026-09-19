import { expect, test } from 'bun:test';
import { errorResponse } from '../app/api/_lib/supabase-admin';
import { translateError } from '../app/language';

test('a supabase-shaped missing-room error is shown as room not found, not Request failed', async () => {
  const response = errorResponse({ message: 'Room not found or no longer open.', code: 'P0001' });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Room not found or no longer open.' });
});

test('traditional chinese join copy uses the room-not-found phrasing', () => {
  expect(translateError('Room not found or no longer open.', 'zh-Hant')).toBe('找不到房間，或房間已不再開放。');
});

test('joining a playing room surfaces a clear already-started error', async () => {
  const response = errorResponse({ message: 'This game has already started.', code: 'P0001' });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'This game has already started.' });
});

test('traditional chinese join copy names the already-started rejection', () => {
  expect(translateError('This game has already started.', 'zh-Hant')).toBe('遊戲已經開始，無法再加入。');
});
