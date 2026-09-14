'use client';

import { useMemo, useState } from 'react';
import {
  applyMove,
  createHand,
  identifyCombo,
  listLegalMoves,
  nextCpuMove,
  projectView,
  sameMove,
  type Move,
  type State,
  type Table,
  DEFAULT_TABLE,
  getTile,
} from '@playroom/tien-gow';
import { BoneTile } from './tile';

const OPTION_LABELS: Array<[keyof Table, string]> = [
  ['wenHonor', '文尊'],
  ['captureWenHonor', '擒文尊'],
  ['yaoSettle', '么結'],
  ['yaoCapture', '么雙擒四'],
  ['baoHonor', '包尊'],
  ['fourBless', '賀四 / 四大包'],
  ['slam', '七支 / 八支'],
  ['examples', '例牌'],
  ['baoHonorAlsoHe', '包尊亦賀'],
  ['extraExamples', '額外例牌'],
];

const SEAT_PLACE: Array<{ seat: number; place: 'south' | 'east' | 'north' | 'west'; name: string }> = [
  { seat: 0, place: 'south', name: '你' },
  { seat: 1, place: 'east', name: '下家 CPU' },
  { seat: 2, place: 'north', name: '對家 CPU' },
  { seat: 3, place: 'west', name: '上家 CPU' },
];

function runCpu(state: State): State {
  let next = state;
  let guard = 0;
  while (next.phase !== 'recap' && next.toAct !== 0 && guard < 240) {
    const move = nextCpuMove(next, next.toAct);
    if (!move) break;
    next = applyMove(next, move, next.toAct);
    guard += 1;
  }
  return next;
}

function nextSeed(seed: string): string {
  return `${seed}:${Date.now().toString(36)}`;
}

export function LabClient({ god }: { god: boolean }) {
  const [table, setTable] = useState<Table>({ ...DEFAULT_TABLE });
  const [seed, setSeed] = useState('lab');
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bankerStreak, setBankerStreak] = useState(1);

  const view = state ? projectView(state, 0) : null;
  const selectedCombo = identifyCombo(selected, table);

  function deal(nextTable = table, nextBanker = 0, chips = [100, 100, 100, 100], streak = 1, nextSeedValue = seed) {
    const dealt = runCpu(createHand({ seed: nextSeedValue, table: nextTable, bankerSeat: nextBanker, chips, bankerStreak: streak }));
    setState(dealt);
    setSelected([]);
    setBankerStreak(streak);
    setSeed(nextSeedValue);
  }

  function play(move: Move) {
    if (!state) return;
    const next = runCpu(applyMove(state, move, 0));
    setState(next);
    setSelected([]);
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
  const canLead = Boolean(state && state.phase === 'lead' && selectedCombo && legal.some((move) => move.type === 'lead' && sameMove(move, { type: 'lead', tiles: selected })));
  const canBeat = Boolean(state && state.phase === 'follow' && selectedCombo && legal.some((move) => move.type === 'beat' && sameMove(move, { type: 'beat', tiles: selected })));
  const canDump = Boolean(state && state.phase === 'follow' && legal.some((move) => move.type === 'dump' && sameMove(move, { type: 'dump', tiles: selected })));

  const status = useMemo(() => {
    if (!state) return '調好臺面，開一副牌。';
    if (state.phase === 'recap') return `seat ${state.jieSeat} 結`;
    if (state.phase === 'example') return '例牌窗口';
    if (state.toAct === 0) return state.phase === 'lead' ? '你出' : '你打或墊';
    return `seat ${state.toAct} 思考中`;
  }, [state]);

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
            {OPTION_LABELS.map(([key, label]) => (
              <label key={key}>
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
            ))}
          </div>
          <div className="tgw-actions">
            <button className="tgw-btn" type="button" onClick={() => deal(table, 0, [100, 100, 100, 100], 1, nextSeed('lab'))}>開牌</button>
            <button className="tgw-btn ghost" type="button" disabled={!state} onClick={() => deal(table, 0, [100, 100, 100, 100], 1, nextSeed(seed))}>再來</button>
            <button className="tgw-btn ghost" type="button" disabled={state?.phase !== 'recap'} onClick={continueHand}>下一局 · 飛莊</button>
          </div>
        </section>

        <section className="tgw-board" aria-label="Table felt">
          <div className="tgw-felt" />
          {SEAT_PLACE.map(({ seat, place, name }) => {
            const hand = god && state ? state.hands[seat] : seat === 0 ? state?.hands[0] ?? [] : [];
            const hiddenCount = state && seat !== 0 && !god ? state.hands[seat].length : 0;
            return (
              <div className={`tgw-seat ${place} ${state?.toAct === seat ? 'to-act' : ''}`} key={seat}>
                <div className="tgw-seat-meta">
                  <strong>{name}</strong>
                  <span>{state ? `${state.dong[seat]} 棟 · ${state.chips[seat]}` : '—'}</span>
                  {state?.bankerSeat === seat ? <span>莊</span> : null}
                </div>
                <div className="tgw-seat-row">
                  {seat === 0 || god
                    ? hand.map((id) => (
                      <BoneTile
                        key={id}
                        tile={getTile(id)}
                        selected={seat === 0 && selected.includes(id)}
                        onClick={seat === 0 && state?.toAct === 0 && state.phase !== 'recap' ? () => toggle(id) : undefined}
                      />
                    ))
                    : Array.from({ length: hiddenCount }, (_, index) => <BoneTile key={`${seat}-back-${index}`} faceDown />)}
                </div>
              </div>
            );
          })}
          <div className="tgw-center">
            <div>
              <strong>{status}</strong>
              <div className="tgw-trick">
                {view?.trick?.plays.map((play, index) => (
                  play.type === 'dump'
                    ? Array.from({ length: play.count }, (_, dumpIndex) => <BoneTile key={`d-${index}-${dumpIndex}`} faceDown />)
                    : play.tiles.map((id) => <BoneTile key={id} tile={getTile(id)} />)
                ))}
              </div>
            </div>
          </div>
        </section>

        {state?.toasts[0] ? <div className="tgw-toast" role="status">{state.toasts[0].title} · {state.toasts[0].detail}</div> : null}

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
            {(view?.log ?? []).slice(-16).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
          {state?.recap ? (
            <div className="tgw-recap">
              <p className="tgw-kicker">結</p>
              <table>
                <thead><tr><th>Seat</th><th>棟</th><th>籌碼</th></tr></thead>
                <tbody>
                  {state.recap.dong.map((dong, seat) => (
                    <tr key={seat}>
                      <td>{seat}{state.recap?.jieSeat === seat ? ' 結' : ''}{state.bankerSeat === seat ? ' 莊' : ''}</td>
                      <td>{dong}</td>
                      <td>{state.recap?.chipsAfter[seat]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>{[state.recap.flags.example, state.recap.flags.slam, state.recap.flags.baoHonor && '包尊', state.recap.flags.fourBao && '四大包'].filter(Boolean).join(' · ')} {state.recap.payments.map((payment) => `${payment.from}→${payment.to} ${payment.amount}`).join(' · ')}</p>
            </div>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
