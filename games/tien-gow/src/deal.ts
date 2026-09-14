import { DECK, type TileId } from './tiles';

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed));
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function dealHands(seed: string): TileId[][] {
  const ids = shuffle(DECK.map((tile) => tile.id), seed);
  return [0, 1, 2, 3].map((seat) => ids.slice(seat * 8, seat * 8 + 8));
}

export function randomBankerSeat(seed: string): number {
  return hashSeed(`banker:${seed}`) % 4;
}
