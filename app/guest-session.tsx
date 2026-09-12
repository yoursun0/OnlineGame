'use client';

import { useEffect, useState } from 'react';
import { ensureGuestSession } from './lib/supabase-browser';
import { useLanguage } from './language';

type SessionStatus = 'checking' | 'ready' | 'unavailable' | 'error';

export function GuestSession() {
  const { language } = useLanguage();
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

  const labels = language === 'en'
    ? { ready: 'guest session ready', unavailable: 'connect Supabase to play', error: 'guest session unavailable', checking: 'starting guest session…' }
    : { ready: '訪客工作階段已就緒', unavailable: '連接 Supabase 後即可遊玩', error: '訪客工作階段無法使用', checking: '正在啟動訪客工作階段…' };
  const label = labels[status];
  return <span className={`session-status session-${status}`} aria-live="polite"><i aria-hidden="true" />{label}</span>;
}
