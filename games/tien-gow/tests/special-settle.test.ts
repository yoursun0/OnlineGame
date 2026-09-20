import { expect, test } from 'bun:test';
import { createHand } from '../src/reducer';
import { settleJie } from '../src/scoring';
import { DEFAULT_TABLE } from '../src/table';
import { wenId, wuId } from '../src/tiles';
import { fillHands, followersDump, lead, PLAY_TABLE } from './helpers';

const supreme = [wuId([1, 2]), wuId([2, 4])];
const tian = [wenId('tian', 0), wenId('tian', 1)];
const jiu = [wuId([3, 6]), wuId([4, 5])];

test('包尊 ×2 and no 賀錢 unless baoHonorAlsoHe', () => {
  const flags = { baoHonor: true, fourBao: false, yaoJie: false, yaoCapture: false, slam: null, example: null };
  const payments = settleJie({
    dong: [2, 2, 2, 2],
    jieSeat: 0,
    bankerSeat: 0,
    bankerStreak: 1,
    table: DEFAULT_TABLE,
    flags,
  });
  expect(payments.every((payment) => payment.amount === 8 && payment.reason === '包尊')).toBe(true);

  const filler = [wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)];
  const hands = fillHands([[...supreme, ...filler], undefined, undefined, undefined]);
  const off = followersDump(lead(createHand({ seed: 'bao-off', table: PLAY_TABLE, bankerSeat: 0, hands }), supreme));
  // not last trick here — use last-trick path from honor test shape
  let last = createHand({ seed: 'bao-last', table: PLAY_TABLE, bankerSeat: 0, hands });
  for (const tile of filler) last = followersDump(lead(last, [tile]));
  last = followersDump(lead(last, supreme));
  expect(last.toasts).toEqual([]);
  expect(last.recap?.flags.baoHonor).toBe(true);

  let also = createHand({ seed: 'bao-he', table: { ...PLAY_TABLE, baoHonorAlsoHe: true }, bankerSeat: 0, hands });
  for (const tile of filler) also = followersDump(lead(also, [tile]));
  also = followersDump(lead(also, supreme));
  expect(also.toasts[0]?.title).toBe('賀尊');
  expect(also.recap?.flags.baoHonor).toBe(true);
});

test('四大包 ×4', () => {
  const flags = { baoHonor: false, fourBao: true, yaoJie: false, yaoCapture: false, slam: null, example: null };
  const payments = settleJie({
    dong: [4, 2, 1, 1],
    jieSeat: 0,
    bankerSeat: 1,
    bankerStreak: 1,
    table: DEFAULT_TABLE,
    flags,
  });
  const fromBanker = payments.find((payment) => payment.from === 1);
  expect(fromBanker?.amount).toBe(16);
  expect(fromBanker?.reason).toBe('四大包');
});

test('么雙擒四 covers below-par losses then ×4, 入一 still paid by 結', () => {
  const flags = { baoHonor: false, fourBao: false, yaoJie: false, yaoCapture: true, slam: null, example: null };
  const payments = settleJie({
    dong: [5, 2, 0, 1],
    jieSeat: 1,
    bankerSeat: 0,
    bankerStreak: 2,
    table: DEFAULT_TABLE,
    flags,
    capturedSeat: 0,
  });
  expect(payments.find((payment) => payment.to === 0)).toEqual({ from: 1, to: 0, amount: 1, reason: '入一' });
  expect(payments.find((payment) => payment.reason === '么雙擒四')).toEqual({
    from: 0,
    to: 1,
    amount: 32,
    reason: '么雙擒四',
  });
  expect(payments.some((payment) => payment.from === 2 || payment.from === 3)).toBe(false);
});
