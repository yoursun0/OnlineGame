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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Supabase test environment is not configured.');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
let anonymousUserId: string | undefined;

afterAll(async () => {
  if (anonymousUserId) await admin.auth.admin.deleteUser(anonymousUserId);
});

test('Supabase anonymous auth creates a temporary guest session', async () => {
  const result = await anon.auth.signInAnonymously();
  anonymousUserId = result.data.user?.id;
  expect(result.error).toBeNull();
  expect(result.data.session?.access_token).toBeTruthy();
  expect(result.data.user?.id).toBeTruthy();
  expect((result.data.user as { is_anonymous?: boolean } | null)?.is_anonymous).toBe(true);
});
