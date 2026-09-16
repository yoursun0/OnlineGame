import { expect, test } from 'bun:test';
import { createHand } from '../src/reducer';
import { findExamples } from '../src/examples';
import { getTile, wenId, wuId, type TileId } from '../src/tiles';
import { getUatFixture, UAT_FIXTURE_IDS } from '../src/uat-fixtures';

function uniqueIds(hands: TileId[][]): TileId[] {
  return hands.flat();
}

test('every UAT fixture deals 8×4 unique tiles', () => {
  expect(UAT_FIXTURE_IDS.length).toBeGreaterThanOrEqual(13);
  for (const id of UAT_FIXTURE_IDS) {
    const fixture = getUatFixture(id);
    expect(fixture, id).toBeDefined();
    expect(fixture!.hands).toHaveLength(4);
    expect(fixture!.hands.every((hand) => hand.length === 8)).toBe(true);
    const ids = uniqueIds(fixture!.hands);
    expect(new Set(ids).size).toBe(32);
    expect(ids).toHaveLength(32);
  }
});

test('unknown fixture id is undefined', () => {
  expect(getUatFixture('nope')).toBeUndefined();
});

test('he-supreme puts 至尊 in 南', () => {
  const fixture = getUatFixture('he-supreme')!;
  expect(fixture.bankerSeat).toBe(0);
  expect(fixture.hands[0]).toContain(wuId([1, 2]));
  expect(fixture.hands[0]).toContain(wuId([2, 4]));
  expect(fixture.table.examples).toBe(false);
});

test('capture-on and unbeatable-wen share hands; only capture flag differs', () => {
  const on = getUatFixture('capture-on')!;
  const off = getUatFixture('unbeatable-wen')!;
  expect(on.hands).toEqual(off.hands);
  expect(on.hands[0]).toContain(wenId('lingren', 0));
  expect(on.hands[0]).toContain(wenId('lingren', 1));
  expect(on.hands[1]).toContain(wenId('gaojiao', 0));
  expect(on.hands[1]).toContain(wenId('gaojiao', 1));
  expect(on.table.captureWenHonor).not.toBe(false);
  expect(off.table.captureWenHonor).toBe(false);
});

test('example-yi-dian-hong opens the 例牌 window for 莊', () => {
  const fixture = getUatFixture('example-yi-dian-hong')!;
  const state = createHand({
    seed: fixture.seed,
    table: fixture.table,
    bankerSeat: fixture.bankerSeat,
    hands: fixture.hands,
  });
  expect(state.phase).toBe('example');
  expect(state.toAct).toBe(0);
  expect(findExamples(fixture.hands[0], fixture.table).map((item) => item.name)).toContain('一點紅');
  expect(findExamples(fixture.hands[1], fixture.table).map((item) => item.name)).toContain('一點紅');
});

test('example-quan-bai is 全白 including 天', () => {
  const fixture = getUatFixture('example-quan-bai')!;
  expect(fixture.hands[0]).toContain(wenId('tian', 0));
  expect(fixture.hands[0]).toContain(wenId('tian', 1));
  expect(findExamples(fixture.hands[0], fixture.table).map((item) => item.name)).toContain('全白');
  expect(fixture.hands[0].every((id) => getTile(id).red === 0)).toBe(true);
});

test('extra-si-dui-zi is 例牌 only with extraExamples', () => {
  const fixture = getUatFixture('extra-si-dui-zi')!;
  expect(findExamples(fixture.hands[0], { ...fixture.table, extraExamples: false })).toEqual([]);
  expect(findExamples(fixture.hands[0], { ...fixture.table, extraExamples: true }).map((item) => item.name)).toContain('四對子');
});

test('must-dump 東 holds 天; pair-last 東 holds 孖天', () => {
  const mustDump = getUatFixture('must-dump')!;
  const pairLast = getUatFixture('pair-last')!;
  expect(mustDump.hands[1]).toContain(wenId('tian', 0));
  expect(pairLast.hands[0]).toContain(wenId('bandeng', 0));
  expect(pairLast.hands[0]).toContain(wenId('bandeng', 1));
  expect(pairLast.hands[1]).toContain(wenId('tian', 0));
  expect(pairLast.hands[1]).toContain(wenId('tian', 1));
});
