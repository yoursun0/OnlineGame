import { mergeTable, type Table } from './table';
import { getTile, type TileId, type WuName } from './tiles';

export type ExampleName = '一點紅' | '七武' | '全白' | '八武' | '四對子' | '七星文士' | '八方文士';

export type ExamplePattern = {
  name: ExampleName;
  slam: 'seven' | 'eight';
};

const WU_PAIR_NAMES: ReadonlySet<WuName> = new Set(['jiu', 'ba', 'qi', 'wu']);

export function findExamples(hand: readonly TileId[], table: Partial<Table> = {}): ExamplePattern[] {
  const resolved = mergeTable(table);
  if (!resolved.examples) return [];
  const tiles = hand.map(getTile);
  const red = tiles.reduce((sum, tile) => sum + tile.red, 0);
  const wu = tiles.filter((tile) => tile.suit === 'wu').length;
  const wen = tiles.filter((tile) => tile.suit === 'wen').length;
  const found: ExamplePattern[] = [];
  if (red === 1) found.push({ name: '一點紅', slam: 'seven' });
  if (wu === 7) found.push({ name: '七武', slam: 'seven' });
  if (red === 0) found.push({ name: '全白', slam: 'eight' });
  if (wu === 8) found.push({ name: '八武', slam: 'eight' });
  if (resolved.extraExamples) {
    if (isFourPairs(hand)) found.push({ name: '四對子', slam: 'eight' });
    if (wen === 7) found.push({ name: '七星文士', slam: 'seven' });
    if (wen === 8) found.push({ name: '八方文士', slam: 'eight' });
  }
  return found;
}

export function bestExample(hand: readonly TileId[], table: Partial<Table> = {}): ExamplePattern | null {
  const found = findExamples(hand, table);
  if (found.length === 0) return null;
  return found.find((pattern) => pattern.slam === 'eight') ?? found[0];
}

function isFourPairs(hand: readonly TileId[]): boolean {
  if (hand.length !== 8) return false;
  const wenCounts = new Map<string, number>();
  const wuCounts = new Map<string, number>();
  for (const id of hand) {
    const tile = getTile(id);
    const map = tile.suit === 'wen' ? wenCounts : wuCounts;
    map.set(tile.name, (map.get(tile.name) ?? 0) + 1);
  }
  let pairs = 0;
  let used = 0;
  for (const count of wenCounts.values()) {
    if (count === 2) {
      pairs += 1;
      used += 2;
    } else return false;
  }
  for (const [name, count] of wuCounts) {
    if (count === 2 && WU_PAIR_NAMES.has(name as WuName)) {
      pairs += 1;
      used += 2;
    } else return false;
  }
  return pairs === 4 && used === 8;
}
