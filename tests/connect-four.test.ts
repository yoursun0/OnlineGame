import { expect, test } from 'bun:test';
import { COLS, ROWS, connectFour, getOpenRow, getWinner, type ConnectFourState } from '@playroom/connect-four';

function play(columns: number[], start: ConnectFourState = connectFour.createInitialState()) {
  let state = start;
  for (const column of columns) {
    const seat = state.nextColor === 'red' ? 0 : 1;
    const move = { column };
    const validation = connectFour.validateMove(state, move, { id: 'p', seat });
    expect(validation.ok).toBe(true);
    state = connectFour.applyMove(state, move, { id: 'p', seat });
  }
  return state;
}

test('tokens drop to the lowest open row', () => {
  const state = play([3, 3]);
  expect(state.board[ROWS - 1][3]).toBe('red');
  expect(state.board[ROWS - 2][3]).toBe('yellow');
  expect(getOpenRow(state.board, 3)).toBe(ROWS - 3);
});

test('a full column is rejected', () => {
  const state = play([0, 0, 0, 0, 0, 0]);
  const validation = connectFour.validateMove(state, { column: 0 }, { id: 'p', seat: 0 });
  expect(validation).toEqual({ ok: false, reason: 'That column is full.' });
});

test('the opponent cannot move out of turn', () => {
  const state = connectFour.createInitialState();
  expect(connectFour.validateMove(state, { column: 3 }, { id: 'p', seat: 1 })).toEqual({
    ok: false,
    reason: 'It is not this player’s turn.',
  });
});

test('an out-of-range column is rejected', () => {
  const state = connectFour.createInitialState();
  expect(connectFour.validateMove(state, { column: COLS }, { id: 'p', seat: 0 })).toEqual({
    ok: false,
    reason: 'Column must be between 0 and 6.',
  });
});

test('four in a row horizontally wins', () => {
  const state = play([0, 0, 1, 1, 2, 2, 3]);
  expect(connectFour.getStatus(state)).toBe('won');
  expect(getWinner(state.board, state.lastDrop)).toBe('red');
});

test('four in a row vertically wins', () => {
  const state = play([1, 2, 1, 2, 1, 2, 1]);
  expect(connectFour.getStatus(state)).toBe('won');
  expect(getWinner(state.board, state.lastDrop)).toBe('red');
});

test('four in a row diagonally wins', () => {
  const state = play([0, 1, 1, 2, 3, 2, 2, 3, 4, 3, 3]);
  expect(connectFour.getStatus(state)).toBe('won');
  expect(getWinner(state.board, state.lastDrop)).toBe('red');
});

test('a full board without four in a row is a draw', () => {
  const pattern = [
    ['red', 'red', 'yellow', 'yellow', 'red', 'red'],
    ['yellow', 'yellow', 'red', 'red', 'yellow', 'yellow'],
  ] as const;
  const board = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, column) => pattern[column % 2][ROWS - 1 - row]),
  );
  const state = { board, nextColor: 'red' as const, moveCount: 42, lastDrop: null };
  expect(getWinner(state.board)).toBeNull();
  expect(connectFour.getStatus(state)).toBe('draw');
});
