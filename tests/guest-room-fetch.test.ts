import { expect, test } from 'bun:test';
import {
  requestWithGuestRetry,
  type GuestCredentials,
  type GuestRequestResult,
  type GuestRoomAuth,
} from '../app/lib/guest-room-fetch';

function authWith(
  ensure: GuestCredentials | null,
  recover: GuestCredentials | null,
  counters?: { ensureCalls?: number; recoverCalls?: number },
): GuestRoomAuth {
  return {
    async ensure() {
      if (counters) counters.ensureCalls = (counters.ensureCalls ?? 0) + 1;
      return ensure;
    },
    async recover() {
      if (counters) counters.recoverCalls = (counters.recoverCalls ?? 0) + 1;
      return recover;
    },
  };
}

test('requestWithGuestRetry succeeds on the first attempt without recovering', async () => {
  const counters = { ensureCalls: 0, recoverCalls: 0 };
  const tokens: string[] = [];
  const result = await requestWithGuestRetry(
    async (token) => {
      tokens.push(token);
      return { status: 200, data: { code: 'TIK-OK1' } };
    },
    authWith({ accessToken: 'tok-a', guestId: 'guest-a' }, { accessToken: 'tok-b', guestId: 'guest-b' }, counters),
  );
  expect(result).toEqual({ data: { code: 'TIK-OK1' }, guestId: 'guest-a', accessToken: 'tok-a' });
  expect(tokens).toEqual(['tok-a']);
  expect(counters).toEqual({ ensureCalls: 1, recoverCalls: 0 });
});

test('on 401, recovers guest once then retries the same request successfully', async () => {
  const counters = { ensureCalls: 0, recoverCalls: 0 };
  const tokens: string[] = [];
  let attempts = 0;
  const result = await requestWithGuestRetry(
    async (token) => {
      tokens.push(token);
      attempts += 1;
      if (attempts === 1) {
        return { status: 401, error: 'The guest session is invalid or expired.' };
      }
      return { status: 200, data: { code: 'TIK-OK2' } };
    },
    authWith({ accessToken: 'stale', guestId: 'old' }, { accessToken: 'fresh', guestId: 'new' }, counters),
  );
  expect(result).toEqual({ data: { code: 'TIK-OK2' }, guestId: 'new', accessToken: 'fresh' });
  expect(tokens).toEqual(['stale', 'fresh']);
  expect(attempts).toBe(2);
  expect(counters).toEqual({ ensureCalls: 1, recoverCalls: 1 });
});

test('a second 401 after recovery surfaces the error and does not loop', async () => {
  const counters = { ensureCalls: 0, recoverCalls: 0 };
  const tokens: string[] = [];
  let attempts = 0;
  await expect(
    requestWithGuestRetry(
      async (token) => {
        tokens.push(token);
        attempts += 1;
        return { status: 401, error: 'The guest session is invalid or expired.' } satisfies GuestRequestResult;
      },
      authWith({ accessToken: 'stale', guestId: 'old' }, { accessToken: 'fresh', guestId: 'new' }, counters),
    ),
  ).rejects.toThrow('The guest session is invalid or expired.');
  expect(tokens).toEqual(['stale', 'fresh']);
  expect(attempts).toBe(2);
  expect(counters).toEqual({ ensureCalls: 1, recoverCalls: 1 });
});

test('recover failure after 401 throws the original guest-invalid message', async () => {
  const counters = { ensureCalls: 0, recoverCalls: 0 };
  let attempts = 0;
  await expect(
    requestWithGuestRetry(
      async () => {
        attempts += 1;
        return { status: 401, error: 'The guest session is invalid or expired.' };
      },
      authWith({ accessToken: 'stale', guestId: 'old' }, null, counters),
    ),
  ).rejects.toThrow('The guest session is invalid or expired.');
  expect(attempts).toBe(1);
  expect(counters).toEqual({ ensureCalls: 1, recoverCalls: 1 });
});

test('missing guest session throws the connect error without calling the API', async () => {
  let attempts = 0;
  await expect(
    requestWithGuestRetry(
      async () => {
        attempts += 1;
        return { status: 200, data: {} };
      },
      authWith(null, null),
      { connectError: 'Connect Supabase before creating or joining a room.' },
    ),
  ).rejects.toThrow('Connect Supabase before creating or joining a room.');
  expect(attempts).toBe(0);
});

test('non-401 failures are not retried', async () => {
  const counters = { ensureCalls: 0, recoverCalls: 0 };
  let attempts = 0;
  await expect(
    requestWithGuestRetry(
      async () => {
        attempts += 1;
        return { status: 409, error: 'Room not found or no longer open.' };
      },
      authWith({ accessToken: 'tok', guestId: 'g' }, { accessToken: 'tok2', guestId: 'g2' }, counters),
    ),
  ).rejects.toThrow('Room not found or no longer open.');
  expect(attempts).toBe(1);
  expect(counters.recoverCalls).toBe(0);
});

test('lobby and room client wire requestWithGuestRetry for guest 401 recovery', async () => {
  const { readFile } = await import('node:fs/promises');
  const lobby = await readFile(new URL('../app/lobby-actions.tsx', import.meta.url), 'utf8');
  const room = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  const browser = await readFile(new URL('../app/lib/supabase-browser.ts', import.meta.url), 'utf8');
  expect(lobby).toContain('requestWithGuestRetry');
  expect(room).toContain('requestWithGuestRetry');
  expect(browser).toContain('recoverGuestSession');
  expect(browser).toContain('signInAnonymously');
});
