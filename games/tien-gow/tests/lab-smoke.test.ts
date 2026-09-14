import { expect, test } from 'bun:test';
import { nextCpuMove } from '../src/cpu';
import { applyMove, createHand, listLegalMoves, sameMove } from '../src/reducer';
import { DEFAULT_TABLE } from '../src/table';

test('one full CPU hand reaches 結 on defaults', () => {
  let state = createHand({
    seed: 'lab-smoke',
    table: { ...DEFAULT_TABLE, examples: false },
    bankerSeat: 0,
  });
  let guard = 0;
  while (state.phase !== 'recap' && guard < 400) {
    const seat = state.toAct;
    const move = nextCpuMove(state, seat);
    expect(move).not.toBeNull();
    expect(listLegalMoves(state, seat).some((legal) => sameMove(legal, move!))).toBe(true);
    state = applyMove(state, move!, seat);
    guard += 1;
  }
  expect(state.phase).toBe('recap');
  expect(state.jieSeat).not.toBeNull();
  expect(state.recap?.payments.length).toBeGreaterThan(0);
});
