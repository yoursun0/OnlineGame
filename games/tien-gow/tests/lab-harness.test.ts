import { expect, test } from 'bun:test';
import { dumpFollowMove, nextCpuMove } from '../src/cpu';
import { nextHandSeed } from '../src/deal';
import { dealLabHand, parseLabQuery } from '../src/lab-query';
import { createHand, listLegalMoves } from '../src/reducer';
import { DEFAULT_TABLE } from '../src/table';
import { wenId } from '../src/tiles';
import { getUatFixture } from '../src/uat-fixtures';
import { lead } from './helpers';

test('parseLabQuery defaults', () => {
  expect(parseLabQuery({})).toEqual({
    god: false,
    seed: null,
    banker: null,
    fixture: null,
    cpu: 'auto',
    play: 'live',
    examples: null,
  });
});

test('parseLabQuery reads the lab URL contract', () => {
  expect(
    parseLabQuery({
      god: '1',
      seed: 'uat-3',
      banker: '0',
      fixture: 'he-supreme',
      cpu: 'dump',
      play: 'all',
      examples: '0',
    }),
  ).toEqual({
    god: true,
    seed: 'uat-3',
    banker: 0,
    fixture: 'he-supreme',
    cpu: 'dump',
    play: 'all',
    examples: false,
  });
  expect(parseLabQuery({ banker: '9', examples: '1', god: 'true' })).toEqual({
    god: false,
    seed: null,
    banker: null,
    fixture: null,
    cpu: 'auto',
    play: 'live',
    examples: true,
  });
});

test('nextHandSeed is derived from the previous seed, not the clock', () => {
  expect(nextHandSeed('uat-3')).toBe('uat-3:hand-1');
  expect(nextHandSeed('uat-3:hand-1')).toBe('uat-3:hand-2');
  expect(nextHandSeed(nextHandSeed('lab'))).toBe('lab:hand-2');
});

test('dumpFollowMove 墊 even when a beat exists', () => {
  const fixture = getUatFixture('capture-on')!;
  const led = lead(
    createHand({ seed: fixture.seed, table: fixture.table, bankerSeat: 0, hands: fixture.hands }),
    [wenId('lingren', 0), wenId('lingren', 1)],
  );
  expect(nextCpuMove(led, 1)?.type).toBe('beat');
  const dump = dumpFollowMove(led, 1);
  expect(dump?.type).toBe('dump');
  expect(dump && dump.type === 'dump').toBe(true);
  if (!dump || dump.type !== 'dump') throw new Error('expected dump');
  expect(listLegalMoves(led, 1).some((move) => move.type === 'dump' && move.tiles.join(',') === dump.tiles.join(','))).toBe(true);
});

test('dealLabHand loads a named fixture and ignores seed for hands', () => {
  const query = parseLabQuery({ fixture: 'he-supreme', seed: 'uat-3', god: '1' });
  const dealt = dealLabHand({
    query,
    table: DEFAULT_TABLE,
    currentSeed: 'lab',
    kind: 'open',
  });
  const fixture = getUatFixture('he-supreme')!;
  expect(dealt.error).toBeUndefined();
  expect(dealt.seed).toBe('he-supreme');
  expect(dealt.state.hands).toEqual(fixture.hands);
  expect(dealt.state.bankerSeat).toBe(0);
  expect(dealt.state.chips).toEqual([100, 100, 100, 100]);
});

test('dealLabHand pins seed and banker from the query', () => {
  const query = parseLabQuery({ seed: 'uat-3', banker: '0' });
  const first = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: 'lab', kind: 'open' });
  const again = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: first.seed, kind: 'rematch' });
  expect(first.state.hands).toEqual(again.state.hands);
  expect(first.state.bankerSeat).toBe(0);
  expect(again.state.chips).toEqual([100, 100, 100, 100]);
});

test('dealLabHand without banker uses the seed banker', () => {
  const query = parseLabQuery({ seed: 'uat-3775' });
  const dealt = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: 'lab', kind: 'open' });
  expect(dealt.state.bankerSeat).toBe(1);
});

test('dealLabHand next hand shuffles from the previous seed and drops fixture hands', () => {
  const query = parseLabQuery({ fixture: 'he-supreme' });
  const first = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: 'lab', kind: 'open' });
  const next = dealLabHand({
    query,
    table: DEFAULT_TABLE,
    currentSeed: first.seed,
    kind: 'next',
    chips: [112, 96, 96, 96],
    bankerSeat: 0,
    bankerStreak: 2,
  });
  expect(next.seed).toBe('he-supreme:hand-1');
  expect(next.state.hands).not.toEqual(first.state.hands);
  expect(next.state.chips).toEqual([112, 96, 96, 96]);
  expect(next.state.bankerSeat).toBe(0);
  expect(next.state.bankerStreak).toBe(2);
});

test('unpinned rematch advances the seed; first open uses lab', () => {
  const query = parseLabQuery({});
  const first = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: 'lab', kind: 'open' });
  const rematch = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: first.seed, kind: 'rematch' });
  expect(first.seed).toBe('lab');
  expect(rematch.seed).toBe('lab:hand-1');
  expect(first.state.hands).not.toEqual(rematch.state.hands);
  expect(first.state.bankerSeat).toBe(0);
});

test('examples=0 overrides the table before deal', () => {
  const query = parseLabQuery({ examples: '0', seed: 'lab' });
  const table = { ...DEFAULT_TABLE, examples: true };
  const dealt = dealLabHand({ query, table, currentSeed: 'lab', kind: 'open' });
  expect(dealt.state.table.examples).toBe(false);
});

test('unknown fixture records an error and still deals', () => {
  const query = parseLabQuery({ fixture: 'nope', seed: 'uat-3', banker: '0' });
  const dealt = dealLabHand({ query, table: DEFAULT_TABLE, currentSeed: 'lab', kind: 'open' });
  expect(dealt.error).toContain('nope');
  expect(dealt.state.hands.flat()).toHaveLength(32);
});
