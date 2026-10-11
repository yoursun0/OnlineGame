'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatAndDogDifficulty, CatAndDogTable } from '../../cat-and-dog-table';
import { ConnectFourBoard } from '../../connect-four-board';
import { DownstairsWell } from '../../downstairs-well';
import { TienGowBoard } from '../../tien-gow-board';
import { isCatAndDogState, type CatAndDogMove, type CatAndDogState, type Difficulty } from '@playroom/cat-and-dog';
import type { ConnectFourState } from '@playroom/connect-four';
import { isDownstairsRoomState, type DownstairsRoomState } from '@playroom/downstairs';
import type { TicTacToeState } from '@playroom/tic-tac-toe';
import { isTienGowView, type Move as TienGowMove, type View as TienGowView } from '@playroom/tien-gow';
import { browserGuestAuth, getBrowserSupabase } from '../../lib/supabase-browser';
import { readGuestRequestResult, requestWithGuestRetry } from '../../lib/guest-room-fetch';
import { LanguageToggle, translateError, useLanguage } from '../../language';
import { errorAfterSuccessfulRefresh } from '../../room-error-state';
import { roomHeadline } from '../../room-headline';
import { canHostStartRoom } from '../../room-start';
import { canShowRoomReplay } from '../../room-replay';
import { tienGowLobbySlots, tienGowSeatMark, tienGowSeatWind } from '../../tien-gow-seats';
import { roomRefreshIsStale, tienGowCpuPlaybackPlan, type TienGowCpuFrame } from '../../tien-gow-cpu-playback';
import { canDealTienGowHand, tableFromLobbyState, type TienGowLobbyState } from '../../tien-gow-table';
import { TienGowTableOptions } from '../../tien-gow-table-options';

type GameState = TicTacToeState | ConnectFourState | DownstairsRoomState | TienGowView | TienGowLobbyState;
type Room = { id: string; code: string; game_slug: string; mode: 'realtime' | 'turn_based'; status: 'open' | 'playing' | 'finished' | 'expired'; host_guest_id: string; state: GameState; version: number; max_players: number };
type Member = { guest_id: string; display_name: string; seat: number; is_ready: boolean; is_cpu?: boolean };
type Snapshot = { room: Room; members: Member[]; events: Array<{ version: number; event_type: string }> };

async function fetchSnapshot(code: string, sinceVersion = 0) {
  const suffix = sinceVersion > 0 ? `?since=${sinceVersion}` : '';
  const result = await requestWithGuestRetry(
    async (accessToken) => {
      const response = await fetch(`/api/rooms/${code}${suffix}`, { headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      return readGuestRequestResult(response);
    },
    browserGuestAuth,
    { connectError: 'Connect Supabase before entering a room.', failureFallback: 'Could not load room.' },
  );
  return { snapshot: result.data as Snapshot, guestId: result.guestId, token: result.accessToken };
}

function isOwnTurn(room: Room, seat: number) {
  if (room.game_slug === 'downstairs') return false;
  if (room.game_slug === 'tien-gow') {
    const state = room.state as TienGowView;
    return state.phase !== 'recap' && state.toAct === seat;
  }
  if (room.game_slug === 'cat-and-dog') {
    if (!isCatAndDogState(room.state)) return false;
    return (room.state.toAct === 'cat' && seat === 0) || (room.state.toAct === 'dog' && seat === 1);
  }
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
  const [difficulty, setDifficulty] = useState<Difficulty>('level1');
  const lastVersionRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const animatingRef = useRef(false);
  const playbackGeneration = useRef(0);
  const isConnect = snapshot?.room.game_slug === 'connect-four';
  const isCat = snapshot?.room.game_slug === 'cat-and-dog';
  const isDownstairs = snapshot?.room.game_slug === 'downstairs';
  const isTienGow = snapshot?.room.game_slug === 'tien-gow';
  const text = language === 'en' ? {
    room: 'Room', back: 'Back to lobby', loading: 'Loading room…', leave: 'Leave room ↗',
    game: isDownstairs ? '小朋友落樓梯' : isTienGow ? 'Tien Gow' : isCat ? 'Cat-and-Dog' : isConnect ? 'Connect Four' : 'Tic-tac-toe',
    turnBased: 'Turn-based', realTime: 'Real-time',
    players: 'Players', of: 'of', host: 'host', ready: 'Ready', waiting: 'Waiting',
    unready: 'Unready', imReady: 'I’m ready', start: 'Start game →', startVsCpu: 'Start vs CPU →', startSolo: 'Start solo →', startShared: 'Start shared well →',
    waitingBoth: isDownstairs || isTienGow ? 'Waiting for players' : 'Waiting for both players', replay: 'Replay', reportRoom: 'Report room', cpu: 'CPU',
    cpuAtStart: 'at start',
    reportReason: 'Optional reason', reported: 'Reported', report: 'Report',
    help: isDownstairs
      ? 'Solo alone, or invite up to three friends for a Shared well (max 4). Live play uses Broadcast; the server stores start, sparse Checkpoints, deaths, and finish. Joins after start are rejected.'
      : isTienGow
        ? 'Share the TGW code. One to four humans can join; empty seats become CPU at start. Seats 0–3 (南/東/北/西) shuffle randomly when the host starts. Host sets Table options in the lobby (lab defaults). Each human only sees their own hand. CPU seats then play one step at a time. Min 1 human; 2–4 humans must all be ready.'
        : isCat
        ? 'Share the CAD code. Seat 0 is Cat and seat 1 is Dog; the guests are shuffled at start. Hold, then release, to throw. A solo host picks a difficulty and starts versus CPU. Replay stays available only while both seats are occupied.'
        : 'Share the code with one other player, or start versus CPU. The server owns the room state and every move.',
  } : {
    room: '房間', back: '返回大堂', loading: '正在載入房間…', leave: '離開房間 ↗',
    game: isDownstairs ? '小朋友落樓梯' : isTienGow ? '打天九' : isCat ? '貓狗大作戰' : isConnect ? '四子棋' : '井字過三關',
    turnBased: '回合制', realTime: '即時模式',
    players: '玩家', of: '/', host: '房主', ready: '已準備', waiting: '等待中',
    unready: '取消準備', imReady: '我準備好了', start: '開始遊戲 →', startVsCpu: '對戰電腦 →', startSolo: '單人開局 →', startShared: '開始共用井 →',
    waitingBoth: isDownstairs || isTienGow ? '等待玩家' : '等待兩位玩家準備', replay: '重玩一次', reportRoom: '舉報房間', cpu: '電腦',
    cpuAtStart: '開局補上',
    reportReason: '可選填原因', reported: '已舉報', report: '舉報',
    help: isDownstairs
      ? '可單人即開 Solo 井，或邀請最多三位朋友開 Shared 共用井（最多 4 人）。即時用 Broadcast；伺服器只記開局、稀疏 Checkpoint、死亡與結束。開局後無法再加入。'
      : isTienGow
        ? '分享 TGW 房號。一至四人可加入；空位在開局時由電腦補上。座位 0–3（南／東／北／西）會在房主開局時隨機分配。房主在大廳設定臺面規則（與 lab 預設相同）。每位玩家只看見自己的手牌。電腦之後會逐手出牌。至少 1 人即可開；2–4 人時全員要準備。'
        : isCat
        ? '分享 CAD 房號。座位 0 是貓，座位 1 是狗，開局時會把人隨機放進去。按住再放開就能投擲。一個人時先選難度，再對戰電腦。重玩時兩個座位都要有人。'
        : '把房號分享給另一位玩家，或直接開始對戰電腦。伺服器會管理房間狀態並核實每一步。',
  };

  const refresh = useCallback(async () => {
    if (animatingRef.current) return;
    const generation = playbackGeneration.current;
    try {
      const result = await fetchSnapshot(code, lastVersionRef.current);
      if (roomRefreshIsStale(animatingRef.current, generation, playbackGeneration.current)) return;
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
    let interval = window.setInterval(() => { void refresh(); }, supabase ? 5000 : 1500);
    const reconcile = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    if (!supabase) return () => { window.clearInterval(interval); window.removeEventListener('online', reconcile); document.removeEventListener('visibilitychange', reconcile); };
    const channel = supabase.channel(`room:${snapshot.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${snapshot.room.id}` }, () => { void refresh(); })
      .subscribe((status) => {
        window.clearInterval(interval);
        interval = window.setInterval(() => { void refresh(); }, status === 'SUBSCRIBED' ? 30000 : 5000);
      });
    return () => { window.clearInterval(interval); window.removeEventListener('online', reconcile); document.removeEventListener('visibilitychange', reconcile); void supabase.removeChannel(channel); };
  }, [snapshot?.room.id, refresh]);


  function holdRoomRefresh() {
    if (snapshot?.room.game_slug !== 'tien-gow') return;
    playbackGeneration.current += 1;
    animatingRef.current = true;
  }

  async function publishCommandSnapshot(payload: Snapshot & { cpuOpening?: unknown; cpuFrames?: TienGowCpuFrame[] }) {
    const plan = payload.room.game_slug === 'tien-gow'
      ? tienGowCpuPlaybackPlan({
          opening: payload.cpuOpening,
          frames: payload.cpuFrames ?? [],
          finalState: payload.room.state,
        })
      : [];
    if (plan.length > 0) {
      playbackGeneration.current += 1;
      animatingRef.current = true;
    }
    try {
      for (const step of plan) {
        if (step.waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, step.waitMs));
        setSnapshot({ ...payload, room: { ...payload.room, state: step.state } });
      }
      lastVersionRef.current = payload.room.version;
      hasSnapshotRef.current = true;
      const { cpuOpening: _cpuOpening, cpuFrames: _cpuFrames, ...rest } = payload;
      setSnapshot(rest);
    } finally {
      animatingRef.current = false;
    }
  }

  async function action(actionName: string, body: Record<string, unknown> = {}) {
    setBusy(true); setError('');
    holdRoomRefresh();
    try {
      const result = await requestWithGuestRetry(
        async (accessToken) => {
          const response = await fetch(`/api/rooms/${code}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: actionName, ...body }) });
          return readGuestRequestResult(response);
        },
        {
          ensure: async () => (token ? { accessToken: token, guestId } : browserGuestAuth.ensure()),
          recover: browserGuestAuth.recover,
        },
        { connectError: 'Connect Supabase before entering a room.', failureFallback: 'Room action failed.' },
      );
      setToken(result.accessToken);
      setGuestId(result.guestId);
      const payload = result.data as Snapshot & { left?: boolean; cpuOpening?: unknown; cpuFrames?: TienGowCpuFrame[] };
      if (payload.left) { window.location.assign('/'); return; }
      await publishCommandSnapshot(payload);
      if (actionName === 'report') { setReportSubmitted(true); setReportReason(''); }
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Room action failed.', language)); }
    finally { animatingRef.current = false; setBusy(false); }
  }

  async function playMove(body: { cell?: number; column?: number } | TienGowMove | CatAndDogMove) {
    setBusy(true); setError('');
    holdRoomRefresh();
    try {
      const result = await requestWithGuestRetry(
        async (accessToken) => {
          const response = await fetch(`/api/rooms/${code}/move`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
          return readGuestRequestResult(response);
        },
        {
          ensure: async () => (token ? { accessToken: token, guestId } : browserGuestAuth.ensure()),
          recover: browserGuestAuth.recover,
        },
        { connectError: 'Connect Supabase before entering a room.', failureFallback: 'Move rejected.' },
      );
      setToken(result.accessToken);
      setGuestId(result.guestId);
      const payload = result.data as Snapshot & { cpuOpening?: unknown; cpuFrames?: TienGowCpuFrame[] };
      await publishCommandSnapshot(payload);
    } catch (requestError) { setError(translateError(requestError instanceof Error ? requestError.message : 'Move rejected.', language)); }
    finally { animatingRef.current = false; setBusy(false); }
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
  const canReplay = Boolean(snapshot && canShowRoomReplay({
    status: snapshot.room.status,
    gameSlug: snapshot.room.game_slug,
    isMember: Boolean(ownMember),
    memberCount: snapshot.members.length,
    maxPlayers: snapshot.room.max_players,
    humanCount,
    hostStillPresent: snapshot.members.some((member) => member.guest_id === snapshot.room.host_guest_id),
  }));
  const ownTurn = Boolean(ownMember && snapshot && isOwnTurn(snapshot.room, ownMember.seat));
  const winnerMessage = snapshot
    ? roomHeadline({ status: snapshot.room.status, state: snapshot.room.state, members: snapshot.members, language, gameSlug: snapshot.room.game_slug })
    : '';

  if (error && !snapshot) return <main className="room-shell"><div className="room-header"><Brand /><LanguageToggle /></div><div className="room-error"><p className="eyebrow">{text.room} {code}</p><h1>{error}</h1><a className="button button-dark" href="/">{text.back}</a></div></main>;
  if (!snapshot) return <main className="room-shell"><div className="room-header"><Brand /><LanguageToggle /></div><p className="room-loading">{text.loading}</p></main>;

  const downstairsState = isDownstairs && isDownstairsRoomState(snapshot.room.state) ? snapshot.room.state : null;
  const tienGowView = isTienGow && isTienGowView(snapshot.room.state) ? snapshot.room.state : null;
  const tgwLobbyTable = isTienGow ? tableFromLobbyState(snapshot.room.state) : null;
  const catState = isCat && isCatAndDogState(snapshot.room.state) ? snapshot.room.state as CatAndDogState : null;
  const startBody = isTienGow && tgwLobbyTable ? { table: tgwLobbyTable } : isCat && humanCount === 1 ? { difficulty } : {};
  const canDeal = Boolean(tienGowView && canDealTienGowHand({
    status: snapshot.room.status,
    phase: tienGowView.phase,
    isMember: Boolean(ownMember),
    isCpu: ownMember?.is_cpu,
  }));
  const board = isTienGow && snapshot.room.status === 'playing' && tienGowView
    ? <TienGowBoard
        view={tienGowView}
        members={snapshot.members}
        onMove={(move) => void playMove(move)}
        disabled={busy || !ownTurn}
        language={language}
        isHost={snapshot.room.host_guest_id === guestId}
        onNext={() => void action('next')}
        onRematch={() => void action('rematch')}
        canDeal={canDeal}
        dealBusy={busy}
      />
    : (snapshot.room.status === 'playing' || snapshot.room.status === 'finished') && !isTienGow
    ? isDownstairs && downstairsState
      ? <DownstairsWell
          key={`well-${snapshot.room.version}`}
          roomState={downstairsState}
          roomVersion={snapshot.room.version}
          roomId={snapshot.room.id}
          guestId={guestId}
          hostGuestId={snapshot.room.host_guest_id}
          token={token}
          code={code}
          isHost={snapshot.room.host_guest_id === guestId}
          language={language}
          canReplay={canReplay}
          replayBusy={busy}
          onReplay={() => void action('replay')}
          onPersisted={onWellPersisted}
          onError={(message) => setError(translateError(message, language))}
        />
      : isCat && catState
        ? <CatAndDogTable state={catState} onMove={(move) => void playMove(move)} disabled={busy || snapshot.room.status === 'finished' || !ownTurn} language={language} />
        : isCat
        ? <div className="cad-lobby"><div className="waiting-mark">貓|狗<br />{language === 'en' ? 'Cat-and-Dog' : '貓狗大作戰'}</div></div>
        : isConnect
        ? <ConnectFourBoard state={snapshot.room.state as ConnectFourState} onMove={(column) => void playMove({ column })} disabled={busy || snapshot.room.status === 'finished' || !ownTurn} language={language} />
        : <Board state={snapshot.room.state as TicTacToeState} onMove={(cell) => void playMove({ cell })} disabled={busy || snapshot.room.status === 'finished' || !ownTurn} language={language} />
    : isTienGow && tgwLobbyTable
      ? <div className="tgw-play tgw-lobby-setup">
          <div className="waiting-mark waiting-mark-tiengow">天九<br />{language === 'en' ? 'Tien Gow lobby' : '打天九大廳'}</div>
          <TienGowTableOptions
            table={tgwLobbyTable}
            editable={snapshot.room.status === 'open' && snapshot.room.host_guest_id === guestId}
            language={language}
            onChange={(table) => void action('table', { table })}
          />
        </div>
      : isCat
      ? <div className="cad-lobby"><div className="waiting-mark">貓|狗<br />{language === 'en' ? 'Cat-and-Dog' : '貓狗大作戰'}</div>{humanCount === 1 ? <CatAndDogDifficulty value={difficulty} onChange={setDifficulty} language={language} /> : null}</div>
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
      <aside className="room-sidebar"><div className="player-list"><div className="sidebar-label">{text.players} / {isTienGow ? snapshot.members.filter((member) => !member.is_cpu).length : snapshot.members.length} {text.of} {snapshot.room.max_players}</div>{isTienGow
        ? tienGowLobbySlots(snapshot.members).map((slot) => {
            const member = slot.member;
            const empty = !slot.occupied;
            const isCpu = empty || Boolean(member?.is_cpu);
            const label = empty ? `${text.cpu} · ${text.cpuAtStart}` : isCpu ? text.cpu : `${tienGowSeatWind(slot.seat, language)} · ${member!.display_name}`;
            return <div className={`player-row${empty ? ' player-row-empty' : ''}`} key={slot.seat}>
              <span className={`player-mark player-mark-${slot.seat} player-mark-tiengow`}>{tienGowSeatMark(slot.seat, language)}</span>
              <span>{label}{!isCpu && member!.guest_id === snapshot.room.host_guest_id ? ` · ${text.host}` : ''}</span>
              <span className={isCpu ? 'cpu-badge' : member!.is_ready ? 'ready-label' : 'waiting-label'}>{isCpu ? text.cpu : member!.is_ready ? text.ready : text.waiting}</span>
            </div>;
          })
        : snapshot.members.map((member) => <div className="player-row" key={member.guest_id}><span className={`player-mark player-mark-${member.seat}${isConnect ? ' player-mark-connect' : ''}`}>{isDownstairs ? '⇧' : isConnect ? '' : isCat ? (member.seat === 0 ? (language === 'en' ? 'Cat' : '貓') : (language === 'en' ? 'Dog' : '狗')) : member.seat === 0 ? 'X' : 'O'}</span><span>{member.is_cpu ? text.cpu : member.display_name}{!member.is_cpu && member.guest_id === snapshot.room.host_guest_id ? ` · ${text.host}` : ''}</span><span className={member.is_ready ? 'ready-label' : 'waiting-label'}>{member.is_ready ? text.ready : text.waiting}</span></div>)}</div><div className="room-controls">{snapshot.room.status === 'open' && ownMember && humanCount > 1 && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('ready', { ready: !ownMember.is_ready })}>{ownMember.is_ready ? text.unready : text.imReady} <span>→</span></button>}{snapshot.room.status === 'open' && snapshot.room.host_guest_id === guestId && <button className="button button-dark" disabled={busy || !canStart} type="button" onClick={() => void action('start', startBody)}>{startLabel}</button>}{canReplay && <button className="button button-primary" disabled={busy} type="button" onClick={() => void action('replay')}>{text.replay} <span>→</span></button>}</div><form className="report-form" onSubmit={(event) => { event.preventDefault(); if (reportReason.trim()) void action('report', { reason: reportReason }); }}><label htmlFor="report-reason">{text.reportRoom}</label><input id="report-reason" value={reportReason} maxLength={280} onChange={(event) => { setReportReason(event.target.value); setReportSubmitted(false); }} placeholder={text.reportReason} /><button className="button button-quiet" disabled={busy || !reportReason.trim()} type="submit">{reportSubmitted ? text.reported : text.report}</button></form><p className="room-help">{text.help}</p></aside>
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
