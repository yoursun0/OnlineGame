import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { shouldPollRoom } from '../app/room-sync';

test('a room polls only when Realtime is unavailable', () => {
  expect(shouldPollRoom(false, null)).toBe(true);
  expect(shouldPollRoom(true, null)).toBe(false);
  expect(shouldPollRoom(true, 'SUBSCRIBED')).toBe(false);
  expect(shouldPollRoom(true, 'CHANNEL_ERROR')).toBe(true);
  expect(shouldPollRoom(true, 'TIMED_OUT')).toBe(true);
  expect(shouldPollRoom(true, 'CLOSED')).toBe(true);
});

test('room reads do not sweep idle rooms, and a subscribed room does not poll every five seconds', async () => {
  const route = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  expect(route).not.toContain('expire_idle_rooms');
  expect(client).toContain('shouldPollRoom');
  expect(client).toContain("supabase.channel(`room:${snapshot.room.id}`)");
  expect(client).not.toContain('5000');
});
