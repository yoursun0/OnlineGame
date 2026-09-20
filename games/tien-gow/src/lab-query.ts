import { nextHandSeed } from './deal';
import { createHand, type State } from './reducer';
import { mergeTable, type Table } from './table';
import { getUatFixture } from './uat-fixtures';

export type LabCpuMode = 'auto' | 'dump';
export type LabPlayMode = 'live' | 'all';
export type LabDealKind = 'open' | 'rematch' | 'next';

export type LabQuery = {
  god: boolean;
  seed: string | null;
  banker: number | null;
  fixture: string | null;
  cpu: LabCpuMode;
  play: LabPlayMode;
  examples: boolean | null;
};

export type LabDealInput = {
  query: LabQuery;
  table: Table;
  currentSeed: string;
  kind: LabDealKind;
  chips?: number[];
  bankerSeat?: number;
  bankerStreak?: number;
};

export type LabDeal = {
  state: State;
  seed: string;
  error?: string;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseLabQuery(params: Record<string, string | string[] | undefined>): LabQuery {
  const seedRaw = firstParam(params.seed)?.trim();
  const fixtureRaw = firstParam(params.fixture)?.trim();
  const bankerRaw = firstParam(params.banker);
  const examplesRaw = firstParam(params.examples);
  return {
    god: firstParam(params.god) === '1',
    seed: seedRaw ? seedRaw : null,
    banker: bankerRaw && /^[0-3]$/.test(bankerRaw) ? Number(bankerRaw) : null,
    fixture: fixtureRaw ? fixtureRaw : null,
    cpu: firstParam(params.cpu) === 'dump' ? 'dump' : 'auto',
    play: firstParam(params.play) === 'all' ? 'all' : 'live',
    examples: examplesRaw === '1' ? true : examplesRaw === '0' ? false : null,
  };
}

export function initialLabTable(query: LabQuery): Table {
  const fixture = query.fixture ? getUatFixture(query.fixture) : undefined;
  const table = mergeTable(fixture?.table);
  if (query.examples !== null) table.examples = query.examples;
  return table;
}

export function initialLabSeed(query: LabQuery): string {
  if (query.fixture) return getUatFixture(query.fixture)?.seed ?? query.seed ?? 'lab';
  return query.seed ?? 'lab';
}

export function dealLabHand(input: LabDealInput): LabDeal {
  const { query, kind } = input;
  const fixture = query.fixture ? getUatFixture(query.fixture) : undefined;
  const error = query.fixture && !fixture ? `unknown fixture ${query.fixture}` : undefined;
  const pinned = Boolean(query.seed || fixture);
  const seed =
    kind === 'next' || (kind === 'rematch' && !pinned)
      ? nextHandSeed(input.currentSeed)
      : fixture?.seed ?? query.seed ?? input.currentSeed;
  const table = mergeTable({
    ...input.table,
    ...(query.examples === null ? {} : { examples: query.examples }),
  });
  const hands = kind !== 'next' && fixture ? fixture.hands : undefined;
  const bankerSeat =
    kind === 'next'
      ? input.bankerSeat
      : query.banker ?? fixture?.bankerSeat ?? (query.seed && !fixture ? undefined : 0);
  const chips = kind === 'next' && input.chips ? [...input.chips] : [100, 100, 100, 100];
  const bankerStreak = kind === 'next' ? input.bankerStreak ?? 1 : 1;
  const state = createHand({ seed, table, bankerSeat, hands, chips, bankerStreak });
  return error ? { state, seed, error } : { state, seed };
}
