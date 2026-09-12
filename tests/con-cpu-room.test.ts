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
  const email = `con-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Con-${crypto.randomUUID()}-A!9`;
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
    signal: AbortSignal.timeout(15000),
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* empty */ }
  return { response, payload: payload as Record<string, any> | null };
}

afterAll(async () => {
  if (roomCodes.length) await admin.from('rooms').delete().in('code', roomCodes);
  for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
});

testWithTimeout('a solo host can start Connect Four versus CPU and receive a server-side reply', async () => {
  const host = await createTestUser('host');
  const created = await api('/api/rooms', host.token, { gameSlug: 'connect-four', mode: 'turn_based', displayName: 'aa' });
  expect(created.response.status).toBe(200);
  const code = created.payload?.code as string;
  expect(code).toMatch(/^CON-[2-9A-HJ-NP-Z]{3}$/);
  roomCodes.push(code);

  const started = await api(`/api/rooms/${code}`, host.token, { action: 'start' });
  expect(started.response.status).toBe(200);
  expect(started.payload?.room.status).toBe('playing');
  expect(started.payload?.room.game_slug).toBe('connect-four');
  expect(started.payload?.members).toHaveLength(2);
  const cpu = started.payload?.members.find((member: { is_cpu?: boolean }) => member.is_cpu);
  const hostMember = started.payload?.members.find((member: { guest_id: string }) => member.guest_id === host.id);
  expect(cpu).toBeTruthy();
  expect(hostMember).toBeTruthy();

  let snapshot = started.payload;
  expect(snapshot).toBeTruthy();
  if (cpu.seat === 0) {
    expect(snapshot!.room.state.moveCount).toBe(1);
    expect(snapshot!.room.state.nextColor).toBe('yellow');
  } else {
    expect(snapshot!.room.state.moveCount).toBe(0);
    const moved = await api(`/api/rooms/${code}/move`, host.token, { column: 3 });
    expect(moved.response.status).toBe(200);
    snapshot = moved.payload;
    expect(snapshot).toBeTruthy();
    expect(snapshot!.room.state.moveCount).toBe(2);
    expect(snapshot!.room.state.nextColor).toBe('red');
  }
}, 30000);

testWithTimeout('two humans can join a Connect Four room without a CPU occupant', async () => {
  const host = await createTestUser('p1');
  const guest = await createTestUser('p2');
  const created = await api('/api/rooms', host.token, { gameSlug: 'connect-four', mode: 'turn_based', displayName: 'aa' });
  expect(created.response.status).toBe(200);
  const code = created.payload?.code as string;
  roomCodes.push(code);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'join', displayName: 'gg' })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, host.token, { action: 'ready', ready: true })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'ready', ready: true })).response.status).toBe(200);
  const started = await api(`/api/rooms/${code}`, host.token, { action: 'start' });
  expect(started.response.status).toBe(200);
  expect(started.payload?.members.some((member: { is_cpu?: boolean }) => member.is_cpu)).toBe(false);
  const red = started.payload?.members.find((member: { seat: number }) => member.seat === 0);
  const yellow = started.payload?.members.find((member: { seat: number }) => member.seat === 1);
  const redToken = red.guest_id === host.id ? host.token : guest.token;
  const yellowToken = yellow.guest_id === host.id ? host.token : guest.token;
  expect((await api(`/api/rooms/${code}/move`, yellowToken, { column: 3 })).response.status).toBe(409);
  expect((await api(`/api/rooms/${code}/move`, redToken, { column: 3 })).response.status).toBe(200);
}, 30000);
