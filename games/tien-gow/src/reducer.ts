import { comboBeats, enumerateCombos, identifyCombo, type Combo } from './combinations';
import { dealHands, hashSeed, randomBankerSeat } from './deal';
import { bestExample, findExamples } from './examples';
import {
  applyPayments,
  detectSlam,
  hePayments,
  ordinaryNet,
  settleJie,
  type Payment,
  type SettleFlags,
  type SlamKind,
} from './scoring';
import { mergeTable, type Table } from './table';
import { DECK, getTile, sortTileIds, type TileId } from './tiles';

export type Phase = 'example' | 'lead' | 'follow' | 'recap';

export type Move =
  | { type: 'lead' | 'beat' | 'dump'; tiles: TileId[] }
  | { type: 'claimExample' }
  | { type: 'skipExample' };

export type Actor = number | { id?: string; seat?: number };

export type MoveResult = { ok: true } | { ok: false; reason: string };

export type TrickPlay =
  | { seat: number; type: 'lead' | 'beat'; tiles: TileId[]; combo: Combo }
  | { seat: number; type: 'dump'; tiles: TileId[] };

export type Toast = { kind: 'he'; title: string; detail: string };

export type Recap = {
  jieSeat: number;
  dong: number[];
  ordinaryNets: number[];
  flags: SettleFlags;
  payments: Payment[];
  chipsBefore: number[];
  chipsAfter: number[];
  revealedHidden: TileId[][];
};

export type TrickState = {
  leader: number;
  combo: Combo | null;
  plays: TrickPlay[];
};

export type State = {
  table: Table;
  seed: string;
  bankerSeat: number;
  bankerStreak: number;
  chips: number[];
  hands: TileId[][];
  dong: number[];
  dongPublic: TileId[][];
  dongHidden: TileId[][];
  phase: Phase;
  toAct: number;
  skippedExamples: boolean[];
  trick: TrickState | null;
  firstLead: Combo | null;
  log: string[];
  toasts: Toast[];
  recap: Recap | null;
  jieSeat: number | null;
};

export type CreateHandInput = {
  seed: string;
  table?: Partial<Table>;
  bankerSeat?: number;
  bankerStreak?: number;
  chips?: number[];
  hands?: TileId[][];
};

export function seatOf(actor: Actor): number | undefined {
  return typeof actor === 'number' ? actor : actor.seat;
}

export function nextSeat(seat: number): number {
  return (seat + 1) % 4;
}

export function dongCount(state: State, seat: number): number {
  return state.dong[seat];
}

export function dongCounts(state: State): number[] {
  return [0, 1, 2, 3].map((seat) => dongCount(state, seat));
}

export function createHand(input: CreateHandInput): State {
  const table = mergeTable(input.table);
  const seed = input.seed;
  const hands = normalizeHands(input.hands ?? dealHands(seed));
  const bankerSeat = input.bankerSeat ?? randomBankerSeat(seed);
  const qualifying = exampleSeats(hands, table, bankerSeat);
  const phase: Phase = qualifying.length > 0 ? 'example' : 'lead';
  return {
    table,
    seed,
    bankerSeat,
    bankerStreak: input.bankerStreak ?? 1,
    chips: input.chips ? [...input.chips] : [100, 100, 100, 100],
    hands,
    dong: [0, 0, 0, 0],
    dongPublic: emptySeats(),
    dongHidden: emptySeats(),
    phase,
    toAct: phase === 'example' ? qualifying[0] : bankerSeat,
    skippedExamples: [false, false, false, false],
    trick: null,
    firstLead: null,
    log: [`莊 seat ${bankerSeat}`],
    toasts: [],
    recap: null,
    jieSeat: null,
  };
}

export function listLegalMoves(state: State, seat: number): Move[] {
  if (state.phase === 'recap' || seat !== state.toAct) return [];
  if (state.phase === 'example') {
    const moves: Move[] = [{ type: 'skipExample' }];
    if (findExamples(state.hands[seat], state.table).length > 0) moves.unshift({ type: 'claimExample' });
    return moves;
  }
  const hand = state.hands[seat];
  if (state.phase === 'lead') {
    return enumerateCombos(hand, state.table).map((combo) => ({ type: 'lead', tiles: combo.tiles }));
  }
  const current = state.trick?.combo;
  if (!current) return [];
  const size = current.tiles.length;
  const beats: Move[] = mustDumpLastSingleton(state, seat)
    ? []
    : enumerateCombos(hand, state.table)
        .filter((combo) => combo.tiles.length === size && comboBeats(combo, current, state.table))
        .map((combo) => ({ type: 'beat', tiles: combo.tiles }));
  const dumps: Move[] = subsets(hand, size).map((tiles) => ({ type: 'dump', tiles: sortTileIds(tiles) }));
  return [...beats, ...dumps];
}

export function validateMove(state: State, move: Move, actor: Actor): MoveResult {
  const seat = seatOf(actor);
  if (seat == null || seat < 0 || seat > 3) return { ok: false, reason: 'No seat.' };
  if (state.phase === 'recap') return { ok: false, reason: 'The hand is over.' };
  if (seat !== state.toAct) return { ok: false, reason: 'It is not this player’s turn.' };
  if (!listLegalMoves(state, seat).some((legal) => sameMove(legal, move))) {
    return { ok: false, reason: illegalReason(state, move, seat) };
  }
  return { ok: true };
}

export function applyMove(state: State, move: Move, actor: Actor): State {
  const check = validateMove(state, move, actor);
  if (!check.ok) throw new Error(check.reason);
  const seat = seatOf(actor);
  if (seat == null) throw new Error('No seat.');
  const next = cloneState(state);
  next.toasts = [];
  if (move.type === 'claimExample') return applyClaimExample(next, seat);
  if (move.type === 'skipExample') return applySkipExample(next, seat);
  if (move.type === 'lead') return applyLead(next, seat, move.tiles);
  if (move.type === 'beat') return applyBeat(next, seat, move.tiles);
  return applyDump(next, seat, move.tiles);
}

export function mustDumpLastSingleton(state: State, seat: number): boolean {
  return Boolean(
    state.trick?.combo
    && state.trick.combo.tiles.length === 1
    && dongCount(state, seat) === 0
    && state.hands[seat].length === 1,
  );
}

export function sameMove(left: Move, right: Move): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'claimExample' || left.type === 'skipExample') return true;
  if (right.type === 'claimExample' || right.type === 'skipExample') return false;
  return sortTileIds(left.tiles).join(',') === sortTileIds(right.tiles).join(',');
}

function applyClaimExample(state: State, seat: number): State {
  const pattern = bestExample(state.hands[seat], state.table);
  if (!pattern) throw new Error('No 例牌.');
  state.log.push(`seat ${seat} 例牌 ${pattern.name}`);
  return finishHand(state, seat, {
    baoHonor: false,
    fourBao: false,
    yaoJie: false,
    yaoCapture: false,
    slam: pattern.slam,
    example: pattern.name,
  });
}

function applySkipExample(state: State, seat: number): State {
  state.skippedExamples[seat] = true;
  state.log.push(`seat ${seat} skip 例牌`);
  const remaining = exampleSeats(state.hands, state.table, state.bankerSeat).filter((candidate) => !state.skippedExamples[candidate]);
  if (remaining.length === 0) {
    state.phase = 'lead';
    state.toAct = state.bankerSeat;
    return state;
  }
  state.toAct = remaining[0];
  return state;
}

function applyLead(state: State, seat: number, tiles: TileId[]): State {
  const combo = identifyCombo(tiles, state.table);
  if (!combo) throw new Error('Those tiles are not a legal combination.');
  takeTiles(state, seat, combo.tiles);
  state.trick = { leader: seat, combo, plays: [{ seat, type: 'lead', tiles: combo.tiles, combo }] };
  state.phase = 'follow';
  state.toAct = nextSeat(seat);
  if (!state.firstLead) state.firstLead = combo;
  state.log.push(`seat ${seat} lead ${combo.label}`);
  return maybeCompleteTrick(state);
}

function applyBeat(state: State, seat: number, tiles: TileId[]): State {
  const combo = identifyCombo(tiles, state.table);
  if (!combo || !state.trick) throw new Error('Those tiles are not a legal combination.');
  takeTiles(state, seat, combo.tiles);
  state.trick.plays.push({ seat, type: 'beat', tiles: combo.tiles, combo });
  state.trick.combo = combo;
  state.toAct = nextSeat(seat);
  state.log.push(`seat ${seat} beat ${combo.label}`);
  return maybeCompleteTrick(state);
}

function applyDump(state: State, seat: number, tiles: TileId[]): State {
  const sorted = sortTileIds(tiles);
  takeTiles(state, seat, sorted);
  if (!state.trick) throw new Error('No trick.');
  state.trick.plays.push({ seat, type: 'dump', tiles: sorted });
  state.toAct = nextSeat(seat);
  state.log.push(`seat ${seat} 墊 ${sorted.length}`);
  return maybeCompleteTrick(state);
}

function maybeCompleteTrick(state: State): State {
  if (!state.trick || state.trick.plays.length < 4) return state;
  return completeTrick(state);
}

function completeTrick(state: State): State {
  const trick = state.trick;
  if (!trick) return state;
  const winner = trickWinner(trick);
  const lastTrick = state.hands.every((hand) => hand.length === 0);
  for (const play of trick.plays) {
    if (play.type === 'dump') state.dongHidden[winner].push(...play.tiles);
    else state.dongPublic[winner].push(...play.tiles);
  }
  state.dong[winner] += trick.plays[0].tiles.length;
  const led = trick.plays[0];
  const winningCombo = trick.combo;
  state.log.push(`seat ${winner} wins trick (${dongCount(state, winner)} 棟)`);

  if (lastTrick) {
    return finishFromLastTrick(state, winner, led, winningCombo);
  }

  const honor = honorPayment(state, winner, led, winningCombo, false);
  if (honor) {
    state.chips = applyPayments(state.chips, honor.payments);
    state.toasts = [{ kind: 'he', title: honor.reason, detail: honor.payments.map((payment) => `${payment.from}→${payment.to} ${payment.amount}`).join(' · ') }];
    state.log.push(honor.reason);
  }

  state.trick = null;
  state.phase = 'lead';
  state.toAct = winner;
  return state;
}

function finishFromLastTrick(state: State, winner: number, led: TrickPlay, winningCombo: Combo | null): State {
  const table = state.table;
  const dong = dongCounts(state);
  const lastCombo = winningCombo;
  const lastSize = trick.playSize(state);
  const forcedLastSingleton = lastSize === 1 && [0, 1, 2, 3].filter((seat) => seat !== winner).every((seat) => dong[seat] === 0);
  const yao = detectYao(led, lastCombo, winner, table);
  const unbeatenWenHonor = Boolean(led.type === 'lead' && led.combo.class === 'wenHonor' && !trickWasBeaten(state));
  const ledSupreme = led.type === 'lead' && led.combo.class === 'supreme';
  const winningQuad = lastCombo?.class === 'quad';
  const flags: SettleFlags = {
    baoHonor: table.baoHonor && (ledSupreme || unbeatenWenHonor),
    fourBao: table.fourBless && Boolean(winningQuad),
    yaoJie: yao.yaoJie,
    yaoCapture: yao.yaoCapture,
    slam: detectSlam({
      table,
      dong,
      jieSeat: winner,
      lastCombo,
      forcedLastSingleton,
      firstLead: state.firstLead,
      bankerSeat: state.bankerSeat,
    }),
    example: null,
  };

  if (table.baoHonorAlsoHe && (flags.baoHonor || flags.fourBao)) {
    const honor = honorPayment(state, winner, led, winningCombo, true);
    if (honor) {
      state.chips = applyPayments(state.chips, honor.payments);
      state.toasts = [{ kind: 'he', title: honor.reason, detail: '包後賀' }];
      state.log.push(`${honor.reason} then 結`);
    }
  }

  return finishHand(state, winner, flags, yao.capturedSeat);
}

function trickWasBeaten(state: State): boolean {
  return Boolean(state.trick?.plays.some((play) => play.type === 'beat'));
}

function honorPayment(
  state: State,
  winner: number,
  led: TrickPlay,
  winningCombo: Combo | null,
  lastTrick: boolean,
): { reason: string; payments: Payment[] } | null {
  if (led.type !== 'lead') return null;
  const table = state.table;
  const capturedWenHonor = led.combo.class === 'wenHonor' && winningCombo !== null && comboBeats(winningCombo, led.combo, table);
  if (led.combo.class === 'supreme' && !lastTrick) {
    return {
      reason: '賀尊',
      payments: hePayments(winner, state.bankerSeat, state.bankerStreak, 2, '賀尊'),
    };
  }
  if (led.combo.class === 'wenHonor' && table.wenHonor && !lastTrick) {
    return {
      reason: capturedWenHonor ? '擒文尊' : '賀尊',
      payments: hePayments(winner, state.bankerSeat, state.bankerStreak, 2, capturedWenHonor ? '擒文尊' : '賀尊'),
    };
  }
  if (winningCombo?.class === 'quad' && table.fourBless && !lastTrick) {
    return {
      reason: '賀四',
      payments: hePayments(winner, state.bankerSeat, state.bankerStreak, 4, '賀四'),
    };
  }
  if (lastTrick && table.baoHonorAlsoHe) {
    if (led.combo.class === 'supreme' || (led.combo.class === 'wenHonor' && !capturedWenHonor)) {
      return { reason: '賀尊', payments: hePayments(winner, state.bankerSeat, state.bankerStreak, 2, '賀尊') };
    }
    if (winningCombo?.class === 'quad' && table.fourBless) {
      return { reason: '賀四', payments: hePayments(winner, state.bankerSeat, state.bankerStreak, 4, '賀四') };
    }
  }
  return null;
}

function detectYao(led: TrickPlay, winningCombo: Combo | null, jieSeat: number, table: Table): {
  yaoJie: boolean;
  yaoCapture: boolean;
  capturedSeat?: number;
} {
  if (!table.yaoSettle || led.type !== 'lead' || led.tiles.length !== 1 || !winningCombo || winningCombo.tiles.length !== 1) {
    return { yaoJie: false, yaoCapture: false };
  }
  const ledTile = getTile(led.tiles[0]);
  const winTile = getTile(winningCombo.tiles[0]);
  const ledYao = ledTile.name === 'sanjie' || (table.wenHonor && ledTile.name === 'lingren');
  if (!ledYao) return { yaoJie: false, yaoCapture: false };
  if (jieSeat === led.seat) return { yaoJie: true, yaoCapture: false };
  const captured =
    (ledTile.name === 'sanjie' && winTile.name === 'datou')
    || (table.wenHonor && ledTile.name === 'lingren' && winTile.name === 'gaojiao');
  if (captured && table.yaoCapture) return { yaoJie: false, yaoCapture: true, capturedSeat: led.seat };
  return { yaoJie: false, yaoCapture: false };
}

function finishHand(state: State, jieSeat: number, flags: SettleFlags, capturedSeat?: number): State {
  const dong = dongCounts(state);
  const chipsBefore = [...state.chips];
  const payments = settleJie({
    dong,
    jieSeat,
    bankerSeat: state.bankerSeat,
    bankerStreak: state.bankerStreak,
    table: state.table,
    flags,
    capturedSeat,
  });
  state.chips = applyPayments(state.chips, payments);
  state.jieSeat = jieSeat;
  state.phase = 'recap';
  state.toAct = jieSeat;
  state.trick = null;
  state.recap = {
    jieSeat,
    dong,
    ordinaryNets: dong.map(ordinaryNet),
    flags,
    payments,
    chipsBefore,
    chipsAfter: [...state.chips],
    revealedHidden: state.dongHidden.map((tiles) => [...tiles]),
  };
  state.log.push(`seat ${jieSeat} 結`);
  return state;
}

function trickWinner(trick: TrickState): number {
  const beats = trick.plays.filter((play) => play.type === 'beat');
  if (beats.length > 0) return beats[beats.length - 1].seat;
  return trick.leader;
}

const trick = {
  playSize(state: State): number {
    return state.trick?.plays[0]?.tiles.length ?? 0;
  },
};

function takeTiles(state: State, seat: number, tiles: TileId[]): void {
  for (const id of tiles) {
    const index = state.hands[seat].indexOf(id);
    if (index < 0) throw new Error('Tiles are not in hand.');
    state.hands[seat].splice(index, 1);
  }
}

function exampleSeats(hands: TileId[][], table: Table, bankerSeat: number): number[] {
  const seats: number[] = [];
  for (let offset = 0; offset < 4; offset += 1) {
    const seat = (bankerSeat + offset) % 4;
    if (findExamples(hands[seat], table).length > 0) seats.push(seat);
  }
  return seats;
}

function normalizeHands(hands: TileId[][]): TileId[][] {
  if (hands.length !== 4) throw new Error('Need four hands.');
  const used = new Set<TileId>();
  return hands.map((hand) => {
    if (hand.length !== 8) throw new Error('Each hand must have 8 tiles.');
    return hand.map((id) => {
      getTile(id);
      if (used.has(id)) throw new Error(`Duplicate tile ${id}`);
      used.add(id);
      return id;
    });
  });
}

function emptySeats(): TileId[][] {
  return [[], [], [], []];
}

function cloneState(state: State): State {
  return structuredClone(state);
}

function subsets(items: readonly TileId[], size: number): TileId[][] {
  const out: TileId[][] = [];
  const walk = (start: number, acc: TileId[]) => {
    if (acc.length === size) {
      out.push(sortTileIds(acc));
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      acc.push(items[index]);
      walk(index + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function illegalReason(state: State, move: Move, seat: number): string {
  if (move.type === 'claimExample') return 'This seat has no 例牌, or a higher seat still holds the window.';
  if (move.type === 'skipExample') return 'Cannot skip 例牌 now.';
  if (move.type === 'lead') return 'Those tiles are not a legal combination.';
  if (move.type === 'beat') {
    if (mustDumpLastSingleton(state, seat)) return 'Must 墊 the last singleton with 0 棟.';
    return 'That play does not beat the current combination.';
  }
  return 'Dump the same number of tiles as the lead.';
}

export function hashHandSeed(seed: string): number {
  return hashSeed(seed);
}

export { DECK };


