'use client';

import { FormEvent, useState } from 'react';
import { ensureGuestSession } from './lib/supabase-browser';

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

export function CreateRoomButton() {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'realtime' | 'turn_based'>('realtime');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await callRoomApi('/api/rooms', { gameSlug: 'tic-tac-toe', mode, displayName: displayName || 'Guest' });
      window.location.assign(`/room/${result.code}`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not create room.'); setBusy(false); }
  }

  if (!open) return <button className="card-cta card-cta-button" type="button" onClick={() => setOpen(true)}>Create a room <span>→</span></button>;
  return <form className="room-form" onSubmit={createRoom}>
    <label><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={32} placeholder="Guest" /></label>
    <label><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="realtime">Real-time</option><option value="turn_based">Turn-based</option></select></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-dark form-submit" disabled={busy} type="submit">{busy ? 'Creating…' : 'Create room →'}</button>
  </form>;
}

export function JoinRoomForm() {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    const normalized = code.trim().toUpperCase();
    if (!/^TIK-[2-9A-HJ-NP-Z]{3}$/.test(normalized)) { setError('Use a code like TIK-7Q4.'); setBusy(false); return; }
    try {
      await callRoomApi(`/api/rooms/${normalized}`, { action: 'join', displayName: displayName || 'Guest' });
      window.location.assign(`/room/${normalized}`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not join room.'); setBusy(false); }
  }

  return <form className="join-form join-form-stack" onSubmit={joinRoom}>
    <div className="join-fields"><label className="sr-only" htmlFor="room-code">Room code</label><input id="room-code" name="room-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="TIK-7Q4" maxLength={7} /><label className="sr-only" htmlFor="join-name">Display name</label><input id="join-name" name="join-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" maxLength={32} /></div>
    <button className="button button-dark" disabled={busy} type="submit">{busy ? 'Joining…' : 'Join room →'}</button>
    {error && <p className="form-error">{error}</p>}
  </form>;
}
