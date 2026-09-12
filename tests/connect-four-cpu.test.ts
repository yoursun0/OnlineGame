import { expect, test } from 'bun:test';
import { chooseCpuMove, connectFour, nextCpuMove, type ConnectFourState } from '@playroom/connect-four';

function play(columns: number[]) {
  let state = connectFour.createInitialState();
  for (const column of columns) {
    const seat = state.nextColor === 'red' ? 0 : 1;
    state = connectFour.applyMove(state, { column }, { id: 'p', seat });
  }
  return state;
}

test('CPU takes a winning column when one is available', () => {
  const state = play([0, 6, 1, 6, 2, 6]);
  expect(state.nextColor).toBe('red');
  expect(chooseCpuMove(state)).toBe(3);
});

test('CPU blocks the opponent from completing four in a row', () => {
  const state = play([0, 4, 1, 4, 2]);
  expect(state.nextColor).toBe('yellow');
  expect(chooseCpuMove(state)).toBe(3);
});

test('CPU opens in the center column', () => {
  expect(chooseCpuMove(connectFour.createInitialState())).toBe(3);
});

test('CPU opens when it occupies the red seat', () => {
  expect(nextCpuMove(connectFour.createInitialState(), [{ seat: 0, is_cpu: true }])).toEqual({ column: 3 });
});

test('CPU waits when the human occupies the red seat', () => {
  expect(nextCpuMove(connectFour.createInitialState(), [{ seat: 1, is_cpu: true }])).toBeNull();
});

test("chooseCpuMove does not mutate the caller board", () => {
  const state: ConnectFourState = connectFour.createInitialState();
  const before = JSON.stringify(state.board);
  chooseCpuMove(state);
  expect(JSON.stringify(state.board)).toBe(before);
});
