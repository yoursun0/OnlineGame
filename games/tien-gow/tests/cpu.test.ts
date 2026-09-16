import { expect, test } from 'bun:test';
import { nextCpuMove } from '../src/cpu';
import { createHand, listLegalMoves } from '../src/reducer';
import { wenId, wuId } from '../src/tiles';
import { fillHands, followersDump, lead, PLAY_TABLE } from './helpers';

const supreme = [wuId([1, 2]), wuId([2, 4])];
const lingren = [wenId('lingren', 0), wenId('lingren', 1)];
const gaojiao = [wenId('gaojiao', 0), wenId('gaojiao', 1)];
const tian = [wenId('tian', 0), wenId('tian', 1)];
const jiu = [wuId([3, 6]), wuId([4, 5])];

test('CPU move is always in listLegalMoves', () => {
  let state = createHand({ seed: 'cpu-legal', table: PLAY_TABLE, bankerSeat: 0 });
  const move = nextCpuMove(state, state.toAct);
  expect(move).not.toBeNull();
  expect(listLegalMoves(state, state.toAct).some((legal) => JSON.stringify(legal) === JSON.stringify(move))).toBe(true);
});

test('on lead: 武尊, then 文尊, then 四文武', () => {
  const hands = fillHands([[...supreme, ...lingren, ...tian, ...jiu], undefined, undefined, undefined]);
  const state = createHand({ seed: 'cpu-lead', table: PLAY_TABLE, bankerSeat: 0, hands });
  expect(nextCpuMove(state, 0)).toEqual({ type: 'lead', tiles: [...supreme].sort() });
});

test('擒文尊 if current combo is 文尊 and seat holds 孖高腳', () => {
  const hands = fillHands([
    [...lingren, wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)],
    [...gaojiao, wenId('di', 0), wenId('di', 1), ...tian, ...jiu],
    undefined,
    undefined,
  ]);
  const state = lead(createHand({ seed: 'cpu-capture', table: PLAY_TABLE, bankerSeat: 0, hands }), lingren);
  expect(nextCpuMove(state, 1)).toEqual({ type: 'beat', tiles: [...gaojiao].sort() });
});

test('beat to 結 when eligible, else cheapest legal beat, else dump junk', () => {
  const cheapHands = fillHands([
    [wenId('lingren', 0), wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('pingfeng', 0)],
    [wenId('di', 0), wenId('tian', 0), wenId('gaojiao', 0), wenId('lingren', 1), wuId([2, 3]), wuId([1, 4]), wuId([2, 5]), wuId([3, 4])],
    undefined,
    undefined,
  ]);
  const cheap = lead(createHand({ seed: 'cpu-cheap', table: PLAY_TABLE, bankerSeat: 0, hands: cheapHands }), [wenId('lingren', 0)]);
  expect(nextCpuMove(cheap, 1)).toEqual({ type: 'beat', tiles: [wenId('gaojiao', 0)] });

  const dumpHands = fillHands([
    [wenId('tian', 0), wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('di', 0)],
    [...supreme, wenId('lingren', 0), wenId('lingren', 1), wenId('gaojiao', 0), wenId('pingfeng', 0), wuId([3, 5]), wuId([2, 6])],
    undefined,
    undefined,
  ]);
  const dumping = lead(createHand({ seed: 'cpu-dump', table: PLAY_TABLE, bankerSeat: 0, hands: dumpHands }), [wenId('tian', 0)]);
  const move = nextCpuMove(dumping, 1);
  expect(move?.type).toBe('dump');
  expect(move && move.type === 'dump' ? move.tiles : []).not.toEqual(expect.arrayContaining(supreme));
});
