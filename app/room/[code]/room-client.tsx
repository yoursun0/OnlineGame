'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureGuestSession, getBrowserSupabase } from '../../lib/supabase-browser';
import type { TicTacToeState } from '@playroom/tic-tac-toe';
import { LanguageToggle, translateError, useLanguage } from '../../language';
import { errorAfterSuccessfulRefresh } from '../../room-error-state';
import { roomHeadline } from '../../room-headline';

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
  const { language } = useLanguage();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [guestId, setGuestId] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const lastVersionRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const text = language === 'en' ? {
    room: 'Room', back: 'Back to lobby', loading: 'Loading room…', leave: 'Leave room ↗', game: 'Tic-tac-toe', turnBased: 'Turn-based', realTime: 'Real-time',
    players: 'Players', of: 'of', host: 'host', ready: 'Ready', waiting: 'Waiting',
    unready: 'Unready', imReady: 'I’m ready', start: 'Start game →', waitingBoth: 'Waiting for both players', replay: 'Replay', reportRoom: 'Report room',
    reportReason: 'Optional reason', reported: 'Reported', report: 'Report', help: 'Share the code with one other player. The server owns the room state and every move.',
  } : {
    room: '房間', back: '返回大堂', loading: '正在載入房間…', leave: '離開房間 ↗', game: '井字過三關', turnBased: '回合制', realTime: '即時模式',
    players: '玩家', of: '/', host: '房主', ready: '已準備', waiting: '等待中',
    unready: '取消準備', imReady: '我準備好了', start: '開始遊戲 →', waitingBoth: '等待兩位玩家準備', replay: '重玩一次', reportRoom: '舉報房間',
    reportReason: '可選填原因', reported: '已舉報', report: '舉報', help: '把房號分享給另一位玩家。伺服器會管理房間狀態並核實每一步。',
  };

  const refresh = useCallback(async () => {
    try {
      const result = await fetchSnapshot(code, lastVersionRef.current);
      const alreadyHadSnapshot = hasSnapshotRef.current;
      lastVersionRef.current = result.snapshot.room.version;
      hasSnapshotRef.current = true;
      setSnapshot(result.snapshot); setGuestId(result.guestId); setToken(result.token);
      setError((current) => errorAfterSuccessfulRefresh(current, alreadyHadSnapshot));
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Could not load room.', language)); }
  }, [code, language]);

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
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Room action failed.', language)); }
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
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Move rejected.', language)); }
    finally { setBusy(false); }
  }

  const ownMember = useMemo(() => snapshot?.members.find((member) => member.guest_id === guestId), [snapshot, guestId]);
  const allReady = Boolean(snapshot && snapshot.members.length === snapshot.room.max_players && snapshot.members.every((member) => member.is_ready));
  const winnerMessage = snapshot
    ? roomHeadline({ status: snapshot.room.status, state: snapshot.room.state, members: snapshot.members, language })
    : '';

  if (error && !snapshot) return <main className="room-shell"><div className="room-header"><Brand /><LanguageToggle /></div><div className="room-error"><p className="eyebrow">{text.room} {code}</p><h1>{error}</h1><a className="button button-dark" href="/">{text.back}</a></div></main>;
  if (!snapshot) return <main className="room-shell"><div className="room-header"><Brand /><LanguageToggle /></div><p className="room-loading">{text.loading}</p></main>;

  return <main className="room-shell">
    <header className="room-header"><Brand /><div className="room-code-badge"><span>{text.room}</span><strong>{snapshot.room.code}</strong></div><div className="room-header-actions"><LanguageToggle /><button className="button button-quiet" type="button" onClick={() => void action('leave')}>{text.leave}</button></div></header>
    <section className="room-layout">
      <div className="room-main"><p className="eyebrow">{text.game} / {snapshot.room.mode === 'realtime' ? text.realTime : text.turnBased}</p><h1>{winnerMessage}</h1>{snapshot.room.status === 'playing' || snapshot.room.status === 'finished' ? <Board state={snapshot.room.state} onMove={move} disabled={busy || snapshot.room.status === 'finished'} language={language} /> : <div className="waiting-mark">× ○<br />○ ×</div>}{error && <p className="form-error room-inline-error">{error}</p>}</div>
      <aside className="room-sidebar"><div className="player-list"><div className="sidebar-label">{text.players} / {snapshot.members.length} {text.of} {snapshot.room.max_players}</div>{snapshot.members.map((member) => <div className="player-row" key={member.guest_id}><span className={`player-mark player-mark-${member.seat}`}>{member.seat === 0 ? 'X' : 'O'}</span><span>{member.display_name}{member.guest_id === snapshot.room.host_guest_id ? ` · ${text.host}` : ''}</span><span className={member.is_ready ? 'ready-label' : 'waiting-label'}>{member.is_ready ? text.ready : text.waiting}</span></div>)}</div><div className="room-controls">{snapshot.room.status === 'open' && ownMember && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('ready', { ready: !ownMember.is_ready })}>{ownMember.is_ready ? text.unready : text.imReady} <span>→</span></button>}{snapshot.room.status === 'open' && snapshot.room.host_guest_id === guestId && <button className="button button-dark" disabled={busy || !allReady} type="button" onClick={() => void action('start')}>{allReady ? text.start : text.waitingBoth}</button>}{snapshot.room.status === 'finished' && ownMember && snapshot.members.length === snapshot.room.max_players && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('replay')}>{text.replay} <span>→</span></button>}</div><form className="report-form" onSubmit={(event) => { event.preventDefault(); if (reportReason.trim()) void action('report', { reason: reportReason }); }}><label htmlFor="report-reason">{text.reportRoom}</label><input id="report-reason" value={reportReason} maxLength={280} onChange={(event) => { setReportReason(event.target.value); setReportSubmitted(false); }} placeholder={text.reportReason} /><button className="button button-quiet" disabled={busy || !reportReason.trim()} type="submit">{reportSubmitted ? text.reported : text.report}</button></form><p className="room-help">{text.help}</p></aside>
    </section>
  </main>;
}

function Brand() {
  return <a className="brand" href="/" aria-label="PLAYROOM home"><span className="brand-mark" aria-hidden="true" /><span className="brand-name">PLAYROOM</span><span className="brand-local">玩房</span></a>;
}

function Board({ state, onMove, disabled, language }: { state: TicTacToeState; onMove: (cell: number) => void; disabled: boolean; language: 'en' | 'zh-Hant' }) {
  const boardLabel = language === 'en' ? 'Tic-tac-toe board' : '井字過三關棋盤';
  return <div className="board" aria-label={boardLabel}>{state.board.map((mark, index) => <button className={`board-cell board-cell-${mark ?? 'empty'}`} disabled={disabled || Boolean(mark)} key={index} type="button" onClick={() => onMove(index)} aria-label={mark ? `${language === 'en' ? 'Cell' : '棋格'} ${index + 1}: ${mark}` : `${language === 'en' ? 'Play cell' : '在棋格落子'} ${index + 1}`}>{mark}</button>)}</div>;
}
