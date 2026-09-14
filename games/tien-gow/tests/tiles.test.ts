import { expect, test } from 'bun:test';
import { DECK, getTile, isPipPaintRed, redPips, sortHandDisplay, wenId, wenTiles, wuId, wuTiles } from '../src/tiles';

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

test('sortHandDisplay is 文 then 武, each high to low', () => {
  const ids = [
    wuId([1, 2]),
    wenId('lingren', 0),
    wenId('tian', 1),
    wuId([3, 6]),
    wenId('di', 0),
    wuId([2, 3]),
  ];
  expect(sortHandDisplay(ids).map((id) => getTile(id).label)).toEqual(['天', '地', '伶冧六', '九', '五', '么三']);
});

test('display names follow 紅頭十 / 么三', () => {
  expect(getTile(wenId('pingfeng', 0)).label).toBe('紅頭十');
  expect(getTile(wuId([1, 2])).label).toBe('么三');
});

test('天 sixes paint two centre pips red without counting as 例牌 red', () => {
  const tian = getTile(wenId('tian', 0));
  expect(tian.red).toBe(0);
  expect([0, 1, 2, 3, 4, 5].map((index) => isPipPaintRed(tian, 0, index))).toEqual([false, false, true, true, false, false]);
  const axeSix = getTile(wenId('futou', 0));
  expect(axeSix.pips[1]).toBe(6);
  expect([0, 1, 2, 3, 4, 5].some((index) => isPipPaintRed(axeSix, 1, index))).toBe(false);
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
