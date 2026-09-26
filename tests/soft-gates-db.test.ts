import { afterAll, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const localEnv = await readFile('.env.local', 'utf8').catch(() => '');
for (const line of localEnv.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase test environment is not configured.');
if (supabaseUrl.includes('xrkwxaxsmnraygwsmdiq')) throw new Error('Refusing to run soft-gate tests against production.');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const roomCodes: string[] = [];
const scopeKeys: string[] = [];

function roomCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(3)), (byte) => alphabet[byte % alphabet.length]).join('');
  return `TIK-${suffix}`;
}

afterAll(async () => {
  if (roomCodes.length) await admin.from('rooms').delete().in('code', roomCodes);
  if (scopeKeys.length) await admin.from('room_soft_gates').delete().in('scope_key', scopeKeys);
});

test('create quota rejects the third create in a window and a second create inside the cooldown', async () => {
  const guestId = crypto.randomUUID();
  const ipHash = crypto.randomUUID().replaceAll('-', '');
  scopeKeys.push(`ip:${ipHash}`, `guest:${guestId}`);
  const limited = {
    p_guest_id: guestId,
    p_ip_hash: ipHash,
    p_limit: 2,
    p_window_seconds: 3600,
    p_cooldown_seconds: 0,
  };
  expect((await admin.rpc('consume_create_room_gate', limited)).data).toBe(true);
  expect((await admin.rpc('consume_create_room_gate', limited)).data).toBe(true);
  expect((await admin.rpc('consume_create_room_gate', limited)).data).toBe(false);

  const otherGuest = crypto.randomUUID();
  const otherIp = crypto.randomUUID().replaceAll('-', '');
  scopeKeys.push(`ip:${otherIp}`, `guest:${otherGuest}`);
  const cooled = {
    p_guest_id: otherGuest,
    p_ip_hash: otherIp,
    p_limit: 5,
    p_window_seconds: 3600,
    p_cooldown_seconds: 60,
  };
  expect((await admin.rpc('consume_create_room_gate', cooled)).data).toBe(true);
  expect((await admin.rpc('consume_create_room_gate', cooled)).data).toBe(false);
});

test('an idle room is marked expired and a fresh member is limited on the next deal', async () => {
  const guestId = crypto.randomUUID();
  const code = roomCode();
  roomCodes.push(code);
  const inserted = await admin.from('rooms').insert({
    code,
    game_slug: 'tic-tac-toe',
    mode: 'turn_based',
    host_guest_id: guestId,
    state: { board: [null, null, null, null, null, null, null, null, null], nextMark: 'X', moveCount: 0 },
    max_players: 2,
    status: 'open',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    last_activity_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
  }).select('id').single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new Error('Could not insert idle room.');
  const { error: memberError } = await admin.from('room_members').insert({
    room_id: inserted.data.id,
    guest_id: guestId,
    display_name: 'Idle',
    seat: 0,
  });
  if (memberError) throw memberError;

  const { error: expireError } = await admin.rpc('expire_room_if_idle', { p_code: code });
  if (expireError) throw expireError;
  const expired = await admin.from('rooms').select('status').eq('code', code).single();
  expect(expired.data?.status).toBe('expired');

  const liveCode = roomCode();
  roomCodes.push(liveCode);
  const live = await admin.from('rooms').insert({
    code: liveCode,
    game_slug: 'tic-tac-toe',
    mode: 'turn_based',
    host_guest_id: guestId,
    state: { board: [null, null, null, null, null, null, null, null, null], nextMark: 'X', moveCount: 0 },
    max_players: 2,
    status: 'open',
  }).select('id').single();
  if (live.error || !live.data) throw live.error ?? new Error('Could not insert live room.');
  const { error: liveMemberError } = await admin.from('room_members').insert({
    room_id: live.data.id,
    guest_id: guestId,
    display_name: 'Live',
    seat: 0,
  });
  if (liveMemberError) throw liveMemberError;
  scopeKeys.push(`room:${live.data.id}:guest:${guestId}`);
  const gate = {
    p_code: liveCode,
    p_guest_id: guestId,
    p_limit: 1,
    p_window_seconds: 3600,
    p_cooldown_seconds: 5,
  };
  expect((await admin.rpc('consume_start_rematch_gate', gate)).data).toBe(true);
  expect((await admin.rpc('consume_start_rematch_gate', gate)).data).toBe(false);

  const { error: stillError } = await admin.rpc('expire_room_if_idle', { p_code: liveCode });
  if (stillError) throw stillError;
  const still = await admin.from('rooms').select('status').eq('code', liveCode).single();
  expect(still.data?.status).toBe('open');
});
