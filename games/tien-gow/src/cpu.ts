import { comboBeats, enumerateCombos, identifyCombo, isGaojiaoPair } from './combinations';
import {
  listLegalMoves,
  mustDumpLastSingleton,
  sameMove,
  type Move,
  type State,
} from './reducer';
import { getTile, sortTileIds, type TileId } from './tiles';

type TileMove = Extract<Move, { tiles: TileId[] }>;

export function dumpFollowMove(state: State, seat: number): Move | null {
  if (state.phase !== 'follow') return null;
  const dumps = listLegalMoves(state, seat).filter((move): move is TileMove => move.type === 'dump');
  if (dumps.length === 0) return null;
  const size = state.trick?.combo?.tiles.length;
  if (!size) return dumps[0];
  const tiles = sortTileIds(state.hands[seat].slice(-size));
  return dumps.find((move) => sameMove(move, { type: 'dump', tiles })) ?? dumps[0];
}

export function nextLabCpuMove(state: State, seat: number, cpu: 'auto' | 'dump'): Move | null {
  if (cpu === 'dump' && state.phase === 'follow') return dumpFollowMove(state, seat);
  return nextCpuMove(state, seat);
}

export function nextCpuMove(state: State, seat: number): Move | null {
  const legal = listLegalMoves(state, seat);
  if (legal.length === 0) return null;

  if (state.phase === 'example') {
    const claim = legal.find((move) => move.type === 'claimExample');
    if (claim && isExampleWindowWinner(state, seat)) return claim;
    return legal.find((move) => move.type === 'skipExample') ?? null;
  }

  if (state.phase === 'lead') {
    const leads = legal.filter((move): move is TileMove => move.type === 'lead').map((move) => ({
      move,
      combo: identifyCombo(move.tiles, state.table)!,
    }));
    const supreme = leads.find((item) => item.combo.class === 'supreme');
    if (supreme) return supreme.move;
    const wenHonor = leads.find((item) => item.combo.class === 'wenHonor');
    if (wenHonor) return wenHonor.move;
    const quads = leads.filter((item) => item.combo.class === 'quad').sort((left, right) => left.combo.rank - right.combo.rank);
    if (quads.length > 0) return quads[0].move;
    return cheapestLead(leads);
  }

  const beats = legal.filter((move): move is TileMove => move.type === 'beat');
  const dumps = legal.filter((move): move is TileMove => move.type === 'dump');
  const current = state.trick?.combo;
  if (current?.class === 'wenHonor') {
    const capture = beats.find((move) => {
      const combo = identifyCombo(move.tiles, state.table);
      return combo && isGaojiaoPair(combo) && comboBeats(combo, current, state.table);
    });
    if (capture) return capture;
  }
  if (beats.length > 0 && isLastTrick(state) && !mustDumpLastSingleton(state, seat)) {
    return cheapestBeat(beats, state);
  }
  if (beats.length > 0) return cheapestBeat(beats, state);
  return dumpJunk(state, seat, dumps);
}

function isExampleWindowWinner(state: State, seat: number): boolean {
  return state.toAct === seat && listLegalMoves(state, seat).some((move) => move.type === 'claimExample');
}

function cheapestLead(leads: Array<{ move: Move; combo: NonNullable<ReturnType<typeof identifyCombo>> }>): Move {
  const sorted = [...leads].sort((left, right) => {
    const size = left.combo.tiles.length - right.combo.tiles.length;
    if (size !== 0) return size;
    const rank = right.combo.rank - left.combo.rank;
    if (rank !== 0) return rank;
    return left.combo.tiles.join(',').localeCompare(right.combo.tiles.join(','));
  });
  return sorted[0].move;
}

function cheapestBeat(beats: TileMove[], state: State): Move {
  const ranked = beats.map((move) => ({ move, combo: identifyCombo(move.tiles, state.table)! }));
  ranked.sort((left, right) => {
    const rank = right.combo.rank - left.combo.rank;
    if (rank !== 0) return rank;
    return left.combo.tiles.join(',').localeCompare(right.combo.tiles.join(','));
  });
  return ranked[0].move;
}

function dumpJunk(state: State, seat: number, dumps: TileMove[]): Move {
  if (dumps.length === 0) throw new Error("No dump move.");
  const size = dumps[0].type === 'dump' ? dumps[0].tiles.length : 0;
  const ordered = [...state.hands[seat]].sort((left, right) => {
    const keep = keepValue(left, state, seat) - keepValue(right, state, seat);
    if (keep !== 0) return keep;
    return left.localeCompare(right);
  });
  const tiles = sortTileIds(ordered.slice(0, size));
  const match = dumps.find((move) => move.type === 'dump' && move.tiles.join(',') === tiles.join(','));
  return match ?? dumps[0];
}

function keepValue(id: TileId, state: State, seat: number): number {
  const combos = enumerateCombos(state.hands[seat], state.table);
  const tile = getTile(id);
  let keep = 20 - tile.rank;
  if (combos.some((combo) => combo.class === 'supreme' && combo.tiles.includes(id))) keep += 1000;
  if (combos.some((combo) => combo.class === 'wenHonor' && combo.tiles.includes(id))) keep += 900;
  if (combos.some((combo) => combo.class === 'quad' && combo.tiles.includes(id))) keep += 800;
  if (combos.some((combo) => (combo.class === 'wenPair' || combo.class === 'wuPair') && combo.tiles.includes(id))) keep += 100;
  return keep;
}

function isLastTrick(state: State): boolean {
  if (!state.trick?.combo) return false;
  const size = state.trick.combo.tiles.length;
  return state.hands.every((hand, seat) => {
    const played = state.trick!.plays.some((play) => play.seat === seat);
    return played ? hand.length === 0 : hand.length === size;
  });
}
