import { expect, test } from 'bun:test';
import { createHand, listLegalMoves, validateMove, dongCount } from '../src/reducer';
import { wenId, wuId } from '../src/tiles';
import { beat, dump, fillHands, followersDump, lead, PLAY_TABLE } from './helpers';

test('lead, beat, and 墊; 墊 is always legal', () => {
  const hands = fillHands([
    [wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('di', 0), wenId('tian', 0)],
    [wenId('tian', 1), wenId('lingren', 0), wenId('gaojiao', 0), wenId('pingfeng', 0), wuId([1, 2]), wuId([2, 4]), wuId([2, 3]), wuId([1, 4])],
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'tricks', table: PLAY_TABLE, bankerSeat: 0, hands });
  state = lead(state, [wenId('bandeng', 0)]);
  expect(listLegalMoves(state, 1).some((move) => move.type === 'dump')).toBe(true);
  expect(listLegalMoves(state, 1).some((move) => move.type === 'beat' && move.tiles.includes(wenId('tian', 1)))).toBe(true);
  state = dump(state, 1);
  expect(state.toAct).toBe(2);
  state = dump(state, 2);
  state = dump(state, 3);
  expect(state.phase).toBe('lead');
  expect(state.toAct).toBe(0);
  expect(dongCount(state, 0)).toBe(1);
});

test('上家 must act before 下家', () => {
  const hands = fillHands([
    [wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('di', 0), wenId('tian', 0)],
    undefined,
    [wenId('tian', 1), wenId('lingren', 0), wenId('gaojiao', 0), wenId('pingfeng', 0), wuId([1, 2]), wuId([2, 4]), wuId([2, 3]), wuId([1, 4])],
    undefined,
  ]);
  const state = lead(createHand({ seed: 'order', table: PLAY_TABLE, bankerSeat: 0, hands }), [wenId('bandeng', 0)]);
  expect(state.toAct).toBe(1);
  expect(validateMove(state, { type: 'dump', tiles: [wenId('tian', 1)] }, 2)).toEqual({
    ok: false,
    reason: 'It is not this player’s turn.',
  });
  expect(validateMove(state, { type: 'beat', tiles: [wenId('tian', 1)] }, 2).ok).toBe(false);
});

test('0 棟 after 7 tiles must dump a singleton last trick', () => {
  const hands = fillHands([
    [
      wenId('bandeng', 0),
      wenId('meihua', 0),
      wenId('futou', 0),
      wenId('changsan', 0),
      wenId('he', 0),
      wenId('ren', 0),
      wenId('di', 0),
      wenId('lingren', 0),
    ],
    [
      wenId('tian', 0),
      wenId('lingren', 1),
      wenId('gaojiao', 0),
      wenId('pingfeng', 0),
      wuId([1, 2]),
      wuId([2, 4]),
      wuId([2, 3]),
      wuId([1, 4]),
    ],
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'must-dump', table: PLAY_TABLE, bankerSeat: 0, hands });
  for (const tile of [
    wenId('bandeng', 0),
    wenId('meihua', 0),
    wenId('futou', 0),
    wenId('changsan', 0),
    wenId('he', 0),
    wenId('ren', 0),
    wenId('di', 0),
  ]) {
    state = followersDump(lead(state, [tile]));
  }
  expect(dongCount(state, 0)).toBe(7);
  expect(dongCount(state, 1)).toBe(0);
  state = lead(state, [wenId('lingren', 0)]);
  expect(state.phase).toBe('follow');
  expect(listLegalMoves(state, 1).every((move) => move.type === 'dump')).toBe(true);
  expect(validateMove(state, { type: 'beat', tiles: [wenId('tian', 0)] }, 1)).toEqual({
    ok: false,
    reason: 'Must 墊 the last singleton with 0 棟.',
  });
});

test('last trick of 2+ tiles allows a 0 棟 beat', () => {
  const hands = fillHands([
    [
      wenId('bandeng', 0),
      wenId('bandeng', 1),
      wenId('meihua', 0),
      wenId('futou', 0),
      wenId('changsan', 0),
      wenId('he', 0),
      wenId('ren', 0),
      wenId('di', 0),
    ],
    [
      wenId('tian', 0),
      wenId('tian', 1),
      wenId('lingren', 0),
      wenId('gaojiao', 0),
      wenId('pingfeng', 0),
      wuId([1, 2]),
      wuId([2, 4]),
      wuId([2, 3]),
    ],
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'pair-last', table: PLAY_TABLE, bankerSeat: 0, hands });
  for (const tile of [
    wenId('meihua', 0),
    wenId('futou', 0),
    wenId('changsan', 0),
    wenId('he', 0),
    wenId('ren', 0),
    wenId('di', 0),
  ]) {
    state = followersDump(lead(state, [tile]));
  }
  expect(dongCount(state, 1)).toBe(0);
  state = lead(state, [wenId('bandeng', 0), wenId('bandeng', 1)]);
  expect(validateMove(state, { type: 'beat', tiles: [wenId('tian', 0), wenId('tian', 1)] }, 1).ok).toBe(true);
  state = beat(state, [wenId('tian', 0), wenId('tian', 1)], 1);
  state = dump(state);
  state = dump(state);
  expect(state.phase).toBe('recap');
  expect(state.jieSeat).toBe(1);
  expect(dongCount(state, 1)).toBe(2);
});
