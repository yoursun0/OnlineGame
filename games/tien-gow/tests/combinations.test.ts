import { expect, test } from 'bun:test';
import { comboBeats, enumerateCombos, identifyCombo } from '../src/combinations';
import { DEFAULT_TABLE } from '../src/table';
import { wenId, wuId } from '../src/tiles';

const tian = [wenId('tian', 0), wenId('tian', 1)];
const di = [wenId('di', 0), wenId('di', 1)];
const gaojiao = [wenId('gaojiao', 0), wenId('gaojiao', 1)];
const lingren = [wenId('lingren', 0), wenId('lingren', 1)];
const jiu = [wuId([3, 6]), wuId([4, 5])];
const ba = [wuId([3, 5]), wuId([2, 6])];
const supreme = [wuId([1, 2]), wuId([2, 4])];

test('enumerator emits 文對, 武對, 天九 family, 至尊', () => {
  const hand = [...tian, ...jiu, ...supreme, wenId('meihua', 0), wenId('bandeng', 0)];
  const combos = enumerateCombos(hand, DEFAULT_TABLE);
  expect(combos.some((combo) => combo.class === 'wenPair' && combo.label.includes('天'))).toBe(true);
  expect(combos.some((combo) => combo.class === 'wuPair' && combo.label.includes('九'))).toBe(true);
  expect(combos.some((combo) => combo.class === 'mixedPair' && combo.family === 'tianjiu')).toBe(true);
  expect(combos.some((combo) => combo.class === 'tripleWen' && combo.family === 'tianjiu')).toBe(true);
  expect(combos.some((combo) => combo.class === 'tripleWu' && combo.family === 'tianjiu')).toBe(true);
  expect(combos.some((combo) => combo.class === 'quad' && combo.family === 'tianjiu')).toBe(true);
  expect(combos.some((combo) => combo.class === 'supreme')).toBe(true);
});

test('文尊 is present only if wenHonor', () => {
  const withHonor = identifyCombo(lingren, { wenHonor: true });
  const withoutHonor = identifyCombo(lingren, { wenHonor: false });
  expect(withHonor?.class).toBe('wenHonor');
  expect(withoutHonor?.class).toBe('wenPair');
  expect(enumerateCombos(lingren, { wenHonor: false }).some((combo) => combo.class === 'wenHonor')).toBe(false);
});

test('地八 does not beat 雜九', () => {
  const diba = identifyCombo([di[0], ba[0]], DEFAULT_TABLE);
  const zaJiu = identifyCombo(jiu, DEFAULT_TABLE);
  expect(diba?.class).toBe('mixedPair');
  expect(zaJiu?.class).toBe('wuPair');
  expect(comboBeats(diba!, zaJiu!, DEFAULT_TABLE)).toBe(false);
  expect(comboBeats(zaJiu!, diba!, DEFAULT_TABLE)).toBe(false);
});

test('三文 does not beat 三武', () => {
  const tripleWen = identifyCombo([...tian, jiu[0]], DEFAULT_TABLE);
  const tripleWu = identifyCombo([...jiu, tian[0]], DEFAULT_TABLE);
  expect(tripleWen?.class).toBe('tripleWen');
  expect(tripleWu?.class).toBe('tripleWu');
  expect(comboBeats(tripleWen!, tripleWu!, DEFAULT_TABLE)).toBe(false);
  expect(comboBeats(tripleWu!, tripleWen!, DEFAULT_TABLE)).toBe(false);
});

test('equal rank cannot beat', () => {
  const nineA = identifyCombo([jiu[0]], DEFAULT_TABLE);
  const nineB = identifyCombo([jiu[1]], DEFAULT_TABLE);
  expect(nineA?.rank).toBe(nineB?.rank);
  expect(comboBeats(nineA!, nineB!, DEFAULT_TABLE)).toBe(false);
  expect(comboBeats(nineB!, nineA!, DEFAULT_TABLE)).toBe(false);
  const tianA = identifyCombo([tian[0]], DEFAULT_TABLE);
  const tianB = identifyCombo([tian[1]], DEFAULT_TABLE);
  expect(comboBeats(tianA!, tianB!, DEFAULT_TABLE)).toBe(false);
});

test('孖高腳 beats led 文尊 only when both honor options are on', () => {
  const honor = identifyCombo(lingren, { wenHonor: true, captureWenHonor: true });
  const pair = identifyCombo(gaojiao, { wenHonor: true, captureWenHonor: true });
  expect(comboBeats(pair!, honor!, { wenHonor: true, captureWenHonor: true })).toBe(true);
  expect(comboBeats(pair!, honor!, { wenHonor: true, captureWenHonor: false })).toBe(false);
  expect(comboBeats(pair!, honor!, { wenHonor: false, captureWenHonor: true })).toBe(false);
});
