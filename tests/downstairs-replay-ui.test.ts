import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('finished downstairs rooms expose Replay / 重玩一次 without forcing leave', async () => {
  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  const well = await readFile(new URL('../app/downstairs-well.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');

  expect(client.includes("!isDownstairs && ownMember")).toBe(false);
  expect(client.includes('canShowRoomReplay')).toBe(true);
  expect(client.includes("action('replay')")).toBe(true);
  expect(client.includes("key={`well-${snapshot.room.version}`}")).toBe(true);
  expect(client.includes("action('leave')")).toBe(true);

  expect(well.includes("zh ? '重玩一次' : 'Replay'")).toBe(true);
  expect(well.includes('onReplay')).toBe(true);

  expect(route.includes('DOWNSTAIRS_SLUG')).toBe(true);
  expect(route.includes('createSoloStartState')).toBe(true);
  expect(route.includes('createSharedStartState')).toBe(true);
  expect(route.includes("body.action === 'replay'")).toBe(true);
});
