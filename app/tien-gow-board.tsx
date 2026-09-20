'use client';

import { useEffect, useState } from 'react';
import {
  getTile,
  identifyCombo,
  sameMove,
  sortHandDisplay,
  type Move,
  type View,
} from '@playroom/tien-gow';
import { BoneTile } from './lab/tien-gow/tile';
import { tienGowSeatWind, tienGowViewportLayout } from './tien-gow-seats';
import { TienGowTableSummary } from './tien-gow-table-options';
import { tienGowTurnActor, tienGowTurnClockKey, tienGowTurnClockView } from './tien-gow-turn-clock';
import type { Language } from './language';
import './lab/tien-gow/lab.css';

type BoardMember = { guest_id: string; display_name: string; seat: number; is_cpu?: boolean };

export function TienGowBoard({
  view,
  members,
  onMove,
  disabled,
  language,
  isHost = false,
  clockNow,
  clockStartedAt,
  onNext,
  onRematch,
  canDeal = false,
  dealBusy = false,
}: {
  view: View;
  members: BoardMember[];
  onMove: (move: Move) => void;
  disabled: boolean;
  language: Language;
  isHost?: boolean;
  clockNow?: number;
  clockStartedAt?: number;
  onNext?: () => void;
  onRematch?: () => void;
  canDeal?: boolean;
  dealBusy?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const zh = language === 'zh-Hant';
  const playCount = view.trick?.plays.length ?? 0;
  const turnKey = tienGowTurnClockKey({ phase: view.phase, toAct: view.toAct, playCount });
  const actor = tienGowTurnActor(view.phase, view.toAct, members);
  const [liveStartedAt, setLiveStartedAt] = useState(() => clockStartedAt ?? Date.now());
  const [liveNow, setLiveNow] = useState(() => clockNow ?? Date.now());

  useEffect(() => {
    setSelected([]);
  }, [view.hand.join(','), view.toAct, view.phase]);

  useEffect(() => {
    if (clockStartedAt !== undefined) {
      setLiveStartedAt(clockStartedAt);
      return;
    }
    setLiveStartedAt(Date.now());
  }, [turnKey, clockStartedAt]);

  useEffect(() => {
    if (clockNow !== undefined) {
      setLiveNow(clockNow);
      return;
    }
    setLiveNow(Date.now());
    if (actor.kind !== 'human') return;
    const tick = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [turnKey, clockNow, actor.kind]);

  const clock = tienGowTurnClockView({
    phase: view.phase,
    toAct: view.toAct,
    playCount,
    members,
    now: clockNow ?? liveNow,
    startedAt: clockStartedAt ?? liveStartedAt,
    language,
    viewerSeat: view.seat,
    isHost,
    wind: tienGowSeatWind(view.toAct, language),
  });
  const ownTurn = !disabled && view.phase !== 'recap' && view.toAct === view.seat;
  const legal = ownTurn ? view.legal : [];
  const selectedCombo = identifyCombo(selected, view.table);
  const canLead = Boolean(ownTurn && view.phase === 'lead' && selectedCombo && legal.some((move) => move.type === 'lead' && sameMove(move, { type: 'lead', tiles: selected })));
  const canBeat = Boolean(ownTurn && view.phase === 'follow' && selectedCombo && legal.some((move) => move.type === 'beat' && sameMove(move, { type: 'beat', tiles: selected })));
  const canDump = Boolean(ownTurn && view.phase === 'follow' && legal.some((move) => move.type === 'dump' && sameMove(move, { type: 'dump', tiles: selected })));
  const hand = sortHandDisplay(view.hand);
  const layout = tienGowViewportLayout(view.seat);

  function play(move: Move) {
    if (!ownTurn) return;
    onMove(move);
    setSelected([]);
  }

  function toggle(id: string) {
    if (!ownTurn) return;
    setSelected((current) => (current.includes(id) ? current.filter((tile) => tile !== id) : [...current, id]));
  }

  const status = view.phase === 'recap'
    ? (zh ? `${tienGowSeatWind(view.jieSeat ?? 0, language)} 結` : `${tienGowSeatWind(view.jieSeat ?? 0, language)} 結`)
    : view.phase === 'example'
      ? (zh ? '例牌窗口' : 'Example window')
      : ownTurn
        ? (view.phase === 'lead' ? (zh ? '你出' : 'Your lead') : (zh ? '你打或墊' : 'Beat or dump'))
        : (zh ? `${tienGowSeatWind(view.toAct, language)} 出牌中` : `${tienGowSeatWind(view.toAct, language)} to act`);
  const statusWithClock = clock.remainingLabel ? `${status} · ${clock.remainingLabel}` : status;
  const warn = clock.phase === 'warn';
  const recap = view.phase === 'recap' ? view.recap : null;
  const recapFlags = recap
    ? [
      recap.flags.example,
      recap.flags.slam === 'seven' ? '七支' : recap.flags.slam === 'eight' ? '八支' : recap.flags.slam,
      recap.flags.baoHonor ? '包尊' : null,
      recap.flags.fourBao ? '四大包' : null,
      recap.flags.yaoJie ? '么結' : null,
      recap.flags.yaoCapture ? '么雙擒四' : null,
    ].filter(Boolean)
    : [];

  return (
    <div className="tgw-play" data-clock={clock.phase}>
      <section className="tgw-board tgw-play-board" aria-label={zh ? '牌桌' : 'Table felt'} data-viewer-seat={view.seat}>
        {layout.map(({ seat, place, region }) => {
          const member = members.find((candidate) => candidate.seat === seat);
          const self = seat === view.seat;
          const toAct = view.phase !== 'recap' && view.toAct === seat;
          return (
            <div className={`tgw-seat ${place}${toAct ? ' to-act' : ''}${toAct && warn ? ' clock-warn' : ''}`} data-seat={seat} data-region={region} key={seat}>
              <div className="tgw-seat-meta">
                <strong>{tienGowSeatWind(seat, language)}</strong>
                {self ? <span>{zh ? '你' : 'You'}</span> : null}
                <span>{member?.is_cpu ? (zh ? '電腦' : 'CPU') : member?.display_name}</span>
                <span>{view.dong[seat]} {zh ? '棟' : 'dong'} · {view.chips[seat]}</span>
                {view.bankerSeat === seat ? <span>{zh ? '莊' : 'Banker'}</span> : null}
              </div>
            </div>
          );
        })}
        <div className="tgw-center">
          <div className="tgw-trick-board">
            <strong className={`tgw-status${warn ? ' clock-warn' : ''}`}>{statusWithClock}</strong>
            {layout.map(({ seat, place, region }) => {
              const playOnTable = view.trick?.plays.find((item) => item.seat === seat);
              return (
                <div className={`tgw-trick-slot ${place}`} data-trick-seat={seat} data-region={region} key={`trick-${seat}`}>
                  {playOnTable
                    ? playOnTable.type === 'dump'
                      ? Array.from({ length: playOnTable.count }, (_, index) => (
                        <BoneTile key={`d-${seat}-${index}`} faceDown />
                      ))
                      : playOnTable.tiles.map((id) => <BoneTile key={id} tile={getTile(id)} />)
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {view.toasts[0] ? <div className="tgw-toast" role="status">{view.toasts[0].title} · {view.toasts[0].detail}</div> : null}
      {clock.toast ? <div className="tgw-clock-toast" role="status" aria-live="polite">{clock.toast}</div> : null}
      {clock.nudge ? <p className="tgw-clock-nudge" role="status">{clock.nudge}</p> : null}
      <TienGowTableSummary table={view.table} language={language} />

      {recap ? (
        <div className="tgw-recap" aria-label={zh ? '結' : 'Hand recap'}>
          <p className="tgw-kicker">{zh ? '結' : 'Settle'}</p>
          <table>
            <thead>
              <tr>
                <th>{zh ? '座位' : 'Seat'}</th>
                <th>{zh ? '棟' : 'Dong'}</th>
                <th>{zh ? '籌碼' : 'Chips'}</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((seat) => (
                <tr key={seat}>
                  <td>
                    {tienGowSeatWind(seat, language)}
                    {recap.jieSeat === seat ? ' 結' : ''}
                    {view.bankerSeat === seat ? (zh ? ' 莊' : ' Banker') : ''}
                    {seat === view.seat ? (zh ? ' 你' : ' You') : ''}
                  </td>
                  <td>{recap.dong[seat]}</td>
                  <td>{view.chips[seat]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {recapFlags.join(' · ')}
            {recapFlags.length > 0 && recap.payments.length > 0 ? ' ' : ''}
            {recap.payments.map((payment) => `${tienGowSeatWind(payment.from, language)}→${tienGowSeatWind(payment.to, language)} ${payment.amount}`).join(' · ')}
          </p>
          <div className="tgw-actions">
            <button className="tgw-btn" type="button" disabled={!canDeal || dealBusy} onClick={onNext}>{zh ? '下一局' : 'Next hand'}</button>
            <button className="tgw-btn ghost" type="button" disabled={!canDeal || dealBusy} onClick={onRematch}>{zh ? '重開牌局' : 'Rematch'}</button>
          </div>
        </div>
      ) : null}

      <div className="tgw-hand tgw-play-hand" data-viewer-seat={view.seat}>
        <p className="tgw-kicker">{zh ? '你的手牌' : 'Your hand'} · {selectedCombo ? selectedCombo.label : (zh ? '點牌組成一套' : 'Select a combination')}</p>
        <div className="tgw-seat-grid tgw-play-grid">
          {hand.map((id) => (
            <BoneTile
              key={id}
              tile={getTile(id)}
              selected={ownTurn && selected.includes(id)}
              onClick={ownTurn ? () => toggle(id) : undefined}
            />
          ))}
        </div>
        <div className="tgw-picker">
          {view.phase === 'example' && legal.some((move) => move.type === 'claimExample') ? (
            <button className="tgw-btn" type="button" onClick={() => play({ type: 'claimExample' })}>{zh ? '例牌開' : 'Claim example'}</button>
          ) : null}
          {view.phase === 'example' && ownTurn ? (
            <button className="tgw-btn ghost" type="button" onClick={() => play({ type: 'skipExample' })}>{zh ? '跳過例牌' : 'Skip example'}</button>
          ) : null}
          {canLead ? <button className="tgw-btn" type="button" onClick={() => play({ type: 'lead', tiles: selected })}>{zh ? '出' : 'Lead'} {selectedCombo?.label}</button> : null}
          {canBeat ? <button className="tgw-btn" type="button" onClick={() => play({ type: 'beat', tiles: selected })}>{zh ? '打' : 'Beat'} {selectedCombo?.label}</button> : null}
          {canDump ? <button className="tgw-btn ghost" type="button" onClick={() => play({ type: 'dump', tiles: selected })}>{zh ? '墊' : 'Dump'} {selected.length}</button> : null}
        </div>
      </div>
    </div>
  );
}
