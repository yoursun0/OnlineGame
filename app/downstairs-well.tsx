'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Engine,
  MAX_FRAME_DT,
  STAGE_H,
  STAGE_W,
  STEP,
  WELL_BROADCAST_HZ,
  WELL_BROADCAST_INTENT,
  WELL_BROADCAST_SNAPSHOT,
  WELL_CHECKPOINT_INTERVAL_MS,
  WELL_PRESENCE_GRACE_MS,
  applyHostSnapshot,
  applyOwnPrediction,
  asRestorableWell,
  checkpointFromWell,
  createWellIntent,
  createWellSnapshot,
  isWellIntent,
  isWellSnapshot,
  guestWellRefreshOutcome,
  kidsMissingFromOccupants,
  loadWellAssets,
  renderWell,
  shouldPersistHostLeftOnUnload,
  wellTopic,
  winnerGuestIdFromEngine,
  type DownstairsRoomState,
  type WellFinishReason,
  type WellRenderAssets,
} from '@playroom/downstairs';
import type { WellIntentDirection } from '@playroom/game-core';
import { getBrowserSupabase } from './lib/supabase-browser';

type Props = {
  roomState: DownstairsRoomState;
  roomVersion: number;
  roomId: string;
  guestId: string;
  hostGuestId: string;
  token: string;
  code: string;
  isHost: boolean;
  language: 'en' | 'zh-Hant';
  canReplay?: boolean;
  replayBusy?: boolean;
  onReplay?: () => void;
  onPersisted: (snapshot: unknown) => void;
  onError: (message: string) => void;
};

function ownLife(engine: Engine, guestId: string) {
  const kid = engine.players.find((player) => player.guestId === guestId) ?? engine.players[0];
  return Math.max(0, Math.ceil(kid?.life ?? 0));
}

export function DownstairsWell({
  roomState,
  roomVersion,
  roomId,
  guestId,
  hostGuestId,
  token,
  code,
  isHost,
  language,
  canReplay = false,
  replayBusy = false,
  onReplay,
  onPersisted,
  onError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const artRef = useRef<WellRenderAssets | null>(null);
  const versionRef = useRef(roomVersion);
  const seqRef = useRef(roomState.checkpoint?.seq ?? 0);
  const intentRef = useRef<WellIntentDirection>('none');
  const intentSeqRef = useRef(0);
  const ackRef = useRef(0);
  const finishedRef = useRef(roomState.phase === 'finished');
  const shared = (roomState.checkpoint?.well.kids.length ?? 1) > 1;
  const refreshOutcome = guestWellRefreshOutcome(roomState.phase, roomState.checkpoint);
  const [life, setLife] = useState(12);
  const [depth, setDepth] = useState(0);
  const [over, setOver] = useState(roomState.phase === 'finished');
  const [out, setOut] = useState(refreshOutcome === 'out');

  useEffect(() => { versionRef.current = roomVersion; }, [roomVersion]);

  useEffect(() => {
    let cancelled = false;
    void loadWellAssets().then((loaded) => {
      if (cancelled) return;
      artRef.current = { kids: loaded.kids, textures: loaded.textures };
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (engine && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) renderWell(ctx, engine, performance.now() / 1000, artRef.current);
      }
    }).catch(() => {
      // Fallback kid drawing still works without sheets.
    });
    return () => { cancelled = true; };
  }, []);


  useEffect(() => {
    const outcome = guestWellRefreshOutcome(roomState.phase, roomState.checkpoint);
    setOut(outcome === 'out');
    if (outcome === 'finished') {
      finishedRef.current = true;
      setOver(true);
    }
  }, [roomState.phase, roomState.checkpoint]);

  useEffect(() => {
    if (!roomState.checkpoint) return;
    // Restore only once per mount (refresh recovery). Own Checkpoint posts must not reset the live engine.
    if (engineRef.current) return;
    const engine = new Engine();
    engine.restoreFromWell(asRestorableWell(roomState.checkpoint));
    if (roomState.phase === 'finished') {
      engine.running = false;
      engine.over = true;
    }
    engineRef.current = engine;
    seqRef.current = roomState.checkpoint.seq;
    const self = engine.players.find((player) => player.guestId === guestId) ?? engine.players[0];
    finishedRef.current = roomState.phase === 'finished' || Boolean(self && !self.alive && engine.players.length === 1);
    setOver(finishedRef.current || engine.over);
    setLife(ownLife(engine, guestId));
    setDepth(engine.depth);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) renderWell(ctx, engine, performance.now() / 1000, artRef.current);
    }
  }, [roomState.checkpoint, roomState.phase, guestId]);

  // Shared host navigate-away / tab close: persist host_left so guests do not freeze.
  // Solo host refresh must NOT finish here (#10 recovery).
  useEffect(() => {
    if (!shouldPersistHostLeftOnUnload({
      isHost,
      shared,
      phase: roomState.phase,
      alreadyFinished: finishedRef.current || roomState.phase === 'finished',
    })) return;

    function persistHostLeftKeepalive() {
      if (finishedRef.current) return;
      const engine = engineRef.current;
      const checkpoint = engine
        ? checkpointFromWell(seqRef.current + 1, engine.toRestorableWell())
        : roomState.checkpoint;
      if (!checkpoint) return;
      finishedRef.current = true;
      const body = JSON.stringify({
        action: 'finish',
        checkpoint,
        reason: 'host_left',
        winnerGuestId: null,
        expectedVersion: versionRef.current,
      });
      try {
        void fetch(`/api/rooms/${code}/well`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body,
          keepalive: true,
        });
      } catch {
        // Best-effort on unload.
      }
    }

    const onPageHide = () => persistHostLeftKeepalive();
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [isHost, shared, roomState.phase, roomState.checkpoint, code, token]);

  // Host Solo or Shared simulator + sparse Postgres Checkpoints.
  useEffect(() => {
    if (!isHost || !roomState.checkpoint || roomState.phase === 'finished') return;
    let alive = true;
    let acc = 0;
    let last = performance.now();
    let lastCheckpointAt = performance.now();
    let lastBroadcastAt = 0;
    let persisting = false;
    const guestIntent = new Map<string, WellIntentDirection>();
    const missingSince = new Map<string, number>();
    let channel: ReturnType<NonNullable<ReturnType<typeof getBrowserSupabase>>['channel']> | null = null;

    function onKey(event: KeyboardEvent, down: boolean) {
      const engine = engineRef.current;
      if (!engine) return;
      if (!shared) engine.setKey(event.code, down);
      if (event.code === 'ArrowLeft' || event.code === 'KeyA' || event.code === 'KeyZ') {
        intentRef.current = down ? 'left' : (intentRef.current === 'left' ? 'none' : intentRef.current);
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD' || event.code === 'KeyX') {
        intentRef.current = down ? 'right' : (intentRef.current === 'right' ? 'none' : intentRef.current);
      }
    }
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    async function persist(action: 'checkpoint' | 'finish', reason?: WellFinishReason) {
      const engine = engineRef.current;
      if (!engine || persisting || !alive) return;
      persisting = true;
      try {
        seqRef.current += 1;
        const checkpoint = checkpointFromWell(seqRef.current, engine.toRestorableWell());
        const winnerGuestId = action === 'finish' ? winnerGuestIdFromEngine(engine) : undefined;
        const response = await fetch(`/api/rooms/${code}/well`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action,
            checkpoint,
            reason,
            winnerGuestId,
            expectedVersion: versionRef.current,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not save well Checkpoint.');
        versionRef.current = payload.room.version;
        onPersisted(payload);
        if (action === 'finish') {
          finishedRef.current = true;
          setOver(true);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Could not save well Checkpoint.');
      } finally {
        persisting = false;
      }
    }

    if (shared) {
      const supabase = getBrowserSupabase();
      if (supabase) {
        channel = supabase.channel(wellTopic(roomId), {
          config: { presence: { key: guestId } },
        });
        channel.on('broadcast', { event: WELL_BROADCAST_INTENT }, ({ payload }) => {
          if (!isWellIntent(payload) || payload.guestId === guestId) return;
          guestIntent.set(payload.guestId, payload.direction);
          if (payload.seq > ackRef.current) ackRef.current = payload.seq;
        });
        channel.on('presence', { event: 'sync' }, () => {
          if (!channel) return;
          const state = channel.presenceState() as Record<string, Array<{ guestId?: string }>>;
          const occupants = Object.values(state).flatMap((entries) =>
            entries.map((entry) => entry.guestId).filter((id): id is string => typeof id === 'string' && id.length > 0),
          );
          const engine = engineRef.current;
          if (!engine || finishedRef.current) return;
          const now = performance.now();
          for (const missing of kidsMissingFromOccupants(engine, occupants)) {
            if (missing === guestId) continue;
            const since = missingSince.get(missing);
            if (since === undefined) {
              missingSince.set(missing, now);
              continue;
            }
            if (now - since >= WELL_PRESENCE_GRACE_MS) {
              missingSince.delete(missing);
              engine.leaveKid(missing);
            }
          }
          for (const key of [...missingSince.keys()]) {
            if (occupants.includes(key)) missingSince.delete(key);
          }
        });
        void channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel?.track({ guestId });
        });
      }
    }

    function broadcastSnapshot(engine: Engine, now: number) {
      if (!channel || !shared) return;
      if (now - lastBroadcastAt < 1000 / WELL_BROADCAST_HZ) return;
      lastBroadcastAt = now;
      const snapshot = createWellSnapshot(
        seqRef.current,
        ackRef.current,
        engine.toRestorableWell(),
      );
      void channel.send({ type: 'broadcast', event: WELL_BROADCAST_SNAPSHOT, payload: snapshot });
    }

    function frame(now: number) {
      if (!alive) return;
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) {
        requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
      last = now;
      if (!finishedRef.current && engine.running) {
        acc += dt;
        engine.setIntent(guestId, intentRef.current);
        if (shared) {
          for (const [otherId, direction] of guestIntent) {
            engine.setIntent(otherId, direction);
          }
        } else {
          engine.setSoloIntent(intentRef.current);
        }
        while (acc >= STEP) {
          engine.step(STEP);
          acc -= STEP;
        }
        setLife(ownLife(engine, guestId));
        setDepth(engine.depth);
        broadcastSnapshot(engine, now);
        if (engine.over && !finishedRef.current) {
          const dead = engine.players.find((player) => !player.alive);
          const death = dead?.death === 'fall' ? 'fall' : 'hp';
          void persist('finish', death);
        } else if (now - lastCheckpointAt >= WELL_CHECKPOINT_INTERVAL_MS) {
          lastCheckpointAt = now;
          void persist('checkpoint');
        }
      }
      const ctx = canvas.getContext('2d');
      if (ctx) renderWell(ctx, engine, now / 1000, artRef.current);
      requestAnimationFrame(frame);
    }
    const raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (channel) {
        const supabase = getBrowserSupabase();
        if (supabase) void supabase.removeChannel(channel);
      }
    };
  }, [isHost, shared, roomState.phase, Boolean(roomState.checkpoint), code, token, roomId, guestId, onPersisted, onError]);

  // Guest Shared: Broadcast Intents + Snapshot apply + Presence + local prediction.
  useEffect(() => {
    if (isHost || !shared || !roomState.checkpoint || roomState.phase === 'finished') return;
    let alive = true;
    let last = performance.now();
    let lastIntentSent: WellIntentDirection | null = null;
    let lastIntentAt = 0;
    let channel: ReturnType<NonNullable<ReturnType<typeof getBrowserSupabase>>['channel']> | null = null;

    function onKey(event: KeyboardEvent, down: boolean) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA' || event.code === 'KeyZ') {
        intentRef.current = down ? 'left' : (intentRef.current === 'left' ? 'none' : intentRef.current);
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD' || event.code === 'KeyX') {
        intentRef.current = down ? 'right' : (intentRef.current === 'right' ? 'none' : intentRef.current);
      }
    }
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    const supabase = getBrowserSupabase();
    if (supabase) {
      channel = supabase.channel(wellTopic(roomId), {
        config: { presence: { key: guestId } },
      });
      let hostMissingSince: number | null = null;
      let declaringHostLeft = false;

      async function declareHostLeft() {
        if (declaringHostLeft || finishedRef.current || !alive) return;
        declaringHostLeft = true;
        finishedRef.current = true;
        setOver(true);
        try {
          const response = await fetch(`/api/rooms/${code}/well`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({
              action: 'finish',
              reason: 'host_left',
              winnerGuestId: null,
              expectedVersion: versionRef.current,
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? 'Could not end well after host left.');
          versionRef.current = payload.room.version;
          onPersisted(payload);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Could not end well after host left.');
          declaringHostLeft = false;
          finishedRef.current = false;
        }
      }

      channel.on('broadcast', { event: WELL_BROADCAST_SNAPSHOT }, ({ payload }) => {
        if (!isWellSnapshot(payload)) return;
        const engine = engineRef.current;
        if (!engine || finishedRef.current) return;
        const predicted = engine.players.find((player) => player.guestId === guestId)?.x;
        applyHostSnapshot(engine, payload, guestId, predicted);
        ackRef.current = payload.ack;
        setLife(ownLife(engine, guestId));
        setDepth(engine.depth);
        if (engine.over) {
          finishedRef.current = true;
          setOver(true);
        }
      });
      channel.on('presence', { event: 'sync' }, () => {
        if (!channel || finishedRef.current) return;
        const state = channel.presenceState() as Record<string, Array<{ guestId?: string }>>;
        const occupants = Object.values(state).flatMap((entries) =>
          entries.map((entry) => entry.guestId).filter((id): id is string => typeof id === 'string' && id.length > 0),
        );
        const now = performance.now();
        if (occupants.includes(hostGuestId)) {
          hostMissingSince = null;
          return;
        }
        if (hostMissingSince === null) {
          hostMissingSince = now;
          return;
        }
        if (now - hostMissingSince >= WELL_PRESENCE_GRACE_MS) {
          void declareHostLeft();
        }
      });
      void channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel?.track({ guestId });
      });
    }

    function sendIntent(direction: WellIntentDirection, now: number, force = false) {
      if (!channel) return;
      const due = force || direction !== lastIntentSent || now - lastIntentAt >= 1000 / WELL_BROADCAST_HZ;
      if (!due) return;
      lastIntentSent = direction;
      lastIntentAt = now;
      intentSeqRef.current += 1;
      const intent = createWellIntent(guestId, direction, intentSeqRef.current, now);
      void channel.send({ type: 'broadcast', event: WELL_BROADCAST_INTENT, payload: intent });
    }

    function frame(now: number) {
      if (!alive) return;
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) {
        requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
      last = now;
      if (!finishedRef.current) {
        sendIntent(intentRef.current, now);
        applyOwnPrediction(engine, guestId, intentRef.current, dt);
        setLife(ownLife(engine, guestId));
        setDepth(engine.depth);
      }
      const ctx = canvas.getContext('2d');
      if (ctx) renderWell(ctx, engine, now / 1000, artRef.current);
      requestAnimationFrame(frame);
    }
    const raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (channel) {
        const client = getBrowserSupabase();
        if (client) void client.removeChannel(channel);
      }
    };
  }, [isHost, shared, roomState.phase, Boolean(roomState.checkpoint), roomId, guestId, hostGuestId, code, token, onPersisted, onError]);

  // Solo non-host: still render Checkpoint-only view (no controls).
  useEffect(() => {
    if (isHost || shared || !roomState.checkpoint) return;
    let alive = true;
    function frame(now: number) {
      if (!alive) return;
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (engine && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) renderWell(ctx, engine, now / 1000, artRef.current);
      }
      requestAnimationFrame(frame);
    }
    const raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [isHost, shared, Boolean(roomState.checkpoint)]);

  async function quit() {
    const engine = engineRef.current;
    if (!engine || finishedRef.current) return;
    if (!isHost) return;
    engine.quit();
    seqRef.current += 1;
    const checkpoint = checkpointFromWell(seqRef.current, engine.toRestorableWell());
    try {
      const response = await fetch(`/api/rooms/${code}/well`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'finish',
          checkpoint,
          reason: 'quit',
          winnerGuestId: winnerGuestIdFromEngine(engine),
          expectedVersion: versionRef.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not quit well.');
      versionRef.current = payload.room.version;
      finishedRef.current = true;
      setOver(true);
      onPersisted(payload);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not quit well.');
    }
  }

  function hold(direction: WellIntentDirection) {
    intentRef.current = direction;
    if (isHost) engineRef.current?.setIntent(guestId, direction);
  }

  const zh = language === 'zh-Hant';
  const reason = roomState.result?.reason;
  const winnerId = roomState.result?.winnerGuestId;
  const resultLabel = reason === 'host_left'
    ? (zh ? '房主已離開' : 'Host left')
    : reason === 'quit'
      ? (zh ? '已退出' : 'Quit')
      : winnerId
        ? (zh ? '勝出' : 'Winner')
        : reason === 'fall'
          ? (zh ? '跌出井外' : 'Fell out')
          : reason === 'hp'
            ? (zh ? '生命歸零' : 'Out of life')
            : (zh ? '井已結束' : 'Well finished');

  const showControls = !over && !out && (isHost || shared);

  if (out) {
    return (
      <div className="well-play">
        <div className="well-hud">
          <span className="well-over">{zh ? '你已出局（沒有 Checkpoint 可恢復）' : 'You are out (no Checkpoint to restore)'}</span>
        </div>
        <p className="room-help">{zh ? '重新整理時若伺服器沒有 Checkpoint，非房主會出局。' : 'On refresh, a non-host is out when the server has no Checkpoint.'}</p>
      </div>
    );
  }

  return (
    <div className="well-play">
      <div className="well-hud">
        <span>{zh ? '生命' : 'Life'} {life}</span>
        <span>{zh ? '樓層' : 'Floors'} {depth}</span>
        {shared && <span>{zh ? '共用井' : 'Shared'}</span>}
        {over && <span className="well-over">{resultLabel}</span>}
      </div>
      {over && canReplay && onReplay && (
        <div className="well-controls">
          <button
            className="button button-primary"
            type="button"
            disabled={replayBusy}
            onClick={() => onReplay()}
          >
            {zh ? '重玩一次' : 'Replay'} <span>→</span>
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="well-canvas"
        width={STAGE_W}
        height={STAGE_H}
        aria-label={zh ? '小朋友落樓梯井' : 'Downstairs well'}
      />
      {showControls && (
        <div className="well-controls">
          <button type="button" className="button button-quiet" onPointerDown={() => hold('left')} onPointerUp={() => hold('none')} onPointerLeave={() => hold('none')}>←</button>
          <button type="button" className="button button-quiet" onPointerDown={() => hold('right')} onPointerUp={() => hold('none')} onPointerLeave={() => hold('none')}>→</button>
          {isHost && (
            <button type="button" className="button button-dark" onClick={() => void quit()}>{zh ? '退出' : 'Quit'}</button>
          )}
        </div>
      )}
      {!isHost && !shared && <p className="room-help">{zh ? '只有房主模擬器可以操作這口井。' : 'Only the host simulator can control this well.'}</p>}
      {!isHost && shared && !over && (
        <p className="room-help">{zh ? '你的小朋友即時移動；井況由房主模擬器裁判。斷線即離開井。' : 'Your kid moves immediately; the host simulator is the referee. Disconnect leaves the well.'}</p>
      )}
    </div>
  );
}
