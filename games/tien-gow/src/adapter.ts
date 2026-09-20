import type { GameAdapter, Guest } from '@playroom/game-core';
import { applyMove, createHand, validateMove, type Move, type State } from './reducer';

export const tienGow: GameAdapter<State, Move> = {
  slug: 'tien-gow',
  title: '打天九',
  roomPrefix: 'TGW',
  players: { min: 4, max: 4 },
  supports: ['turn_based'],
  createInitialState: () => createHand({ seed: 'playroom' }),
  validateMove: (state, move, actor: Guest) => validateMove(state, move, actor),
  applyMove: (state, move, actor: Guest) => applyMove(state, move, actor),
  getStatus: () => 'playing',
};
