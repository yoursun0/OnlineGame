'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureGuestSession, getBrowserSupabase } from '../../lib/supabase-browser';
import type { TicTacToeState } from '@playroom/tic-tac-toe';

type Room = { id: string; code: string; game_slug: string; mode: 'realtime' | 'turn_based'; status: 'open' | 'playing' | 'finished' | 'expired'; host_guest_id: string; state: TicTacToeState; version: number; max_players: number };
type Member = { guest_id: string; display_name: string; seat: number; is_ready: boolean };
type Snapshot = { room: Room; members: Member[]; events: Array<{ version: number; event_type: string }> };

async function fetchSnapshot(code: string, sinceVersion = 0) {
  const guest = await ensureGuestSession();
  if (!guest) throw new Error('Connect Supabase before entering a room.');
  const suffix = sinceVersion > 0 ? `?since=${sinceVersion}` : '';
  const response = await fetch(`/api/rooms/${code}${suffix}`, { headers: { authorization: `Bearer ${guest.session.access_token}` }, cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Could not load room.');
  return { snapshot: payload as Snapshot, guestId: guest.guestId, token: guest.session.access_token };
}

export function RoomClient({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [guestId, setGuestId] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const lastVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchSnapshot(code, lastVersionRef.current);
      lastVersionRef.current = result.snapshot.room.version;
      setSnapshot(result.snapshot); setGuestId(result.guestId); setToken(result.token); setError('');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not load room.'); }
  }, [code]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!snapshot) return;
    const supabase = getBrowserSupabase();
    const interval = window.setInterval(() => { void refresh(); }, supabase ? 5000 : 1500);
    const reconcile = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    if (!supabase) return () => { window.clearInterval(interval); window.removeEventListener('online', reconcile); document.removeEventListener('visibilitychange', reconcile); };
    const channel = supabase.channel(`room:${snapshot.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${snapshot.room.id}` }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${snapshot.room.id}` }, () => { void refresh(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `room_id=eq.${snapshot.room.id}` }, () => { void refresh(); })
      .subscribe();
    return () => { window.clearInterval(interval); window.removeEventListener('online', reconcile); document.removeEventListener('visibilitychange', reconcile); void supabase.removeChannel(channel); };
  }, [snapshot?.room.id, refresh]);

  async function action(actionName: string, body: Record<string, unknown> = {}) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/rooms/${code}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: actionName, ...body }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Room action failed.');
      if (payload.left) { window.location.assign('/'); return; }
      lastVersionRef.current = (payload as Snapshot).room.version;
      setSnapshot(payload as Snapshot);
      if (actionName === 'report') { setReportSubmitted(true); setReportReason(''); }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Room action failed.'); }
    finally { setBusy(false); }
  }

  async function move(cell: number) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/rooms/${code}/move`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ cell }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Move rejected.');
      lastVersionRef.current = (payload as Snapshot).room.version;
      setSnapshot(payload as Snapshot);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Move rejected.'); }
    finally { setBusy(false); }
  }

  const ownMember = useMemo(() => snapshot?.members.find((member) => member.guest_id === guestId), [snapshot, guestId]);
  const allReady = Boolean(snapshot && snapshot.members.length === snapshot.room.max_players && snapshot.members.every((member) => member.is_ready));
  const winnerMessage = snapshot?.room.status === 'finished' ? 'Game complete — check the final board.' : snapshot?.room.status === 'playing' ? `Turn: ${snapshot.room.state.nextMark}` : 'Waiting room';

  if (error && !snapshot) return <main className="room-shell"><a className="brand" href="/">PLAYROOM<span>／玩房</span></a><div className="room-error"><p className="eyebrow">ROOM {code}</p><h1>{error}</h1><a className="button button-dark" href="/">Back to lobby</a></div></main>;
  if (!snapshot) return <main className="room-shell"><a className="brand" href="/">PLAYROOM<span>／玩房</span></a><p className="room-loading">Loading room…</p></main>;

  return <main className="room-shell">
    <header className="room-header"><a className="brand" href="/">PLAYROOM<span>／玩房</span></a><div className="room-code-badge"><span>ROOM CODE</span><strong>{snapshot.room.code}</strong></div><button className="button button-quiet" type="button" onClick={() => void action('leave')}>Leave room ↗</button></header>
    <section className="room-layout">
      <div className="room-main"><p className="eyebrow">TIC-TAC-TOE / {snapshot.room.mode === 'realtime' ? 'REAL-TIME' : 'TURN-BASED'}</p><h1>{winnerMessage}</h1>{snapshot.room.status === 'playing' || snapshot.room.status === 'finished' ? <Board state={snapshot.room.state} onMove={move} disabled={busy || snapshot.room.status === 'finished'} /> : <div className="waiting-mark">× ○<br />○ ×</div>}{error && <p className="form-error room-inline-error">{error}</p>}</div>
      <aside className="room-sidebar"><div className="player-list"><div className="sidebar-label">PLAYERS / {snapshot.members.length} OF {snapshot.room.max_players}</div>{snapshot.members.map((member) => <div className="player-row" key={member.guest_id}><span className={`player-mark player-mark-${member.seat}`}>{member.seat === 0 ? 'X' : 'O'}</span><span>{member.display_name}{member.guest_id === snapshot.room.host_guest_id ? ' · host' : ''}</span><span className={member.is_ready ? 'ready-label' : 'waiting-label'}>{member.is_ready ? 'READY' : 'WAITING'}</span></div>)}</div><div className="room-controls">{snapshot.room.status === 'open' && ownMember && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('ready', { ready: !ownMember.is_ready })}>{ownMember.is_ready ? 'Unready' : 'I’m ready'} <span>→</span></button>}{snapshot.room.status === 'open' && snapshot.room.host_guest_id === guestId && <button className="button button-dark" disabled={busy || !allReady} type="button" onClick={() => void action('start')}>{allReady ? 'Start game →' : 'Waiting for both players'}</button>}</div><form className="report-form" onSubmit={(event) => { event.preventDefault(); if (reportReason.trim()) void action('report', { reason: reportReason }); }}><label htmlFor="report-reason">Report room</label><input id="report-reason" value={reportReason} maxLength={280} onChange={(event) => { setReportReason(event.target.value); setReportSubmitted(false); }} placeholder="Optional reason" /><button className="button button-quiet" disabled={busy || !reportReason.trim()} type="submit">{reportSubmitted ? 'Reported' : 'Report'}</button></form><p className="room-help">Share the code with one other player. The server owns the room state and every move.</p></aside>
    </section>
  </main>;
}

function Board({ state, onMove, disabled }: { state: TicTacToeState; onMove: (cell: number) => void; disabled: boolean }) {
  return <div className="board" aria-label="Tic-tac-toe board">{state.board.map((mark, index) => <button className={`board-cell board-cell-${mark ?? 'empty'}`} disabled={disabled || Boolean(mark)} key={index} type="button" onClick={() => onMove(index)} aria-label={mark ? `Cell ${index + 1}: ${mark}` : `Play cell ${index + 1}`}>{mark}</button>)}</div>;
}
