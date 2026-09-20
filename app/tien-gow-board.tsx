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
import type { Language } from './language';
import './lab/tien-gow/lab.css';

type BoardMember = { guest_id: string; display_name: string; seat: number; is_cpu?: boolean };

export function TienGowBoard({
  view,
  members,
  onMove,
  disabled,
  language,
}: {
  view: View;
  members: BoardMember[];
  onMove: (move: Move) => void;
  disabled: boolean;
  language: Language;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const zh = language === 'zh-Hant';

  useEffect(() => {
    setSelected([]);
  }, [view.hand.join(','), view.toAct, view.phase]);
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

  return (
    <div className="tgw-play">
      <section className="tgw-board tgw-play-board" aria-label={zh ? '牌桌' : 'Table felt'} data-viewer-seat={view.seat}>
        {layout.map(({ seat, place, region }) => {
          const member = members.find((candidate) => candidate.seat === seat);
          const self = seat === view.seat;
          return (
            <div className={`tgw-seat ${place}${view.phase !== 'recap' && view.toAct === seat ? ' to-act' : ''}`} data-seat={seat} data-region={region} key={seat}>
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
            <strong className="tgw-status">{status}</strong>
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
