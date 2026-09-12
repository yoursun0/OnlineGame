'use client';

import { FormEvent, useState } from 'react';
import { ensureGuestSession } from './lib/supabase-browser';
import { translateError, useLanguage } from './language';

async function callRoomApi(path: string, body: unknown) {
  const guest = await ensureGuestSession();
  if (!guest) throw new Error('Connect Supabase before creating or joining a room.');
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${guest.session.access_token}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Room request failed.');
  return payload as { code: string };
}

export function CreateRoomButton({ gameSlug }: { gameSlug: string }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await callRoomApi('/api/rooms', { gameSlug, mode: 'turn_based', displayName: displayName || (language === 'en' ? 'Guest' : '訪客') });
      window.location.assign(`/room/${result.code}`);
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Could not create room.', language)); setBusy(false); }
  }

  if (!open) return <button className="card-cta card-cta-button" type="button" onClick={() => setOpen(true)}>{language === 'en' ? 'Create room' : '建立房間'} <span>→</span></button>;
  return <form className="room-form" onSubmit={createRoom}>
    <label><span>{language === 'en' ? 'Display name' : '顯示名稱'}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={32} placeholder={language === 'en' ? 'Guest' : '訪客'} /></label>
    <label><span>{language === 'en' ? 'Mode' : '模式'}</span><select value="turn_based" disabled><option value="turn_based">{language === 'en' ? 'Turn-based' : '回合制'}</option></select></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-dark form-submit" disabled={busy} type="submit">{busy ? (language === 'en' ? 'Creating…' : '建立中…') : (language === 'en' ? 'Create room →' : '建立房間 →')}</button>
  </form>;
}

export function JoinRoomForm() {
  const { language } = useLanguage();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    const normalized = code.trim().toUpperCase();
    if (!/^(TIK|CON)-[2-9A-HJ-NP-Z]{3}$/.test(normalized)) { setError(language === 'en' ? 'Use a code like TIK-7Q4 or CON-K8P.' : '請輸入類似 TIK-7Q4 或 CON-K8P 的房號。'); setBusy(false); return; }
    try {
      await callRoomApi(`/api/rooms/${normalized}`, { action: 'join', displayName: displayName || (language === 'en' ? 'Guest' : '訪客') });
      window.location.assign(`/room/${normalized}`);
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Could not join room.', language)); setBusy(false); }
  }

  return <form className="join-form join-form-stack" onSubmit={joinRoom}>
    <div className="join-fields"><label className="sr-only" htmlFor="room-code">{language === 'en' ? 'Room code' : '房號'}</label><input id="room-code" name="room-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="TIK-7Q4" maxLength={7} autoComplete="off" /><label className="sr-only" htmlFor="join-name">{language === 'en' ? 'Display name' : '顯示名稱'}</label><input id="join-name" name="join-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={language === 'en' ? 'Your name' : '你的名稱'} maxLength={32} /></div>
    <button className="button button-mint" disabled={busy} type="submit">{busy ? (language === 'en' ? 'Joining…' : '加入中…') : (language === 'en' ? 'Join →' : '入房 →')}</button>
    {error && <p className="form-error">{error}</p>}
  </form>;
}
