import { expect, test } from 'bun:test';
import { chooseCpuMove, nextCpuMove, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';

function state(board: TicTacToeState['board'], nextMark: TicTacToeState['nextMark']): TicTacToeState {
  return { board, nextMark, moveCount: board.filter(Boolean).length };
}

test('CPU takes a winning cell when one is available', () => {
  expect(chooseCpuMove(state(['X', 'X', null, 'O', 'O', null, null, null, null], 'X'))).toBe(2);
});

test('CPU blocks the opponent from completing three in a row', () => {
  expect(chooseCpuMove(state(['X', 'X', null, 'O', null, null, null, null, null], 'O'))).toBe(2);
});

test('CPU answers a corner opening with the center', () => {
  expect(chooseCpuMove(state(['X', null, null, null, null, null, null, null, null], 'O'))).toBe(4);
});

test('CPU versus CPU from an empty board is always a draw', () => {
  let current = ticTacToe.createInitialState();
  while (ticTacToe.getStatus(current) === 'playing') {
    current = ticTacToe.applyMove(current, { cell: chooseCpuMove(current) }, { id: 'cpu' });
  }
  expect(ticTacToe.getStatus(current)).toBe('draw');
});

test('CPU opens when it occupies the X seat', () => {
  expect(nextCpuMove(ticTacToe.createInitialState(), [{ seat: 0, is_cpu: true }])).toEqual({ cell: 0 });
});

test('CPU waits when the human occupies the X seat', () => {
  expect(nextCpuMove(ticTacToe.createInitialState(), [{ seat: 1, is_cpu: true }])).toBeNull();
});
