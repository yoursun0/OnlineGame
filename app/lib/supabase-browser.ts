'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { GuestCredentials, GuestRoomAuth } from './guest-room-fetch';

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient = createClient(url, key);
  return browserClient;
}

function fromSession(session: Session): GuestCredentials & { session: Session } {
  return { session, accessToken: session.access_token, guestId: session.user.id };
}

function sessionLooksExpired(session: Session) {
  const expiresAt = session.expires_at;
  return typeof expiresAt === 'number' && expiresAt * 1000 <= Date.now();
}

/**
 * Ensure an anonymous guest session exists.
 * Avoids blindly reusing an expired localStorage JWT: if getSession() returns a
 * session past expires_at, refresh (or sign out and re-anon). Revoked-but-unexpired
 * tokens are recovered by requestWithGuestRetry on room API 401.
 */
export async function ensureGuestSession(): Promise<{ session: Session; guestId: string } | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const current = await supabase.auth.getSession();
  if (current.data.session) {
    if (!sessionLooksExpired(current.data.session)) {
      return { session: current.data.session, guestId: current.data.session.user.id };
    }
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      return { session: refreshed.data.session, guestId: refreshed.data.session.user.id };
    }
    await supabase.auth.signOut();
  }

  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.session) return null;
  return { session: signedIn.data.session, guestId: signedIn.data.session.user.id };
}

/** Clear any local session and create a fresh anonymous guest (401 recovery). */
export async function recoverGuestSession(): Promise<{ session: Session; guestId: string } | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  await supabase.auth.signOut();
  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.session) return null;
  return { session: signedIn.data.session, guestId: signedIn.data.session.user.id };
}

export const browserGuestAuth: GuestRoomAuth = {
  async ensure() {
    const guest = await ensureGuestSession();
    return guest ? fromSession(guest.session) : null;
  },
  async recover() {
    const guest = await recoverGuestSession();
    return guest ? fromSession(guest.session) : null;
  },
};
