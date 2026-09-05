'use client';

import { useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SessionStatus = 'checking' | 'ready' | 'unavailable' | 'error';

let client: SupabaseClient | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

export function GuestSession() {
  const [status, setStatus] = useState<SessionStatus>('checking');

  useEffect(() => {
    let active = true;
    const supabase = getClient();
    if (!supabase) {
      setStatus('unavailable');
      return () => { active = false; };
    }

    void (async () => {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (active) setStatus('ready');
        return;
      }
      const { error } = await supabase.auth.signInAnonymously();
      if (!active) return;
      setStatus(error ? 'error' : 'ready');
    })();

    return () => { active = false; };
  }, []);

  const label = status === 'ready' ? 'guest session ready' : status === 'unavailable' ? 'connect Supabase to play' : status === 'error' ? 'guest session unavailable' : 'starting guest session…';
  return <span className={`session-status session-${status}`} aria-live="polite"><i aria-hidden="true" />{label}</span>;
}
