import { expect, test } from 'bun:test';
import { createHand, dongCount } from '../src/reducer';
import { ordinaryNet, settleJie, stakeMultiplier } from '../src/scoring';
import { DEFAULT_TABLE } from '../src/table';
import { wenId } from '../src/tiles';
import { fillHands, followersDump, lead, PLAY_TABLE } from './helpers';

test('空棟 −5, par 4, 入一 / 入二', () => {
  expect(ordinaryNet(0)).toBe(-5);
  expect(ordinaryNet(1)).toBe(-3);
  expect(ordinaryNet(2)).toBe(-2);
  expect(ordinaryNet(3)).toBe(-1);
  expect(ordinaryNet(4)).toBe(0);
  expect(ordinaryNet(5)).toBe(1);
  expect(ordinaryNet(6)).toBe(2);
});

test('初任 ×2 when 莊 結 or 莊 loses below par', () => {
  const flags = { baoHonor: false, fourBao: false, yaoJie: false, yaoCapture: false, slam: null, example: null };
  const payments = settleJie({
    dong: [1, 4, 0, 3],
    jieSeat: 3,
    bankerSeat: 0,
    bankerStreak: 1,
    table: DEFAULT_TABLE,
    flags,
  });
  expect(payments).toEqual([
    { from: 0, to: 3, amount: 6, reason: '結' },
    { from: 2, to: 3, amount: 5, reason: '結' },
  ]);
});

test('losing 莊 入一 is not doubled', () => {
  expect(stakeMultiplier(3, 0, 0, 3, 1)).toBe(1);
  const flags = { baoHonor: false, fourBao: false, yaoJie: false, yaoCapture: false, slam: null, example: null };
  const payments = settleJie({
    dong: [5, 1, 0, 2],
    jieSeat: 3,
    bankerSeat: 0,
    bankerStreak: 2,
    table: DEFAULT_TABLE,
    flags,
  });
  expect(payments.find((payment) => payment.to === 0)).toEqual({ from: 3, to: 0, amount: 1, reason: '入一' });
});

test('reducer pays ordinary 結 into chips', () => {
  const hands = fillHands([
    [
      wenId('bandeng', 0),
      wenId('meihua', 0),
      wenId('futou', 0),
      wenId('changsan', 0),
      wenId('he', 0),
      wenId('ren', 0),
      wenId('di', 0),
      wenId('tian', 0),
    ],
    undefined,
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'score', table: PLAY_TABLE, bankerSeat: 0, hands });
  for (const tile of hands[0].slice(0, 7)) state = followersDump(lead(state, [tile]));
  state = followersDump(lead(state, [hands[0][7]]));
  expect(state.phase).toBe('recap');
  expect(state.jieSeat).toBe(0);
  expect(dongCount(state, 0)).toBe(8);
  expect(state.chips[0]).toBeGreaterThan(100);
  expect(state.recap?.payments.every((payment) => payment.to === 0)).toBe(true);
});
