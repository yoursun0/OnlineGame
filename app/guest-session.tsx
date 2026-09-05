'use client';

import { useEffect, useState } from 'react';
import { ensureGuestSession } from './lib/supabase-browser';

type SessionStatus = 'checking' | 'ready' | 'unavailable' | 'error';

export function GuestSession() {
  const [status, setStatus] = useState<SessionStatus>('checking');

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await ensureGuestSession();
      if (!active) return;
      setStatus(session ? 'ready' : process.env.NEXT_PUBLIC_SUPABASE_URL ? 'error' : 'unavailable');
    })();

    return () => { active = false; };
  }, []);

  const label = status === 'ready' ? 'guest session ready' : status === 'unavailable' ? 'connect Supabase to play' : status === 'error' ? 'guest session unavailable' : 'starting guest session…';
  return <span className={`session-status session-${status}`} aria-live="polite"><i aria-hidden="true" />{label}</span>;
}
