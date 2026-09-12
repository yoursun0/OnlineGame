import { afterAll, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const localEnv = await readFile('.env.local', 'utf8').catch(() => '');
for (const line of localEnv.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const baseUrl = process.env.PLAYROOM_TEST_URL ?? 'http://localhost:3000';
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Supabase test environment is not configured.');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const userIds: string[] = [];
const roomCodes: string[] = [];
const testWithTimeout = test as unknown as (name: string, callback: () => Promise<void>, timeout: number) => void;

async function createTestUser(label: string) {
  const email = `replay-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Replay-${crypto.randomUUID()}-A!9`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('Could not create test user.');
  userIds.push(created.data.user.id);
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('Could not sign in test user.');
  return { token: signedIn.data.session.access_token };
}

async function api(path: string, token: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* empty */ }
  return { response, payload: payload as Record<string, any> | null };
}

afterAll(async () => {
  if (roomCodes.length) await admin.from('rooms').delete().in('code', roomCodes);
  for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
});

testWithTimeout('finished Tic-tac-toe rooms can replay with the same seats and an empty board', async () => {
  const host = await createTestUser('host');
  const guest = await createTestUser('guest');
  const created = await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: 'aa' });
  expect(created.response.status).toBe(200);
  const code = created.payload?.code as string;
  roomCodes.push(code);

  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'join', displayName: 'gg' })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, host.token, { action: 'ready', ready: true })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'ready', ready: true })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, host.token, { action: 'start' })).response.status).toBe(200);

  expect((await api(`/api/rooms/${code}`, host.token, { action: 'replay' })).response.status).toBe(409);

  expect((await api(`/api/rooms/${code}/move`, host.token, { cell: 0 })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}/move`, guest.token, { cell: 3 })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}/move`, host.token, { cell: 1 })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}/move`, guest.token, { cell: 4 })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}/move`, host.token, { cell: 2 })).response.status).toBe(200);

  const finished = await api(`/api/rooms/${code}`, host.token);
  expect(finished.payload?.room.status).toBe('finished');
  const finishedVersion = finished.payload?.room.version as number;

  const replayed = await api(`/api/rooms/${code}`, guest.token, { action: 'replay' });
  expect(replayed.response.status).toBe(200);
  expect(replayed.payload?.room.status).toBe('playing');
  expect(replayed.payload?.room.version).toBe(finishedVersion + 1);
  expect(replayed.payload?.room.state).toEqual({ board: [null, null, null, null, null, null, null, null, null], nextMark: 'X', moveCount: 0 });
  expect(replayed.payload?.members.map((member: { display_name: string; seat: number }) => [member.seat, member.display_name])).toEqual([[0, 'aa'], [1, 'gg']]);
  expect((replayed.payload?.events ?? []).some((event: { event_type: string }) => event.event_type === 'replay')).toBe(true);

  expect((await api(`/api/rooms/${code}/move`, host.token, { cell: 4 })).response.status).toBe(200);
}, 30000);
