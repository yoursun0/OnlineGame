import { expect, test } from 'bun:test';
import { createHand, listLegalMoves, validateMove } from '../src/reducer';
import { wenId, wuId } from '../src/tiles';
import { beat, dump, fillHands, followersDump, lead, PLAY_TABLE } from './helpers';

const supreme = [wuId([1, 2]), wuId([2, 4])];
const lingren = [wenId('lingren', 0), wenId('lingren', 1)];
const gaojiao = [wenId('gaojiao', 0), wenId('gaojiao', 1)];

test('mid-hand 至尊 pays immediately and collector leads', () => {
  const hands = fillHands([
    [...supreme, wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)],
    undefined,
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'he-supreme', table: PLAY_TABLE, bankerSeat: 0, hands });
  state = followersDump(lead(state, supreme));
  expect(state.toasts[0]?.title).toBe('賀尊');
  expect(state.chips).toEqual([112, 96, 96, 96]);
  expect(state.phase).toBe('lead');
  expect(state.toAct).toBe(0);
});

test('擒文尊 only if both honor options are on', () => {
  const hands = fillHands([
    [...lingren, wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)],
    [...gaojiao, wenId('di', 0), wenId('di', 1), wenId('tian', 0), wenId('tian', 1), wuId([3, 6]), wuId([4, 5])],
    undefined,
    undefined,
  ]);
  let on = createHand({ seed: 'capture-on', table: PLAY_TABLE, bankerSeat: 0, hands });
  on = lead(on, lingren);
  expect(validateMove(on, { type: 'beat', tiles: gaojiao }, 1).ok).toBe(true);
  on = beat(on, gaojiao, 1);
  on = dump(on);
  on = dump(on);
  expect(on.toasts[0]?.title).toBe('擒文尊');
  expect(on.toAct).toBe(1);

  let off = createHand({
    seed: 'capture-off',
    table: { ...PLAY_TABLE, captureWenHonor: false },
    bankerSeat: 0,
    hands,
  });
  off = lead(off, lingren);
  expect(validateMove(off, { type: 'beat', tiles: gaojiao }, 1).ok).toBe(false);
});

test('wenHonor on and captureWenHonor off: led 文尊 is unbeatable', () => {
  const hands = fillHands([
    [...lingren, wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)],
    [...gaojiao, wenId('tian', 0), wenId('tian', 1), wenId('di', 0), wenId('di', 1), wuId([3, 6]), wuId([4, 5])],
    undefined,
    undefined,
  ]);
  const state = lead(
    createHand({ seed: 'unbeatable', table: { ...PLAY_TABLE, captureWenHonor: false }, bankerSeat: 0, hands }),
    lingren,
  );
  expect(listLegalMoves(state, 1).every((move) => move.type === 'dump')).toBe(true);
});

test('last-trick 至尊 is not 賀', () => {
  const filler = [wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)];
  const hands = fillHands([[...supreme, ...filler], undefined, undefined, undefined]);
  let state = createHand({ seed: 'bao-not-he', table: PLAY_TABLE, bankerSeat: 0, hands });
  for (const tile of filler) state = followersDump(lead(state, [tile]));
  const chips = [...state.chips];
  state = followersDump(lead(state, supreme));
  expect(state.phase).toBe('recap');
  expect(state.toasts.length).toBe(0);
  expect(state.recap?.flags.baoHonor).toBe(true);
  expect(state.chips[1]).not.toBe(chips[1] - 4);
});
