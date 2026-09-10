import type { GameAdapter, Guest } from '@playroom/game-core';

export type Mark = 'X' | 'O';
export type TicTacToeState = { board: Array<Mark | null>; nextMark: Mark; moveCount: number };
export type TicTacToeMove = { cell: number };

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
  [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
] as const;

export const ticTacToe: GameAdapter<TicTacToeState, TicTacToeMove> = {
  slug: 'tic-tac-toe',
  title: 'Tic-tac-toe',
  roomPrefix: 'TIK',
  players: { min: 2, max: 2 },
  supports: ['turn_based'],
  createInitialState: () => ({ board: Array(9).fill(null), nextMark: 'X', moveCount: 0 }),
  validateMove: (state, move, actor: Guest) => {
    if (state.moveCount >= 9 || getWinner(state.board)) return { ok: false, reason: 'Game is over.' };
    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8) {
      return { ok: false, reason: 'Cell must be between 0 and 8.' };
    }
    if (state.board[move.cell]) return { ok: false, reason: 'Cell is already occupied.' };
    const expectedSeat = state.nextMark === 'X' ? 0 : 1;
    if (actor.seat !== expectedSeat) return { ok: false, reason: 'It is not this player’s turn.' };
    return { ok: true };
  },
  applyMove: (state, move) => ({
    board: state.board.map((mark, index) => index === move.cell ? state.nextMark : mark),
    nextMark: state.nextMark === 'X' ? 'O' : 'X',
    moveCount: state.moveCount + 1,
  }),
  getStatus: (state) => getWinner(state.board) ? 'won' : state.moveCount === 9 ? 'draw' : 'playing',
};

function getWinner(board: Array<Mark | null>): Mark | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}
