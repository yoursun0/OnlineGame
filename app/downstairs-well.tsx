'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Engine,
  MAX_FRAME_DT,
  STAGE_H,
  STAGE_W,
  STEP,
  WELL_CHECKPOINT_INTERVAL_MS,
  asRestorableWell,
  checkpointFromWell,
  renderWell,
  type DownstairsRoomState,
  type WellFinishReason,
} from '@playroom/downstairs';

type Props = {
  roomState: DownstairsRoomState;
  roomVersion: number;
  token: string;
  code: string;
  isHost: boolean;
  language: 'en' | 'zh-Hant';
  onPersisted: (snapshot: unknown) => void;
  onError: (message: string) => void;
};

export function DownstairsWell({
  roomState,
  roomVersion,
  token,
  code,
  isHost,
  language,
  onPersisted,
  onError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const versionRef = useRef(roomVersion);
  const seqRef = useRef(roomState.checkpoint?.seq ?? 0);
  const intentRef = useRef<'left' | 'right' | 'none'>('none');
  const finishedRef = useRef(roomState.phase === 'finished');
  const [life, setLife] = useState(12);
  const [depth, setDepth] = useState(0);
  const [over, setOver] = useState(roomState.phase === 'finished');

  useEffect(() => { versionRef.current = roomVersion; }, [roomVersion]);

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
    finishedRef.current = roomState.phase === 'finished' || Boolean(roomState.checkpoint.well.kids[0] && !roomState.checkpoint.well.kids[0].alive);
    setOver(finishedRef.current || engine.over);
    setLife(Math.max(0, Math.ceil(engine.players[0]?.life ?? 0)));
    setDepth(engine.depth);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) renderWell(ctx, engine, performance.now() / 1000);
    }
  }, [roomState.checkpoint, roomState.phase]);

  useEffect(() => {
    if (!isHost || !roomState.checkpoint || roomState.phase === 'finished') return;
    let alive = true;
    let acc = 0;
    let last = performance.now();
    let lastCheckpointAt = performance.now();
    let persisting = false;

    function onKey(event: KeyboardEvent, down: boolean) {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setKey(event.code, down);
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
        const response = await fetch(`/api/rooms/${code}/well`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action,
            checkpoint,
            reason,
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
        engine.setSoloIntent(intentRef.current);
        while (acc >= STEP) {
          engine.step(STEP);
          acc -= STEP;
        }
        setLife(Math.max(0, Math.ceil(engine.players[0]?.life ?? 0)));
        setDepth(engine.depth);
        if (engine.over && !finishedRef.current) {
          const death = engine.players[0]?.death === 'fall' ? 'fall' : 'hp';
          void persist('finish', death);
        } else if (now - lastCheckpointAt >= WELL_CHECKPOINT_INTERVAL_MS) {
          lastCheckpointAt = now;
          void persist('checkpoint');
        }
      }
      const ctx = canvas.getContext('2d');
      if (ctx) renderWell(ctx, engine, now / 1000);
      requestAnimationFrame(frame);
    }
    const raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [isHost, roomState.phase, Boolean(roomState.checkpoint), code, token, onPersisted, onError]);

  async function quit() {
    const engine = engineRef.current;
    if (!engine || finishedRef.current) return;
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

  function hold(direction: 'left' | 'right' | 'none') {
    intentRef.current = direction;
    engineRef.current?.setSoloIntent(direction);
  }

  const zh = language === 'zh-Hant';
  const reason = roomState.result?.reason;
  const resultLabel = reason === 'quit'
    ? (zh ? '已退出' : 'Quit')
    : reason === 'fall'
      ? (zh ? '跌出井外' : 'Fell out')
      : reason === 'hp'
        ? (zh ? '生命歸零' : 'Out of life')
        : (zh ? '井已結束' : 'Well finished');

  return (
    <div className="well-play">
      <div className="well-hud">
        <span>{zh ? '生命' : 'Life'} {life}</span>
        <span>{zh ? '樓層' : 'Floors'} {depth}</span>
        {over && <span className="well-over">{resultLabel}</span>}
      </div>
      <canvas
        ref={canvasRef}
        className="well-canvas"
        width={STAGE_W}
        height={STAGE_H}
        aria-label={zh ? '小朋友落樓梯井' : 'Downstairs well'}
      />
      {isHost && !over && (
        <div className="well-controls">
          <button type="button" className="button button-quiet" onPointerDown={() => hold('left')} onPointerUp={() => hold('none')} onPointerLeave={() => hold('none')}>←</button>
          <button type="button" className="button button-quiet" onPointerDown={() => hold('right')} onPointerUp={() => hold('none')} onPointerLeave={() => hold('none')}>→</button>
          <button type="button" className="button button-dark" onClick={() => void quit()}>{zh ? '退出' : 'Quit'}</button>
        </div>
      )}
      {!isHost && <p className="room-help">{zh ? '只有房主模擬器可以操作這口井。' : 'Only the host simulator can control this well.'}</p>}
    </div>
  );
}
