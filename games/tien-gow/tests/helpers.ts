import { expect } from 'bun:test';
import { applyMove, validateMove, type Move, type State } from '../src/reducer';
import { type TileId } from '../src/tiles';
import { fillHands } from '../src/uat-fixtures';

export { fillHands };

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
