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
  const email = `issue3-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Issue3-${crypto.randomUUID()}-A!9`;
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
  try { payload = await response.json(); } catch { /* empty response */ }
  return { response, payload: payload as Record<string, any> | null };
}

async function createRoom(token: string, name: string) {
  const result = await api('/api/rooms', token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: name });
  expect(result.response.status).toBe(200);
  const code = result.payload?.code as string;
  expect(code).toMatch(/^TIK-[2-9A-HJ-NP-Z]{3}$/);
  roomCodes.push(code);
  return code;
}

afterAll(async () => {
  if (roomCodes.length) await admin.from('rooms').delete().in('code', roomCodes);
  for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
});

testWithTimeout('Issue #3 recovery, lifecycle, abuse controls, and anonymous reporting', async () => {
  const host = await createTestUser('host');
  const guest = await createTestUser('guest');
  const code = await createRoom(host.token, 'Host');

  expect((await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'realtime', displayName: 'Realtime' })).response.status).toBe(400);

  const joined = await api(`/api/rooms/${code}`, guest.token, { action: 'join', displayName: 'Guest' });
  expect(joined.response.status).toBe(200);
  expect(joined.payload?.members).toHaveLength(2);

  expect((await api(`/api/rooms/${code}`, host.token, { action: 'ready', ready: true })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'ready', ready: true })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, host.token, { action: 'start' })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}/move`, host.token, { cell: 0 })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}/move`, host.token, { cell: 1, expectedVersion: 0 })).response.status).toBe(409);
  const afterFirstMove = await api(`/api/rooms/${code}`, guest.token);
  expect(afterFirstMove.response.status).toBe(200);
  expect(afterFirstMove.payload?.room.version).toBe(1);

  expect((await api(`/api/rooms/${code}/move`, guest.token, { cell: 3 })).response.status).toBe(200);
  const missed = await api(`/api/rooms/${code}?since=1`, host.token);
  expect(missed.response.status).toBe(200);
  const missedVersions = (missed.payload?.events ?? []).map((event: { version: number }) => event.version);
  expect(missedVersions.every((version: number) => version > 1)).toBe(true);
  expect(new Set(missedVersions).size).toBe(missedVersions.length);

  expect((await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: 'x'.repeat(33) })).response.status).toBe(400);
  const oversized = await fetch(`${baseUrl}/api/rooms`, { method: 'POST', headers: { authorization: `Bearer ${host.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ payload: 'x'.repeat(9000) }) });
  expect(oversized.status).toBe(413);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'report', reason: 'Automated UAT report' })).response.status).toBe(200);
  expect((await api(`/api/rooms/${code}`, guest.token, { action: 'leave' })).response.status).toBe(200);

  const expiringCode = await createRoom(host.token, 'Expiring');
  await admin.from('rooms').update({ expires_at: new Date(Date.now() - 1000).toISOString(), last_activity_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString() }).eq('code', expiringCode);
  expect((await api(`/api/rooms/${expiringCode}`, guest.token, { action: 'join', displayName: 'Too late' })).response.status).toBe(409);

  const rateLimitedCodes: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const result = await api('/api/rooms', host.token, { gameSlug: 'tic-tac-toe', mode: 'turn_based', displayName: `Rate ${index}` });
    if (result.response.ok && result.payload?.code) rateLimitedCodes.push(result.payload.code);
    if (index === 5) expect(result.response.status).toBe(429);
  }
  roomCodes.push(...rateLimitedCodes);
  expect((await api(`/api/rooms/${code}`, host.token)).payload?.room.version).toBe(2);
}, 30000);
