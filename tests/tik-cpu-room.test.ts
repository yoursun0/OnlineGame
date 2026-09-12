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
  const email = `cpu-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Cpu-${crypto.randomUUID()}-A!9`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('Could not create test user.');
  userIds.push(created.data.user.id);
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('Could not sign in test user.');
  return { id: created.data.user.id, token: signedIn.data.session.access_token };
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

testWithTimeout('a solo host can start versus CPU and receive a server-side reply', async () => {
  const host = await createTestUser('host');
  const created = await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: 'aa' });
  expect(created.response.status).toBe(200);
  const code = created.payload?.code as string;
  roomCodes.push(code);

  const started = await api(`/api/rooms/${code}`, host.token, { action: 'start' });
  expect(started.response.status).toBe(200);
  expect(started.payload?.room.status).toBe('playing');
  expect(started.payload?.members).toHaveLength(2);
  const cpu = started.payload?.members.find((member: { is_cpu?: boolean }) => member.is_cpu);
  const hostMember = started.payload?.members.find((member: { guest_id: string }) => member.guest_id === host.id);
  expect(cpu).toBeTruthy();
  expect(hostMember).toBeTruthy();
  expect(new Set(started.payload?.members.map((member: { seat: number }) => member.seat))).toEqual(new Set([0, 1]));
  expect(hostMember.seat + cpu.seat).toBe(1);

  if (hostMember.seat === 1) {
    expect(started.payload?.room.state.moveCount).toBe(1);
    expect(started.payload?.room.state.nextMark).toBe('O');
  } else {
    expect(started.payload?.room.state.moveCount).toBe(0);
    expect(started.payload?.room.state.nextMark).toBe('X');
  }

  const emptyCell = started.payload?.room.state.board.findIndex((mark: string | null) => mark === null);
  const moved = await api(`/api/rooms/${code}/move`, host.token, { cell: emptyCell });
  expect(moved.response.status).toBe(200);
  expect(moved.payload?.room.state.moveCount).toBe(started.payload?.room.state.moveCount + 2);
  expect(moved.payload?.room.state.nextMark).toBe(hostMember.seat === 0 ? 'X' : 'O');
}, 30000);

testWithTimeout('two-player rooms still require both players before starting, then assign X and O randomly', async () => {
  const host = await createTestUser('host2');
  const guest = await createTestUser('guest2');
  const created = await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: 'aa' });
  expect(created.response.status).toBe(200);
  const code = created.payload?.code as string;
  roomCodes.push(code);

  expect((await api(`/api/rooms/${code}`, host.token, { action: 'start' })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'join', displayName: 'gg' })).response.status).toBe(409);

  const freshHost = await createTestUser('host3');
  const freshGuest = await createTestUser('guest3');
  const second = await api('/api/rooms', freshHost.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: 'aa' });
  const secondCode = second.payload?.code as string;
  roomCodes.push(secondCode);
  expect((await api(`/api/rooms/${secondCode}`, freshGuest.token, { action: 'join', displayName: 'gg' })).response.status).toBe(200);
  expect((await api(`/api/rooms/${secondCode}`, freshHost.token, { action: 'start' })).response.status).toBe(409);
  expect((await api(`/api/rooms/${secondCode}`, freshHost.token, { action: 'ready', ready: true })).response.status).toBe(200);
  expect((await api(`/api/rooms/${secondCode}`, freshGuest.token, { action: 'ready', ready: true })).response.status).toBe(200);
  const started = await api(`/api/rooms/${secondCode}`, freshHost.token, { action: 'start' });
  expect(started.response.status).toBe(200);
  const hostMember = started.payload?.members.find((member: { guest_id: string }) => member.guest_id === freshHost.id);
  const guestMember = started.payload?.members.find((member: { guest_id: string }) => member.guest_id === freshGuest.id);
  expect(new Set([hostMember.seat, guestMember.seat])).toEqual(new Set([0, 1]));
  expect(started.payload?.members.some((member: { is_cpu?: boolean }) => member.is_cpu)).toBe(false);

  const x = started.payload?.members.find((member: { seat: number }) => member.seat === 0);
  const o = started.payload?.members.find((member: { seat: number }) => member.seat === 1);
  const xToken = x.guest_id === freshHost.id ? freshHost.token : freshGuest.token;
  const oToken = o.guest_id === freshHost.id ? freshHost.token : freshGuest.token;
  expect((await api(`/api/rooms/${secondCode}/move`, oToken, { cell: 0 })).response.status).toBe(409);
  expect((await api(`/api/rooms/${secondCode}/move`, xToken, { cell: 0 })).response.status).toBe(200);
}, 30000);

testWithTimeout('reading a room finishes a stuck CPU turn', async () => {
  const host = await createTestUser('heal');
  const created = await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: 'aa' });
  expect(created.response.status).toBe(200);
  const code = created.payload?.code as string;
  roomCodes.push(code);
  const started = await api(`/api/rooms/${code}`, host.token, { action: 'start' });
  expect(started.response.status).toBe(200);
  const roomId = started.payload?.room.id as string;
  const cpu = started.payload?.members.find((member: { is_cpu?: boolean }) => member.is_cpu);
  expect(cpu).toBeTruthy();

  await admin.from('game_events').delete().eq('room_id', roomId);
  await admin.from('room_members').update({ seat: 1 }).eq('room_id', roomId).eq('guest_id', host.id);
  await admin.from('room_members').update({ seat: 0 }).eq('room_id', roomId).eq('guest_id', cpu.guest_id);
  await admin.from('rooms').update({
    state: { board: [null, null, null, null, null, null, null, null, null], nextMark: 'X', moveCount: 0 },
    version: 0,
    status: 'playing',
  }).eq('id', roomId);

  const healed = await api(`/api/rooms/${code}`, host.token);
  expect(healed.response.status).toBe(200);
  expect(healed.payload?.room.state.moveCount).toBe(1);
  expect(healed.payload?.room.state.nextMark).toBe('O');
  expect(healed.payload?.room.state.board.filter(Boolean)).toEqual(['X']);
}, 30000);
