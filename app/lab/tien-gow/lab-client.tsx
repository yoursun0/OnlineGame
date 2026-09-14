'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyMove,
  createHand,
  identifyCombo,
  listLegalMoves,
  nextCpuMove,
  projectView,
  sameMove,
  sortHandDisplay,
  type Move,
  type State,
  type Table,
  type View,
  DEFAULT_TABLE,
  getTile,
} from '@playroom/tien-gow';
import { BoneTile } from './tile';

const CPU_PLAY_MS = 3000;
const CPU_SKIP_MS = 400;

const SEAT_WIND = ['東位', '南位', '西位', '北位'] as const;

const OPTION_LABELS: Array<[keyof Table, string, string]> = [
  ['wenHonor', '文尊', '孖伶冧作文尊。領出後除非開了擒文尊，否則無人可打。'],
  ['captureWenHonor', '擒文尊', '孖高腳可打領出的文尊，並照賀尊收錢。需先開文尊。'],
  ['yaoSettle', '么結', '單張么三結牌為么結 ×2。開了文尊時，單張伶冧六也可么結。'],
  ['yaoCapture', '么雙擒四', '大頭六結領出的么三、或高腳七結領出的伶冧六：被擒者代付低於門檻的輸分，再 ×4。需先開么結。'],
  ['baoHonor', '包尊', '最後一墩至尊（武尊，或無人打的文尊）為包尊，結分 ×2。該墩不收賀錢。'],
  ['fourBless', '賀四 / 四大包', '非最後的四文武收賀四（基數 4）。最後一墩四文武為四大包 ×4。'],
  ['slam', '七支 / 八支', '結時拿齊 8 棟。視最後一墩為七支 ×2 或八支 ×4。'],
  ['examples', '例牌', '開牌後先看例牌：一點紅、七武、全白、八武。符合者可即時結，不打牌。'],
  ['baoHonorAlsoHe', '包尊亦賀', '包尊／四大包仍先收賀錢，再算結分倍數。'],
  ['extraExamples', '額外例牌', '加四對子、七星文士、八方文士三款例牌。'],
];

const SEAT_PLACE: Array<{ seat: number; place: 'south' | 'east' | 'north' | 'west'; name: string }> = [
  { seat: 0, place: 'south', name: SEAT_WIND[0] },
  { seat: 1, place: 'east', name: SEAT_WIND[1] },
  { seat: 2, place: 'north', name: SEAT_WIND[2] },
  { seat: 3, place: 'west', name: SEAT_WIND[3] },
];

function nextSeed(seed: string): string {
  return `${seed}:${Date.now().toString(36)}`;
}

function formatPublic(text: string): string {
  return text
    .replace(/\bseat (\d)\b/g, (_, digit: string) => SEAT_WIND[Number(digit)] ?? `seat ${digit}`)
    .replace(/\b([0-3])→([0-3])\b/g, (_, from: string, to: string) => `${SEAT_WIND[Number(from)]}→${SEAT_WIND[Number(to)]}`);
}

function cpuDelay(state: State): number {
  if (state.phase === 'example' && state.toAct !== 0) {
    const move = nextCpuMove(state, state.toAct);
    if (move?.type === 'skipExample') return CPU_SKIP_MS;
  }
  return CPU_PLAY_MS;
}

function trickAfterFourth(from: State, move: Move, seat: number): View['trick'] | null {
  const trick = projectView(from, 0).trick;
  if (!trick || trick.plays.length !== 3) return null;
  if (move.type === 'dump') {
    return { ...trick, plays: [...trick.plays, { seat, type: 'dump', count: move.tiles.length }] };
  }
  if (move.type !== 'beat') return null;
  const combo = identifyCombo(move.tiles, from.table);
  if (!combo) return null;
  return { ...trick, combo, plays: [...trick.plays, { seat, type: 'beat', tiles: [...move.tiles], combo }] };
}

export function LabClient({ god }: { god: boolean }) {
  const [table, setTable] = useState<Table>({ ...DEFAULT_TABLE });
  const [seed, setSeed] = useState('lab');
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bankerStreak, setBankerStreak] = useState(1);
  const [heldTrick, setHeldTrick] = useState<View['trick']>(null);
  const skipCpuDelay = useRef(false);

  function commitMove(from: State, move: Move, seat: number) {
    const held = trickAfterFourth(from, move, seat);
    if (held) {
      setHeldTrick(held);
      skipCpuDelay.current = true;
    }
    setState(applyMove(from, move, seat));
    setSelected([]);
  }

  useEffect(() => {
    if (heldTrick) {
      const hold = window.setTimeout(() => setHeldTrick(null), CPU_PLAY_MS);
      return () => window.clearTimeout(hold);
    }
    if (!state || state.phase === 'recap' || state.toAct === 0) {
      skipCpuDelay.current = false;
      return;
    }
    let cancelled = false;
    const delay = skipCpuDelay.current ? 0 : cpuDelay(state);
    skipCpuDelay.current = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const move = nextCpuMove(state, state.toAct);
      if (!move) return;
      commitMove(state, move, state.toAct);
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, heldTrick]);

  const view = state ? projectView(state, 0) : null;
  const shownTrick = heldTrick ?? view?.trick ?? null;
  const selectedCombo = identifyCombo(selected, table);
  const humanTurn = Boolean(state && state.toAct === 0 && state.phase !== 'recap' && !heldTrick);

  function deal(nextTable = table, nextBanker = 0, chips = [100, 100, 100, 100], streak = 1, nextSeedValue = seed) {
    const dealt = createHand({ seed: nextSeedValue, table: nextTable, bankerSeat: nextBanker, chips, bankerStreak: streak });
    setHeldTrick(null);
    skipCpuDelay.current = false;
    setState(dealt);
    setSelected([]);
    setBankerStreak(streak);
    setSeed(nextSeedValue);
  }

  function play(move: Move) {
    if (!state || !humanTurn) return;
    commitMove(state, move, 0);
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function continueHand() {
    if (!state?.jieSeat && state?.jieSeat !== 0) return;
    const streak = state.jieSeat === state.bankerSeat ? bankerStreak + 1 : 1;
    deal(table, state.jieSeat, state.chips, streak, nextSeed(seed));
  }

  const legal = state ? listLegalMoves(state, 0) : [];
  const canLead = Boolean(humanTurn && state && state.phase === 'lead' && selectedCombo && legal.some((move) => move.type === 'lead' && sameMove(move, { type: 'lead', tiles: selected })));
  const canBeat = Boolean(humanTurn && state && state.phase === 'follow' && selectedCombo && legal.some((move) => move.type === 'beat' && sameMove(move, { type: 'beat', tiles: selected })));
  const canDump = Boolean(humanTurn && state && state.phase === 'follow' && legal.some((move) => move.type === 'dump' && sameMove(move, { type: 'dump', tiles: selected })));

  const status = useMemo(() => {
    if (!state) return '調好臺面，開一副牌。';
    if (heldTrick) return '看這一墩';
    if (state.phase === 'recap') return `${SEAT_WIND[state.jieSeat ?? 0]} 結`;
    if (state.phase === 'example') return '例牌窗口';
    if (state.toAct === 0) return state.phase === 'lead' ? '你出' : '你打或墊';
    return `${SEAT_WIND[state.toAct]} 出牌中`;
  }, [state, heldTrick]);

  return (
    <div className="tgw-lab">
      <div className="tgw-shell">
        <header className="tgw-top">
          <div>
            <p className="tgw-kicker">PLAYROOM lab · TGW · not in catalogue</p>
            <h1>打<em>天九</em></h1>
          </div>
          <a href="/">回大廳</a>
        </header>

        <section className="tgw-table-card" aria-label="Table">
          <p className="tgw-kicker">Table</p>
          <div className="tgw-options">
            {OPTION_LABELS.map(([key, label, hint]) => (
              <div className="tgw-option" key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={table[key]}
                    disabled={Boolean(state && state.phase !== 'recap') || (key === 'captureWenHonor' && !table.wenHonor)}
                    onChange={(event) => {
                      const next = { ...table, [key]: event.target.checked };
                      if (key === 'wenHonor' && !event.target.checked) next.captureWenHonor = false;
                      if (key === 'yaoSettle' && !event.target.checked) next.yaoCapture = false;
                      setTable(next);
                    }}
                  />
                  {label}
                </label>
                <span className="tgw-tip">
                  <button type="button" className="tgw-info" aria-label={`${label}說明`} aria-describedby={`tgw-tip-${key}`}>i</button>
                  <span className="tgw-tip-panel" role="tooltip" id={`tgw-tip-${key}`}>{hint}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="tgw-actions">
            <button className="tgw-btn" type="button" onClick={() => deal(table, 0, [100, 100, 100, 100], 1, nextSeed('lab'))}>開牌</button>
            <button className="tgw-btn ghost" type="button" disabled={!state} onClick={() => deal(table, 0, [100, 100, 100, 100], 1, nextSeed(seed))}>再來</button>
            <button className="tgw-btn ghost" type="button" disabled={state?.phase !== 'recap' || Boolean(heldTrick)} onClick={continueHand}>下一局 · 飛莊</button>
          </div>
        </section>

        <section className="tgw-board" aria-label="Table felt">
          <div className="tgw-felt" />
          {SEAT_PLACE.map(({ seat, place, name }) => {
            const raw = god && state ? state.hands[seat] : seat === 0 ? state?.hands[0] ?? [] : [];
            const hand = sortHandDisplay(raw);
            const hiddenCount = state && seat !== 0 && !god ? state.hands[seat].length : 0;
            return (
              <div className={`tgw-seat ${place} ${!heldTrick && state?.toAct === seat ? 'to-act' : ''}`} data-seat={seat} key={seat}>
                <div className="tgw-seat-meta">
                  <strong>{name}</strong>
                  {seat === 0 ? <span>你</span> : null}
                  <span>{state ? `${state.dong[seat]} 棟 · ${state.chips[seat]}` : '—'}</span>
                  {state?.bankerSeat === seat ? <span>莊</span> : null}
                </div>
                <div className="tgw-seat-grid">
                  {seat === 0 || god
                    ? hand.map((id) => (
                      <BoneTile
                        key={id}
                        tile={getTile(id)}
                        selected={seat === 0 && selected.includes(id)}
                        onClick={seat === 0 && humanTurn ? () => toggle(id) : undefined}
                      />
                    ))
                    : Array.from({ length: hiddenCount }, (_, index) => <BoneTile key={`${seat}-back-${index}`} faceDown />)}
                </div>
              </div>
            );
          })}
          <div className="tgw-center">
            <div className="tgw-trick-board" data-trick-hold={heldTrick ? '1' : '0'}>
              <strong className="tgw-status">{status}</strong>
              {SEAT_PLACE.map(({ seat, place }) => {
                const play = shownTrick?.plays.find((item) => item.seat === seat);
                return (
                  <div className={`tgw-trick-slot ${place}`} data-trick-seat={seat} key={`trick-${seat}`}>
                    {play
                      ? play.type === 'dump'
                        ? Array.from({ length: play.count }, (_, dumpIndex) => (
                          <BoneTile key={`d-${seat}-${dumpIndex}`} faceDown />
                        ))
                        : play.tiles.map((id) => <BoneTile key={id} tile={getTile(id)} />)
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {state?.toasts[0] ? <div className="tgw-toast" role="status">{formatPublic(`${state.toasts[0].title} · ${state.toasts[0].detail}`)}</div> : null}

        <div className="tgw-hand">
          <p className="tgw-kicker">你的手牌 · {selectedCombo ? selectedCombo.label : '點牌組成一套'}</p>
          <div className="tgw-picker">
            {state?.phase === 'example' && legal.some((move) => move.type === 'claimExample') ? (
              <button className="tgw-btn" type="button" onClick={() => play({ type: 'claimExample' })}>例牌開</button>
            ) : null}
            {state?.phase === 'example' ? (
              <button className="tgw-btn ghost" type="button" onClick={() => play({ type: 'skipExample' })}>跳過例牌</button>
            ) : null}
            {canLead ? <button className="tgw-btn" type="button" onClick={() => play({ type: 'lead', tiles: selected })}>出 {selectedCombo?.label}</button> : null}
            {canBeat ? <button className="tgw-btn" type="button" onClick={() => play({ type: 'beat', tiles: selected })}>打 {selectedCombo?.label}</button> : null}
            {canDump ? <button className="tgw-btn ghost" type="button" onClick={() => play({ type: 'dump', tiles: selected })}>墊 {selected.length}</button> : null}
          </div>
        </div>

        <div className="tgw-columns">
          <div className="tgw-log" aria-label="Public log">
            <p className="tgw-kicker">公開紀錄</p>
            {(view?.log ?? []).slice(-16).map((line, index) => <p key={`${line}-${index}`}>{formatPublic(line)}</p>)}
          </div>
          {state?.recap && !heldTrick ? (
            <div className="tgw-recap">
              <p className="tgw-kicker">結</p>
              <table>
                <thead><tr><th>座位</th><th>棟</th><th>籌碼</th></tr></thead>
                <tbody>
                  {state.recap.dong.map((dong, seat) => (
                    <tr key={seat}>
                      <td>{SEAT_WIND[seat]}{state.recap?.jieSeat === seat ? ' 結' : ''}{state.bankerSeat === seat ? ' 莊' : ''}{seat === 0 ? ' 你' : ''}</td>
                      <td>{dong}</td>
                      <td>{state.recap?.chipsAfter[seat]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>{[state.recap.flags.example, state.recap.flags.slam, state.recap.flags.baoHonor && '包尊', state.recap.flags.fourBao && '四大包'].filter(Boolean).join(' · ')} {state.recap.payments.map((payment) => `${SEAT_WIND[payment.from]}→${SEAT_WIND[payment.to]} ${payment.amount}`).join(' · ')}</p>
            </div>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
