import { expect, test } from 'bun:test';
import {
  catAndDog,
  cpuPower,
  createPlayingState,
  createRematchState,
  drawWind,
  landThrow,
  nextCpuMove,
  type CatAndDogState,
  type Item,
  type Side,
} from '@playroom/cat-and-dog';

function playing(input: {
  toAct?: Side;
  wind?: number;
  meters?: { cat: number; dog: number };
  difficulty?: CatAndDogState['difficulty'];
  windDraws?: number;
}): CatAndDogState {
  return {
    kind: 'cat-and-dog',
    phase: 'playing',
    roomCode: 'CAD-7KQ',
    difficulty: input.difficulty === undefined ? null : input.difficulty,
    toAct: input.toAct ?? 'dog',
    wind: input.wind ?? 0,
    windDraws: input.windDraws ?? 1,
    meters: input.meters ?? { cat: 1, dog: 1 },
    winner: null,
    last: null,
  };
}

function throwAs(state: CatAndDogState, item: Item, power: number) {
  const seat = state.toAct === 'cat' ? 0 : 1;
  const move = { type: 'throw' as const, item, power };
  expect(catAndDog.validateMove(state, move, { id: 'p', seat }).ok).toBe(true);
  return catAndDog.applyMove(state, move, { id: 'p', seat });
}

test('a new game starts with Dog to act and both meters on frame 1', () => {
  const state = createPlayingState({ roomCode: 'CAD-7KQ', difficulty: null });
  expect(state.toAct).toBe('dog');
  expect(state.meters).toEqual({ cat: 1, dog: 1 });
  expect(state.windDraws).toBe(1);
  expect([0, -7, -6, -5, -4, -3, -2, -1, 7, 6, 5, 4, 3, 2]).toContain(state.wind);
});

test('the same room code and draw index always draw the same wind, and full wind never includes 1', () => {
  const first = drawWind('CAD-7KQ', 0, 'full');
  expect(drawWind('CAD-7KQ', 0, 'full')).toBe(first);
  for (let index = 0; index < 40; index += 1) {
    const full = drawWind('CAD-7KQ', index, 'full');
    expect([0, -7, -6, -5, -4, -3, -2, -1, 7, 6, 5, 4, 3, 2]).toContain(full);
    expect(full).not.toBe(1);
    expect([0, 1, -1]).toContain(drawWind('CAD-7KQ', index, 'expert'));
  }
});

test('Dog landing rows match the rules table', () => {
  expect(landThrow('dog', 1, 'none')).toMatchObject({ hit: false, gap: false, reaction: 1, add: 0 });
  expect(landThrow('dog', 9, 'none')).toMatchObject({ hit: false, reaction: 1, add: 0 });
  expect(landThrow('dog', 10, 'none')).toMatchObject({ hit: false, gap: true, reaction: 1, add: 0 });
  expect(landThrow('dog', 17, 'none')).toMatchObject({ hit: false, reaction: 1, add: 0 });
  expect(landThrow('dog', 18, 'none')).toMatchObject({ hit: true, reaction: 2, add: 2 });
  expect(landThrow('dog', 19, 'none')).toMatchObject({ hit: true, reaction: 2, add: 3 });
  expect(landThrow('dog', 20, 'none')).toMatchObject({ hit: true, reaction: 3, add: 5 });
  expect(landThrow('dog', 20, 'powerThrow')).toMatchObject({ hit: true, reaction: 3, add: 9 });
  expect(landThrow('dog', 21, 'none')).toMatchObject({ hit: true, reaction: 2, add: 2 });
  expect(landThrow('dog', 21, 'powerThrow')).toMatchObject({ add: 3 });
  expect(landThrow('dog', 22, 'none')).toMatchObject({ hit: true, reaction: 4, add: 3 });
  expect(landThrow('dog', 22, 'powerThrow')).toMatchObject({ add: 4 });
  expect(landThrow('dog', 30, 'none')).toMatchObject({ hit: false, reaction: 1, add: 0 });
  expect(landThrow('dog', 31, 'none')).toMatchObject({ hit: false, gap: true, reaction: 1, add: 0 });
  expect(landThrow('dog', 0, 'none')).toMatchObject({ qq: 0, hit: false, gap: false, reaction: 1, add: 0 });
  expect(landThrow('dog', 40, 'none')).toMatchObject({ qq: 40, hit: false, gap: false, reaction: 1, add: 0 });
  expect(landThrow('dog', 20, 'stinkBomb')).toMatchObject({ hit: true, add: 5, projectile: 'stink' });
});

test('Cat landing rows match the rules table', () => {
  expect(landThrow('cat', 13, 'none')).toMatchObject({ hit: false, reaction: 1, add: 0 });
  expect(landThrow('cat', 14, 'none')).toMatchObject({ hit: false, gap: true, reaction: 1, add: 0 });
  expect(landThrow('cat', 16, 'none')).toMatchObject({ hit: false, reaction: 1, add: 0 });
  expect(landThrow('cat', 17, 'none')).toMatchObject({ hit: true, reaction: 3, add: 1 });
  expect(landThrow('cat', 17, 'powerThrow')).toMatchObject({ add: 2 });
  expect(landThrow('cat', 18, 'none')).toMatchObject({ hit: false, gap: true, reaction: 1, add: 0 });
  expect(landThrow('cat', 19, 'none')).toMatchObject({ hit: true, reaction: 3, add: 2 });
  expect(landThrow('cat', 19, 'powerThrow')).toMatchObject({ add: 3 });
  expect(landThrow('cat', 20, 'none')).toMatchObject({ hit: true, reaction: 2, add: 6 });
  expect(landThrow('cat', 20, 'powerThrow')).toMatchObject({ add: 9 });
  expect(landThrow('cat', 21, 'none')).toMatchObject({ hit: true, reaction: 3, add: 2 });
  expect(landThrow('cat', 21, 'powerThrow')).toMatchObject({ add: 4 });
  expect(landThrow('cat', 22, 'none')).toMatchObject({ hit: true, reaction: 4, add: 2 });
  expect(landThrow('cat', 22, 'powerThrow')).toMatchObject({ add: 3 });
  expect(landThrow('cat', 24, 'none')).toMatchObject({ hit: false, reaction: 1, add: 0 });
  expect(landThrow('cat', 25, 'none')).toMatchObject({ gap: true, hit: false, add: 0 });
  expect(landThrow('cat', 30, 'none')).toMatchObject({ hit: false, add: 0 });
  expect(landThrow('cat', 31, 'none')).toMatchObject({ gap: true, hit: false, add: 0 });
  expect(landThrow('cat', -4, 'none')).toMatchObject({ hit: false, gap: false, reaction: 1, add: 0 });
  expect(landThrow('cat', 32, 'none')).toMatchObject({ hit: false, gap: false, reaction: 1, add: 0 });
});

test('Dog throws at Cat using power minus wind, then Cat acts', () => {
  const state = throwAs(playing({ toAct: 'dog', wind: -2 }), 'none', 20);
  expect(state.last?.landings[0]).toMatchObject({ qq: 22, hit: true, reaction: 4, add: 3 });
  expect(state.meters.cat).toBe(4);
  expect(state.meters.dog).toBe(1);
  expect(state.toAct).toBe('cat');
  expect(state.windDraws).toBe(2);
  expect(catAndDog.getStatus(state)).toBe('playing');
});

test('Cat throws at Dog using power plus wind', () => {
  const state = throwAs(playing({ toAct: 'cat', wind: -1 }), 'none', 21);
  expect(state.last?.landings[0]).toMatchObject({ qq: 20, hit: true, reaction: 2, add: 6 });
  expect(state.meters.dog).toBe(7);
  expect(state.toAct).toBe('dog');
});

test('a stink bomb uses the normal add', () => {
  const state = throwAs(playing({ wind: 0 }), 'stinkBomb', 20);
  expect(state.meters.cat).toBe(6);
  expect(state.last?.landings[0]?.projectile).toBe('stink');
});

test('a double attack repeats the same power and wind, and stops when the first landing wins', () => {
  const both = throwAs(playing({ wind: 0, meters: { cat: 1, dog: 1 } }), 'doubleAttack', 20);
  expect(both.last?.landings).toHaveLength(2);
  expect(both.last?.landings[0]?.qq).toBe(both.last?.landings[1]?.qq);
  expect(both.meters.cat).toBe(11);
  expect(both.windDraws).toBe(2);

  const winning = throwAs(playing({ wind: 0, meters: { cat: 20, dog: 1 } }), 'doubleAttack', 20);
  expect(winning.last?.landings).toHaveLength(1);
  expect(winning.meters.cat).toBe(25);
  expect(winning.winner).toBe('dog');
  expect(catAndDog.getStatus(winning)).toBe('won');
  expect(winning.toAct).toBe('dog');
});

test('a filled Cat meter means Dog wins, and a filled Dog meter means Cat wins', () => {
  const dogWins = throwAs(playing({ toAct: 'dog', wind: 0, meters: { cat: 21, dog: 1 } }), 'none', 18);
  expect(dogWins.meters.cat).toBe(23);
  expect(dogWins.winner).toBe('dog');

  const catWins = throwAs(playing({ toAct: 'cat', wind: 0, meters: { cat: 1, dog: 17 } }), 'none', 20);
  expect(catWins.meters.dog).toBe(23);
  expect(catWins.winner).toBe('cat');
});

test('warning frames do not end the game', () => {
  const state = throwAs(playing({ wind: 0, meters: { cat: 12, dog: 1 } }), 'none', 20);
  expect(state.meters.cat).toBe(17);
  expect(state.winner).toBeNull();
  expect(catAndDog.getStatus(state)).toBe('playing');
});

test('power up spends the turn and floors the acting meter at frame 1', () => {
  const low = playing({ toAct: 'dog', meters: { cat: 8, dog: 4 } });
  expect(catAndDog.validateMove(low, { type: 'powerUp' }, { id: 'p', seat: 1 }).ok).toBe(true);
  const spent = catAndDog.applyMove(low, { type: 'powerUp' }, { id: 'p', seat: 1 });
  expect(spent.meters).toEqual({ cat: 8, dog: 1 });
  expect(spent.toAct).toBe('cat');
  expect(spent.last?.kind).toBe('powerUp');
  expect(spent.winner).toBeNull();
});

test('the other guest cannot throw, and power outside 1 through 33 is rejected', () => {
  const state = playing({ toAct: 'dog' });
  expect(catAndDog.validateMove(state, { type: 'throw', item: 'none', power: 20 }, { id: 'p', seat: 0 })).toEqual({
    ok: false,
    reason: 'It is not this player’s turn.',
  });
  expect(catAndDog.validateMove(state, { type: 'throw', item: 'none', power: 0 }, { id: 'p', seat: 1 })).toEqual({
    ok: false,
    reason: 'Power must be an integer from 1 through 33.',
  });
  expect(catAndDog.validateMove(state, { type: 'throw', item: 'none', power: 34 }, { id: 'p', seat: 1 }).ok).toBe(false);
  const won = { ...state, phase: 'won' as const, winner: 'cat' as const };
  expect(catAndDog.validateMove(won, { type: 'throw', item: 'none', power: 20 }, { id: 'p', seat: 1 }).ok).toBe(false);
});

test('the solo CPU throws a fixed power and never an item', () => {
  expect(cpuPower('level1')).toBe(21);
  expect(cpuPower('level2')).toBe(22);
  expect(cpuPower('expert')).toBe(20);
  const state = playing({ toAct: 'dog', difficulty: 'level2' });
  expect(nextCpuMove(state, [{ seat: 1, is_cpu: true }, { seat: 0, is_cpu: false }])).toEqual({
    type: 'throw',
    item: 'none',
    power: 22,
  });
  expect(nextCpuMove(state, [{ seat: 0, is_cpu: true }])).toBeNull();
  expect(nextCpuMove(playing({ difficulty: null }), [{ seat: 1, is_cpu: true }])).toBeNull();
});

test('expert wind is only the mild table, and a rematch keeps difficulty and seats-side order', () => {
  const started = createPlayingState({ roomCode: 'CAD-7KQ', difficulty: 'expert' });
  expect([0, 1, -1]).toContain(started.wind);
  const finished = { ...started, phase: 'won' as const, winner: 'cat' as const, meters: { cat: 4, dog: 23 } };
  const again = createRematchState(finished);
  expect(again.difficulty).toBe('expert');
  expect(again.roomCode).toBe('CAD-7KQ');
  expect(again.toAct).toBe('dog');
  expect(again.meters).toEqual({ cat: 1, dog: 1 });
  expect(again.winner).toBeNull();
});
