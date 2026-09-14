import { expect } from 'bun:test';
import { applyMove, listLegalMoves, validateMove, type Move, type State } from '../src/reducer';
import { DECK, type TileId } from '../src/tiles';

export const PLAY_TABLE = {
  examples: false,
  slam: true,
  wenHonor: true,
  captureWenHonor: true,
  yaoSettle: true,
  yaoCapture: true,
  baoHonor: true,
  fourBless: true,
  baoHonorAlsoHe: false,
  extraExamples: false,
} as const;

export function fillHands(partial: Array<readonly TileId[] | undefined>): TileId[][] {
  const used = new Set(partial.flatMap((hand) => hand ?? []));
  const rest = DECK.map((tile) => tile.id).filter((id) => !used.has(id));
  return [0, 1, 2, 3].map((seat) => {
    const given = [...(partial[seat] ?? [])];
    while (given.length < 8) {
      const next = rest.shift();
      if (!next) throw new Error('Ran out of tiles while filling hands.');
      given.push(next);
    }
    return given;
  });
}

export function act(state: State, move: Move, seat = state.toAct): State {
  const result = validateMove(state, move, seat);
  expect(result).toEqual({ ok: true });
  return applyMove(state, move, seat);
}

export function dump(state: State, seat = state.toAct): State {
  const size = state.trick?.combo?.tiles.length;
  if (!size) throw new Error('No trick to dump onto.');
  const tiles = state.hands[seat].slice(-size);
  return act(state, { type: 'dump', tiles }, seat);
}

export function followersDump(state: State): State {
  let next = state;
  while (next.phase === 'follow') next = dump(next);
  return next;
}

export function lead(state: State, tiles: TileId[], seat = state.toAct): State {
  return act(state, { type: 'lead', tiles }, seat);
}

export function beat(state: State, tiles: TileId[], seat = state.toAct): State {
  return act(state, { type: 'beat', tiles }, seat);
}
