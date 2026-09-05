import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

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
  const status = error instanceof ApiError
    ? error.status
    : message.includes('required') || message.includes('invalid') || message.includes('expired') ? 401
      : message.includes('not configured') ? 503 : 409;
  return Response.json({ error: message }, { status });
}

export async function readJson(request: NextRequest, maxBytes = 8 * 1024) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError('Request payload is too large.', 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError('Request payload is too large.', 413);
  }
  try { return JSON.parse(text) as unknown; } catch { throw new ApiError('Request body must be valid JSON.', 400); }
}

export function getClientIpHash(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
  const salt = process.env.RATE_LIMIT_SALT || 'playroom-development-rate-limit';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export async function enforceRateLimit(
  admin: SupabaseClient,
  guestId: string,
  action: string,
  ipHash: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await admin.rpc('check_room_action_rate_limit', {
    p_guest_id: guestId,
    p_action: action,
    p_ip_hash: ipHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (!data) throw new ApiError('Too many requests. Please try again later.', 429);
}
