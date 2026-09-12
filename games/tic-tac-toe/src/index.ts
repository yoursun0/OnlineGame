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

export function getWinner(board: Array<Mark | null>): Mark | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

export function chooseCpuMove(state: TicTacToeState): number {
  const cpuMark = state.nextMark;
  let bestCell = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let cell = 0; cell < 9; cell += 1) {
    if (state.board[cell]) continue;
    const score = scoreCpuPosition(ticTacToe.applyMove(state, { cell }, { id: 'cpu' }), cpuMark);
    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }
  if (bestCell < 0) throw new Error('No legal CPU move.');
  return bestCell;
}

function scoreCpuPosition(state: TicTacToeState, cpuMark: Mark): number {
  const status = ticTacToe.getStatus(state);
  if (status === 'draw') return 0;
  if (status === 'won') {
    const remaining = 9 - state.moveCount;
    return getWinner(state.board) === cpuMark ? remaining + 1 : -(remaining + 1);
  }
  const cpuToMove = state.nextMark === cpuMark;
  let best = cpuToMove ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (let cell = 0; cell < 9; cell += 1) {
    if (state.board[cell]) continue;
    const score = scoreCpuPosition(ticTacToe.applyMove(state, { cell }, { id: 'cpu' }), cpuMark);
    best = cpuToMove ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export function nextCpuMove(state: TicTacToeState, members: Array<{ seat: number; is_cpu?: boolean }>): TicTacToeMove | null {
  if (ticTacToe.getStatus(state) !== 'playing') return null;
  const cpu = members.find((member) => member.is_cpu);
  if (!cpu) return null;
  const expectedSeat = state.nextMark === 'X' ? 0 : 1;
  if (cpu.seat !== expectedSeat) return null;
  return { cell: chooseCpuMove(state) };
}
