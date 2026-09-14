import { expect, test } from 'bun:test';
import { createHand } from '../src/reducer';
import { detectSlam, settleJie } from '../src/scoring';
import { DEFAULT_TABLE } from '../src/table';
import { identifyCombo } from '../src/combinations';
import { wenId, wuId } from '../src/tiles';
import { fillHands, followersDump, lead, PLAY_TABLE } from './helpers';

test('slam requires all 8 棟', () => {
  expect(
    detectSlam({
      table: DEFAULT_TABLE,
      dong: [7, 1, 0, 0],
      jieSeat: 0,
      lastCombo: identifyCombo([wenId('tian', 0)]),
      forcedLastSingleton: false,
      firstLead: identifyCombo([wenId('bandeng', 0)]),
      bankerSeat: 0,
    }),
  ).toBeNull();
});

test('forced last singleton is 七支', () => {
  const filler = [
    wenId('bandeng', 0),
    wenId('meihua', 0),
    wenId('futou', 0),
    wenId('changsan', 0),
    wenId('he', 0),
    wenId('ren', 0),
    wenId('di', 0),
  ];
  const hands = fillHands([[...filler, wenId('tian', 0)], undefined, undefined, undefined]);
  let state = createHand({ seed: 'forced-seven', table: PLAY_TABLE, bankerSeat: 0, hands });
  for (const tile of filler) state = followersDump(lead(state, [tile]));
  state = followersDump(lead(state, [wenId('tian', 0)]));
  expect(state.recap?.flags.slam).toBe('seven');
  expect(state.recap?.dong).toEqual([8, 0, 0, 0]);
});

test('莊 first lead 天 cannot be 八支', () => {
  const filler = [wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)];
  const pair = [wenId('bandeng', 0), wenId('bandeng', 1)];
  const hands = fillHands([[wenId('tian', 0), ...filler, ...pair], undefined, undefined, undefined]);
  let state = createHand({ seed: 'banker-tian', table: PLAY_TABLE, bankerSeat: 0, hands });
  state = followersDump(lead(state, [wenId('tian', 0)]));
  for (const tile of filler) state = followersDump(lead(state, [tile]));
  state = followersDump(lead(state, pair));
  expect(state.recap?.flags.slam).toBe('seven');
});

test('empty 5 then slam multiplier, then 莊', () => {
  const seven = settleJie({
    dong: [0, 8, 0, 0],
    jieSeat: 1,
    bankerSeat: 0,
    bankerStreak: 1,
    table: DEFAULT_TABLE,
    flags: { baoHonor: false, fourBao: false, yaoJie: false, yaoCapture: false, slam: 'seven', example: null },
  });
  expect(seven.find((payment) => payment.from === 2)?.amount).toBe(10);
  expect(seven.find((payment) => payment.from === 0)?.amount).toBe(20);

  const eight = settleJie({
    dong: [0, 8, 0, 0],
    jieSeat: 1,
    bankerSeat: 0,
    bankerStreak: 1,
    table: DEFAULT_TABLE,
    flags: { baoHonor: false, fourBao: false, yaoJie: false, yaoCapture: false, slam: 'eight', example: null },
  });
  expect(eight.find((payment) => payment.from === 2)?.amount).toBe(20);
  expect(eight.find((payment) => payment.from === 0)?.amount).toBe(40);
});
