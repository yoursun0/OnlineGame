import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('room snapshot GET does not call expire_idle_rooms', async () => {
  const route = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  expect(route).not.toContain('expire_idle_rooms');
});
