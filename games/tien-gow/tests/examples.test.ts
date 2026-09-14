import { expect, test } from 'bun:test';
import { findExamples } from '../src/examples';
import { createHand, validateMove } from '../src/reducer';
import { DEFAULT_TABLE } from '../src/table';
import { wenId, wuId } from '../src/tiles';
import { act, fillHands, PLAY_TABLE } from './helpers';

const white = [
  wenId('tian', 0),
  wenId('tian', 1),
  wenId('meihua', 0),
  wenId('meihua', 1),
  wenId('changsan', 0),
  wenId('changsan', 1),
  wenId('bandeng', 0),
  wenId('bandeng', 1),
  wenId('futou', 0),
  wenId('futou', 1),
  wuId([3, 6]),
  wuId([3, 5]),
  wuId([2, 6]),
  wuId([2, 5]),
  wuId([2, 3]),
];

test('four default 例牌 hands', () => {
  const oneRed = [wenId('lingren', 0), ...white.slice(0, 7)];
  const sevenWu = [
    wuId([3, 6]),
    wuId([4, 5]),
    wuId([3, 5]),
    wuId([2, 6]),
    wuId([3, 4]),
    wuId([2, 5]),
    wuId([2, 4]),
    wenId('tian', 0),
  ];
  const allWhite = white.slice(0, 8);
  const eightWu = [
    wuId([3, 6]),
    wuId([4, 5]),
    wuId([3, 5]),
    wuId([2, 6]),
    wuId([3, 4]),
    wuId([2, 5]),
    wuId([2, 4]),
    wuId([2, 3]),
  ];
  expect(findExamples(oneRed, DEFAULT_TABLE).map((item) => item.name)).toContain('一點紅');
  expect(findExamples(sevenWu, DEFAULT_TABLE).map((item) => item.name)).toContain('七武');
  expect(findExamples(allWhite, DEFAULT_TABLE).map((item) => item.name)).toContain('全白');
  expect(findExamples(eightWu, DEFAULT_TABLE).map((item) => item.name)).toContain('八武');
});

test('莊 has 例牌 priority and immediate 結 with slam', () => {
  const hands = fillHands([
    [wenId('lingren', 0), ...white.slice(0, 7)],
    [wenId('gaojiao', 0), ...white.slice(7, 14)],
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'example-banker', table: { ...PLAY_TABLE, examples: true }, bankerSeat: 0, hands });
  expect(state.phase).toBe('example');
  expect(state.toAct).toBe(0);
  expect(validateMove(state, { type: 'claimExample' }, 1).ok).toBe(false);
  state = act(state, { type: 'claimExample' }, 0);
  expect(state.phase).toBe('recap');
  expect(state.jieSeat).toBe(0);
  expect(state.recap?.flags.example).toBe('一點紅');
  expect(state.recap?.flags.slam).toBe('seven');
});

test('extraExamples off: 四對子 is not 例牌', () => {
  const fourPairs = [
    wenId('tian', 0),
    wenId('tian', 1),
    wenId('di', 0),
    wenId('di', 1),
    wenId('meihua', 0),
    wenId('meihua', 1),
    wenId('bandeng', 0),
    wenId('bandeng', 1),
  ];
  expect(findExamples(fourPairs, { ...DEFAULT_TABLE, extraExamples: false })).toEqual([]);
  expect(findExamples(fourPairs, { ...DEFAULT_TABLE, extraExamples: true }).map((item) => item.name)).toContain('四對子');
});
