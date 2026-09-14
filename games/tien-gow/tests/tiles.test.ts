import { expect, test } from 'bun:test';
import { DECK, getTile, redPips, wenId, wenTiles, wuId, wuTiles } from '../src/tiles';

test('deck has 32 unique identities', () => {
  expect(DECK).toHaveLength(32);
  expect(new Set(DECK.map((tile) => tile.id)).size).toBe(32);
  expect(DECK.filter((tile) => tile.suit === 'wen')).toHaveLength(22);
  expect(DECK.filter((tile) => tile.suit === 'wu')).toHaveLength(10);
});

test('文子 ranks 天 high to 伶冧六 low', () => {
  const order = ['tian', 'di', 'ren', 'he', 'meihua', 'changsan', 'bandeng', 'futou', 'pingfeng', 'gaojiao', 'lingren'] as const;
  order.forEach((name, index) => {
    const tiles = wenTiles(name);
    expect(tiles).toHaveLength(2);
    expect(tiles[0].rank).toBe(index + 1);
    expect(tiles[1].rank).toBe(index + 1);
  });
});

test('武子 ranks by pip total', () => {
  expect(wuTiles('jiu').map((tile) => tile.rank)).toEqual([1, 1]);
  expect(wuTiles('ba').map((tile) => tile.rank)).toEqual([2, 2]);
  expect(wuTiles('qi').map((tile) => tile.rank)).toEqual([3, 3]);
  expect(wuTiles('datou')[0].rank).toBe(4);
  expect(wuTiles('wu').map((tile) => tile.rank)).toEqual([5, 5]);
  expect(wuTiles('sanjie')[0].rank).toBe(6);
});

test('red pip counts follow 1 and 4', () => {
  const expected: Array<[string, number]> = [
    [wenId('tian', 0), 0],
    [wenId('di', 0), 2],
    [wenId('ren', 0), 2],
    [wenId('he', 0), 1],
    [wenId('meihua', 0), 0],
    [wenId('changsan', 0), 0],
    [wenId('bandeng', 0), 0],
    [wenId('futou', 0), 0],
    [wenId('pingfeng', 0), 1],
    [wenId('gaojiao', 0), 1],
    [wenId('lingren', 0), 1],
    [wuId([3, 6]), 0],
    [wuId([4, 5]), 1],
    [wuId([3, 5]), 0],
    [wuId([2, 6]), 0],
    [wuId([3, 4]), 1],
    [wuId([2, 5]), 0],
    [wuId([2, 4]), 1],
    [wuId([2, 3]), 0],
    [wuId([1, 4]), 2],
    [wuId([1, 2]), 1],
  ];
  for (const [id, red] of expected) {
    const tile = getTile(id);
    expect(tile.red).toBe(red);
    expect(redPips(tile.pips)).toBe(red);
  }
});
