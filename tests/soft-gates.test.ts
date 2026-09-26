import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { errorResponse } from '../app/api/_lib/supabase-admin';
import { translateError } from '../app/language';
import { roomHeadline } from '../app/room-headline';
import { canAutoRetryRoomCommand, roomPollPeriodMs, shouldPauseRoomPoll, shouldSyncRoom } from '../app/room-sync';
import { BUSY_ERROR, CREATE_ROOM_COOLDOWN_SECONDS, CREATE_ROOM_LIMIT, IDLE_ROOM_TTL_MINUTES, ROOM_CAP, START_REMATCH_COOLDOWN_SECONDS, START_REMATCH_LIMIT } from '../app/soft-gates';

test('a hidden or expired room does not keep polling or a room subscription', () => {
  expect(shouldSyncRoom('visible', 'open')).toBe(true);
  expect(shouldSyncRoom('visible', 'playing')).toBe(true);
  expect(shouldSyncRoom('hidden', 'playing')).toBe(false);
  expect(shouldSyncRoom('visible', 'expired')).toBe(false);
  expect(roomPollPeriodMs(true)).toBe(5000);
  expect(roomPollPeriodMs(false)).toBe(1500);
});

test('an over-limit command is not retried by the client', () => {
  expect(canAutoRetryRoomCommand(429)).toBe(false);
  expect(canAutoRetryRoomCommand(503)).toBe(false);
  expect(canAutoRetryRoomCommand(409)).toBe(true);
});

test('a PostgREST schema-cache failure is the busy message and pauses polling', async () => {
  const response = errorResponse({ code: 'PGRST002', message: 'Could not query the database for the schema cache. Retrying.' });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: BUSY_ERROR });
  expect(shouldPauseRoomPoll(BUSY_ERROR)).toBe(true);
  expect(shouldPauseRoomPoll('Could not query the database for the schema cache. Retrying.')).toBe(true);
  expect(shouldPauseRoomPoll('Room not found or expired.')).toBe(false);
});

test('the busy rejection is HTTP 429 in both languages', async () => {
  const response = errorResponse({ message: BUSY_ERROR, code: 'P0001' });
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: BUSY_ERROR });
  expect(translateError(BUSY_ERROR, 'zh-Hant')).toBe('伺服器忙，請稍後再試。');
  expect(translateError(BUSY_ERROR, 'en')).toBe(BUSY_ERROR);
});

test('an expired room tells the player it closed', () => {
  expect(roomHeadline({ status: 'expired', state: {}, members: [], language: 'en' })).toBe('This room has expired');
  expect(roomHeadline({ status: 'expired', state: {}, members: [], language: 'zh-Hant' })).toBe('房間已閒置關閉');
});

test('the migration and the route use the locked free-tier knobs', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260927000100_free_tier_soft_gates.sql', import.meta.url), 'utf8');
  const createRoute = await readFile(new URL('../app/api/rooms/route.ts', import.meta.url), 'utf8');
  const roomRoute = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  expect(migration).toContain(`playroom_room_cap_reached(${ROOM_CAP})`);
  expect(migration).toContain(`interval '${IDLE_ROOM_TTL_MINUTES} minutes'`);
  expect(migration).toContain(BUSY_ERROR);
  expect(createRoute).toContain('consume_create_room_gate');
  expect(createRoute).toContain(`CREATE_ROOM_LIMIT`);
  expect(CREATE_ROOM_LIMIT).toBe(5);
  expect(CREATE_ROOM_COOLDOWN_SECONDS).toBe(20);
  expect(roomRoute).toContain('consume_start_rematch_gate');
  expect(roomRoute).toContain('touch_room_if_active');
  const getBody = roomRoute.slice(roomRoute.indexOf('export async function GET'), roomRoute.indexOf('export async function POST'));
  expect(getBody).not.toContain('expire_idle_rooms');
  expect(getBody).not.toContain('expire_room_if_idle');
  expect(START_REMATCH_LIMIT).toBe(10);
  expect(START_REMATCH_COOLDOWN_SECONDS).toBe(5);
  expect(client).toContain('shouldSyncRoom');
  expect(client).toContain('canAutoRetryRoomCommand');
  expect(client).not.toContain('setInterval(() => { void refresh(); }, supabase ? 5000 : 1500)');
});
