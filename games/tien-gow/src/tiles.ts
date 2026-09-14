export type Suit = 'wen' | 'wu';

export type WenName =
  | 'tian'
  | 'di'
  | 'ren'
  | 'he'
  | 'meihua'
  | 'changsan'
  | 'bandeng'
  | 'futou'
  | 'pingfeng'
  | 'gaojiao'
  | 'lingren';

export type WuName = 'jiu' | 'ba' | 'qi' | 'datou' | 'wu' | 'sanjie';

export type TileName = WenName | WuName;
export type TileId = string;

export type Tile = {
  id: TileId;
  suit: Suit;
  name: TileName;
  label: string;
  rank: number;
  pips: readonly [number, number];
  red: number;
};

const WEN: ReadonlyArray<{ name: WenName; label: string; pips: readonly [number, number]; rank: number }> = [
  { name: 'tian', label: '天', pips: [6, 6], rank: 1 },
  { name: 'di', label: '地', pips: [1, 1], rank: 2 },
  { name: 'ren', label: '人', pips: [4, 4], rank: 3 },
  { name: 'he', label: '和', pips: [1, 3], rank: 4 },
  { name: 'meihua', label: '梅花', pips: [5, 5], rank: 5 },
  { name: 'changsan', label: '長三', pips: [3, 3], rank: 6 },
  { name: 'bandeng', label: '板凳', pips: [2, 2], rank: 7 },
  { name: 'futou', label: '斧頭', pips: [5, 6], rank: 8 },
  { name: 'pingfeng', label: '紅頭十', pips: [4, 6], rank: 9 },
  { name: 'gaojiao', label: '高腳七', pips: [1, 6], rank: 10 },
  { name: 'lingren', label: '伶冧六', pips: [1, 5], rank: 11 },
];

const WU: ReadonlyArray<{ name: WuName; label: string; pips: readonly [number, number]; rank: number }> = [
  { name: 'jiu', label: '九', pips: [3, 6], rank: 1 },
  { name: 'jiu', label: '九', pips: [4, 5], rank: 1 },
  { name: 'ba', label: '八', pips: [3, 5], rank: 2 },
  { name: 'ba', label: '八', pips: [2, 6], rank: 2 },
  { name: 'qi', label: '七', pips: [3, 4], rank: 3 },
  { name: 'qi', label: '七', pips: [2, 5], rank: 3 },
  { name: 'datou', label: '大頭六', pips: [2, 4], rank: 4 },
  { name: 'wu', label: '五', pips: [2, 3], rank: 5 },
  { name: 'wu', label: '五', pips: [1, 4], rank: 5 },
  { name: 'sanjie', label: '么三', pips: [1, 2], rank: 6 },
];

export function redPips(pips: readonly [number, number]): number {
  return Number(isRedPip(pips[0])) + Number(isRedPip(pips[1]));
}

export function isRedPip(pip: number): boolean {
  return pip === 1 || pip === 4;
}

/** Paint color for one pip. 天's sixes have two red centre pips; 例牌 red-count still uses `isRedPip`. */
export function isPipPaintRed(tile: Tile, face: 0 | 1, pipIndex: number): boolean {
  const value = tile.pips[face];
  if (tile.name === 'tian' && value === 6) return pipIndex === 2 || pipIndex === 3;
  return isRedPip(value);
}

export function wenId(name: WenName, copy: 0 | 1): TileId {
  return `wen:${name}:${copy}`;
}

export function wuId(pips: readonly [number, number]): TileId {
  return `wu:${pips[0]}-${pips[1]}`;
}

function makeWen(name: WenName, copy: 0 | 1): Tile {
  const spec = WEN.find((row) => row.name === name);
  if (!spec) throw new Error(`Unknown 文子 ${name}`);
  return {
    id: wenId(name, copy),
    suit: 'wen',
    name,
    label: spec.label,
    rank: spec.rank,
    pips: spec.pips,
    red: redPips(spec.pips),
  };
}

function makeWu(spec: (typeof WU)[number]): Tile {
  return {
    id: wuId(spec.pips),
    suit: 'wu',
    name: spec.name,
    label: spec.label,
    rank: spec.rank,
    pips: spec.pips,
    red: redPips(spec.pips),
  };
}

export const DECK: readonly Tile[] = [
  ...WEN.flatMap((row) => [makeWen(row.name, 0), makeWen(row.name, 1)]),
  ...WU.map(makeWu),
];

export const TILE_BY_ID: Readonly<Record<TileId, Tile>> = Object.fromEntries(DECK.map((tile) => [tile.id, tile]));

export function getTile(id: TileId): Tile {
  const tile = TILE_BY_ID[id];
  if (!tile) throw new Error(`Unknown tile ${id}`);
  return tile;
}

export function wenTiles(name: WenName): Tile[] {
  return [getTile(wenId(name, 0)), getTile(wenId(name, 1))];
}

export function wuTiles(name: WuName): Tile[] {
  return DECK.filter((tile) => tile.suit === 'wu' && tile.name === name);
}

export function sortTileIds(ids: readonly TileId[]): TileId[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

/** Display order: 文子 then 武子, each high to low (天…伶冧六, 九…么三). */
export function sortHandDisplay(ids: readonly TileId[]): TileId[] {
  return [...ids].sort((left, right) => {
    const a = getTile(left);
    const b = getTile(right);
    if (a.suit !== b.suit) return a.suit === 'wen' ? -1 : 1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.id.localeCompare(b.id);
  });
}
