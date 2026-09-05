'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient = createClient(url, key);
  return browserClient;
}

export async function ensureGuestSession(): Promise<{ session: Session; guestId: string } | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const current = await supabase.auth.getSession();
  if (current.data.session) {
    return { session: current.data.session, guestId: current.data.session.user.id };
  }
  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.session) return null;
  return { session: signedIn.data.session, guestId: signedIn.data.session.user.id };
}
