import { mergeTable, type Table } from './table';
import { getTile, sortTileIds, type Tile, type TileId, type WenName, type WuName } from './tiles';

export type ComboClass =
  | 'singleWen'
  | 'singleWu'
  | 'wenPair'
  | 'wuPair'
  | 'mixedPair'
  | 'tripleWen'
  | 'tripleWu'
  | 'quad'
  | 'supreme'
  | 'wenHonor';

export type Family = 'tianjiu' | 'diba' | 'renqi' | 'hewu';

export type Combo = {
  class: ComboClass;
  rank: number;
  tiles: TileId[];
  label: string;
  family?: Family;
};

export const CLASS_LABEL: Record<ComboClass, string> = {
  singleWen: '單文',
  singleWu: '單武',
  wenPair: '文對',
  wuPair: '武對',
  mixedPair: '文武對',
  tripleWen: '三文',
  tripleWu: '三武',
  quad: '四文武',
  supreme: '至尊',
  wenHonor: '文尊',
};

const FAMILY_SPEC: ReadonlyArray<{ family: Family; wen: WenName; wu: WuName; rank: number; label: string }> = [
  { family: 'tianjiu', wen: 'tian', wu: 'jiu', rank: 1, label: '天九' },
  { family: 'diba', wen: 'di', wu: 'ba', rank: 2, label: '地八' },
  { family: 'renqi', wen: 'ren', wu: 'qi', rank: 3, label: '人七' },
  { family: 'hewu', wen: 'he', wu: 'wu', rank: 4, label: '和五' },
];

const WU_PAIR_NAMES: ReadonlySet<WuName> = new Set(['jiu', 'ba', 'qi', 'wu']);

export function familyOf(wen: WenName, wu: WuName): (typeof FAMILY_SPEC)[number] | undefined {
  return FAMILY_SPEC.find((row) => row.wen === wen && row.wu === wu);
}

export function identifyCombo(tiles: readonly TileId[], table: Partial<Table> = {}): Combo | null {
  const resolved = mergeTable(table);
  const unique = sortTileIds(tiles);
  if (unique.length !== tiles.length) return null;
  const resolvedTiles = unique.map(getTile);
  if (resolvedTiles.length === 1) return identifySingle(resolvedTiles[0]);
  if (resolvedTiles.length === 2) return identifyPair(resolvedTiles, resolved);
  if (resolvedTiles.length === 3) return identifyTriple(resolvedTiles);
  if (resolvedTiles.length === 4) return identifyQuad(resolvedTiles);
  return null;
}

function identifySingle(tile: Tile): Combo {
  return {
    class: tile.suit === 'wen' ? 'singleWen' : 'singleWu',
    rank: tile.rank,
    tiles: [tile.id],
    label: `${tile.suit === 'wen' ? '單文' : '單武'} ${tile.label}`,
  };
}

function identifyPair(tiles: Tile[], table: Table): Combo | null {
  const [a, b] = tiles;
  if (isSupreme(tiles)) {
    return { class: 'supreme', rank: 1, tiles: sortTileIds(tiles.map((tile) => tile.id)), label: '至尊' };
  }
  if (a.suit === 'wen' && b.suit === 'wen' && a.name === b.name) {
    if (table.wenHonor && a.name === 'lingren') {
      return { class: 'wenHonor', rank: 1, tiles: sortTileIds(tiles.map((tile) => tile.id)), label: '文尊' };
    }
    return {
      class: 'wenPair',
      rank: a.rank,
      tiles: sortTileIds(tiles.map((tile) => tile.id)),
      label: `文對 ${a.label}`,
    };
  }
  if (a.suit === 'wu' && b.suit === 'wu' && a.name === b.name && WU_PAIR_NAMES.has(a.name as WuName)) {
    return {
      class: 'wuPair',
      rank: a.rank,
      tiles: sortTileIds(tiles.map((tile) => tile.id)),
      label: `武對 雜${a.label}`,
    };
  }
  const wen = tiles.find((tile) => tile.suit === 'wen');
  const wu = tiles.find((tile) => tile.suit === 'wu');
  if (!wen || !wu) return null;
  const family = familyOf(wen.name as WenName, wu.name as WuName);
  if (!family) return null;
  return {
    class: 'mixedPair',
    rank: family.rank,
    tiles: sortTileIds(tiles.map((tile) => tile.id)),
    label: `文武對 ${family.label}`,
    family: family.family,
  };
}

function identifyTriple(tiles: Tile[]): Combo | null {
  const wen = tiles.filter((tile) => tile.suit === 'wen');
  const wu = tiles.filter((tile) => tile.suit === 'wu');
  if (wen.length === 2 && wu.length === 1 && wen[0].name === wen[1].name) {
    const family = familyOf(wen[0].name as WenName, wu[0].name as WuName);
    if (!family) return null;
    return {
      class: 'tripleWen',
      rank: family.rank,
      tiles: sortTileIds(tiles.map((tile) => tile.id)),
      label: `三文 ${family.label}`,
      family: family.family,
    };
  }
  if (wu.length === 2 && wen.length === 1 && wu[0].name === wu[1].name && WU_PAIR_NAMES.has(wu[0].name as WuName)) {
    const family = familyOf(wen[0].name as WenName, wu[0].name as WuName);
    if (!family) return null;
    return {
      class: 'tripleWu',
      rank: family.rank,
      tiles: sortTileIds(tiles.map((tile) => tile.id)),
      label: `三武 ${family.label}`,
      family: family.family,
    };
  }
  return null;
}

function identifyQuad(tiles: Tile[]): Combo | null {
  const wen = tiles.filter((tile) => tile.suit === 'wen');
  const wu = tiles.filter((tile) => tile.suit === 'wu');
  if (wen.length !== 2 || wu.length !== 2) return null;
  if (wen[0].name !== wen[1].name) return null;
  if (wu[0].name !== wu[1].name || !WU_PAIR_NAMES.has(wu[0].name as WuName)) return null;
  const family = familyOf(wen[0].name as WenName, wu[0].name as WuName);
  if (!family) return null;
  return {
    class: 'quad',
    rank: family.rank,
    tiles: sortTileIds(tiles.map((tile) => tile.id)),
    label: `四文武 ${family.label}`,
    family: family.family,
  };
}

function isSupreme(tiles: Tile[]): boolean {
  const names = new Set(tiles.map((tile) => tile.name));
  return names.has('sanjie') && names.has('datou') && tiles.length === 2;
}

export function isGaojiaoPair(combo: Combo): boolean {
  if (combo.class !== 'wenPair' || combo.tiles.length !== 2) return false;
  return combo.tiles.every((id) => getTile(id).name === 'gaojiao');
}

export function comboBeats(challenger: Combo, current: Combo, table: Partial<Table> = {}): boolean {
  const resolved = mergeTable(table);
  if (current.class === 'supreme') return false;
  if (current.class === 'wenHonor') {
    return Boolean(resolved.wenHonor && resolved.captureWenHonor && isGaojiaoPair(challenger));
  }
  if (challenger.class !== current.class) return false;
  return challenger.rank < current.rank;
}

export function enumerateCombos(hand: readonly TileId[], table: Partial<Table> = {}): Combo[] {
  const resolved = mergeTable(table);
  const combos: Combo[] = [];
  const seen = new Set<string>();
  for (let size = 1; size <= 4; size += 1) {
    for (const subset of subsets(hand, size)) {
      const combo = identifyCombo(subset, resolved);
      if (!combo) continue;
      const key = `${combo.class}:${combo.tiles.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combos.push(combo);
    }
  }
  return combos;
}

function subsets(items: readonly TileId[], size: number): TileId[][] {
  const out: TileId[][] = [];
  const walk = (start: number, acc: TileId[]) => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      acc.push(items[index]);
      walk(index + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}
