'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectFourBoard } from '../../connect-four-board';
import { DownstairsWell } from '../../downstairs-well';
import type { ConnectFourState } from '@playroom/connect-four';
import { isDownstairsRoomState, type DownstairsRoomState } from '@playroom/downstairs';
import type { TicTacToeState } from '@playroom/tic-tac-toe';
import { ensureGuestSession, getBrowserSupabase } from '../../lib/supabase-browser';
import { LanguageToggle, translateError, useLanguage } from '../../language';
import { errorAfterSuccessfulRefresh } from '../../room-error-state';
import { roomHeadline } from '../../room-headline';
import { canHostStartRoom } from '../../room-start';

type GameState = TicTacToeState | ConnectFourState | DownstairsRoomState;
type Room = { id: string; code: string; game_slug: string; mode: 'realtime' | 'turn_based'; status: 'open' | 'playing' | 'finished' | 'expired'; host_guest_id: string; state: GameState; version: number; max_players: number };
type Member = { guest_id: string; display_name: string; seat: number; is_ready: boolean; is_cpu?: boolean };
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

function isOwnTurn(room: Room, seat: number) {
  if (room.game_slug === 'downstairs') return false;
  if (room.game_slug === 'connect-four') {
    const state = room.state as ConnectFourState;
    return (state.nextColor === 'red' && seat === 0) || (state.nextColor === 'yellow' && seat === 1);
  }
  const state = room.state as TicTacToeState;
  return (state.nextMark === 'X' && seat === 0) || (state.nextMark === 'O' && seat === 1);
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
  const isConnect = snapshot?.room.game_slug === 'connect-four';
  const isDownstairs = snapshot?.room.game_slug === 'downstairs';
  const text = language === 'en' ? {
    room: 'Room', back: 'Back to lobby', loading: 'Loading room…', leave: 'Leave room ↗',
    game: isDownstairs ? '小朋友落樓梯' : isConnect ? 'Connect Four' : 'Tic-tac-toe',
    turnBased: 'Turn-based', realTime: 'Real-time',
    players: 'Players', of: 'of', host: 'host', ready: 'Ready', waiting: 'Waiting',
    unready: 'Unready', imReady: 'I’m ready', start: 'Start game →', startVsCpu: 'Start vs CPU →', startSolo: 'Start solo →', startShared: 'Start shared well →',
    waitingBoth: isDownstairs ? 'Waiting for players' : 'Waiting for both players', replay: 'Replay', reportRoom: 'Report room', cpu: 'CPU',
    reportReason: 'Optional reason', reported: 'Reported', report: 'Report',
    help: isDownstairs
      ? 'Solo alone, or invite up to three friends for a Shared well (max 4). Live play uses Broadcast; the server stores start, sparse Checkpoints, deaths, and finish. Joins after start are rejected.'
      : 'Share the code with one other player, or start versus CPU. The server owns the room state and every move.',
  } : {
    room: '房間', back: '返回大堂', loading: '正在載入房間…', leave: '離開房間 ↗',
    game: isDownstairs ? '小朋友落樓梯' : isConnect ? '四子棋' : '井字過三關',
    turnBased: '回合制', realTime: '即時模式',
    players: '玩家', of: '/', host: '房主', ready: '已準備', waiting: '等待中',
    unready: '取消準備', imReady: '我準備好了', start: '開始遊戲 →', startVsCpu: '對戰電腦 →', startSolo: '單人開局 →', startShared: '開始共用井 →',
    waitingBoth: isDownstairs ? '等待玩家' : '等待兩位玩家準備', replay: '重玩一次', reportRoom: '舉報房間', cpu: '電腦',
    reportReason: '可選填原因', reported: '已舉報', report: '舉報',
    help: isDownstairs
      ? '可單人即開 Solo 井，或邀請最多三位朋友開 Shared 共用井（最多 4 人）。即時用 Broadcast；伺服器只記開局、稀疏 Checkpoint、死亡與結束。開局後無法再加入。'
      : '把房號分享給另一位玩家，或直接開始對戰電腦。伺服器會管理房間狀態並核實每一步。',
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

  async function playMove(body: { cell?: number; column?: number }) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/rooms/${code}/move`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Move rejected.');
      lastVersionRef.current = (payload as Snapshot).room.version;
      setSnapshot(payload as Snapshot);
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Move rejected.', language)); }
    finally { setBusy(false); }
  }

  const onWellPersisted = useCallback((payload: unknown) => {
    const next = payload as Snapshot;
    lastVersionRef.current = next.room.version;
    setSnapshot(next);
  }, []);

  const ownMember = useMemo(() => snapshot?.members.find((member) => member.guest_id === guestId), [snapshot, guestId]);
  const humanCount = snapshot?.members.filter((member) => !member.is_cpu).length ?? 0;
  const canStart = Boolean(snapshot && canHostStartRoom({
    status: snapshot.room.status,
    hostGuestId: snapshot.room.host_guest_id,
    guestId,
    members: snapshot.members,
    maxPlayers: snapshot.room.max_players,
    gameSlug: snapshot.room.game_slug,
  }));
  const ownTurn = Boolean(ownMember && snapshot && isOwnTurn(snapshot.room, ownMember.seat));
  const winnerMessage = snapshot
    ? roomHeadline({ status: snapshot.room.status, state: snapshot.room.state, members: snapshot.members, language, gameSlug: snapshot.room.game_slug })
    : '';

  if (error && !snapshot) return <main className="room-shell"><div className="room-header"><Brand /><LanguageToggle /></div><div className="room-error"><p className="eyebrow">{text.room} {code}</p><h1>{error}</h1><a className="button button-dark" href="/">{text.back}</a></div></main>;
  if (!snapshot) return <main className="room-shell"><div className="room-header"><Brand /><LanguageToggle /></div><p className="room-loading">{text.loading}</p></main>;

  const downstairsState = isDownstairs && isDownstairsRoomState(snapshot.room.state) ? snapshot.room.state : null;
  const board = snapshot.room.status === 'playing' || snapshot.room.status === 'finished'
    ? isDownstairs && downstairsState
      ? <DownstairsWell
          roomState={downstairsState}
          roomVersion={snapshot.room.version}
          roomId={snapshot.room.id}
          guestId={guestId}
          token={token}
          code={code}
          isHost={snapshot.room.host_guest_id === guestId}
          language={language}
          onPersisted={onWellPersisted}
          onError={(message) => setError(translateError(message, language))}
        />
      : isConnect
        ? <ConnectFourBoard state={snapshot.room.state as ConnectFourState} onMove={(column) => void playMove({ column })} disabled={busy || snapshot.room.status === 'finished' || !ownTurn} language={language} />
        : <Board state={snapshot.room.state as TicTacToeState} onMove={(cell) => void playMove({ cell })} disabled={busy || snapshot.room.status === 'finished' || !ownTurn} language={language} />
    : <div className={`waiting-mark${isConnect ? ' waiting-mark-connect' : ''}${isDownstairs ? ' waiting-mark-well' : ''}`}>{isDownstairs ? '⇧' : isConnect ? '⬤ ⬤' : '× ○'}<br />{isDownstairs ? (humanCount > 1 ? (language === 'en' ? 'Shared well' : '共用井') : (language === 'en' ? 'Solo well' : '單人井')) : isConnect ? '⬤ ⬤' : '○ ×'}</div>;

  const startLabel = !canStart
    ? text.waitingBoth
    : isDownstairs
      ? (humanCount > 1 ? text.startShared : text.startSolo)
      : humanCount === 1
        ? text.startVsCpu
        : text.start;

  return <main className="room-shell">
    <header className="room-header"><Brand /><div className="room-code-badge"><span>{text.room}</span><strong>{snapshot.room.code}</strong></div><div className="room-header-actions"><LanguageToggle /><button className="button button-quiet" type="button" onClick={() => void action('leave')}>{text.leave}</button></div></header>
    <section className="room-layout">
      <div className="room-main"><p className="eyebrow">{text.game} / {snapshot.room.mode === 'realtime' ? text.realTime : text.turnBased}</p><h1>{winnerMessage}</h1>{board}{error && <p className="form-error room-inline-error">{error}</p>}</div>
      <aside className="room-sidebar"><div className="player-list"><div className="sidebar-label">{text.players} / {snapshot.members.length} {text.of} {snapshot.room.max_players}</div>{snapshot.members.map((member) => <div className="player-row" key={member.guest_id}><span className={`player-mark player-mark-${member.seat}${isConnect ? ' player-mark-connect' : ''}`}>{isDownstairs ? '⇧' : isConnect ? '' : member.seat === 0 ? 'X' : 'O'}</span><span>{member.is_cpu ? text.cpu : member.display_name}{!member.is_cpu && member.guest_id === snapshot.room.host_guest_id ? ` · ${text.host}` : ''}</span><span className={member.is_ready ? 'ready-label' : 'waiting-label'}>{member.is_ready ? text.ready : text.waiting}</span></div>)}</div><div className="room-controls">{snapshot.room.status === 'open' && ownMember && humanCount > 1 && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('ready', { ready: !ownMember.is_ready })}>{ownMember.is_ready ? text.unready : text.imReady} <span>→</span></button>}{snapshot.room.status === 'open' && snapshot.room.host_guest_id === guestId && <button className="button button-dark" disabled={busy || !canStart} type="button" onClick={() => void action('start')}>{startLabel}</button>}{snapshot.room.status === 'finished' && !isDownstairs && ownMember && snapshot.members.length === snapshot.room.max_players && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('replay')}>{text.replay} <span>→</span></button>}</div><form className="report-form" onSubmit={(event) => { event.preventDefault(); if (reportReason.trim()) void action('report', { reason: reportReason }); }}><label htmlFor="report-reason">{text.reportRoom}</label><input id="report-reason" value={reportReason} maxLength={280} onChange={(event) => { setReportReason(event.target.value); setReportSubmitted(false); }} placeholder={text.reportReason} /><button className="button button-quiet" disabled={busy || !reportReason.trim()} type="submit">{reportSubmitted ? text.reported : text.report}</button></form><p className="room-help">{text.help}</p></aside>
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
