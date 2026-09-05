import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment is not configured.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getAuthenticatedGuest(request: NextRequest, admin: SupabaseClient): Promise<User> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) throw new Error('A guest session is required.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('The guest session is invalid or expired.');
  return data.user;
}

export function errorResponse(error: unknown, fallback = 'Request failed.') {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes('required') || message.includes('invalid') || message.includes('expired') ? 401 : message.includes('not configured') ? 503 : 409;
  return Response.json({ error: message }, { status });
}

export async function readJson(request: NextRequest) {
  try { return await request.json(); } catch { throw new Error('Request body must be valid JSON.'); }
}
