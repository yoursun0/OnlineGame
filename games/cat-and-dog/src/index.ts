import type { GameAdapter, Guest } from '@playroom/game-core';

export const CAT_AND_DOG_SLUG = 'cat-and-dog';

export type Side = 'cat' | 'dog';
export type Item = 'none' | 'doubleAttack' | 'powerThrow' | 'stinkBomb';
export type Difficulty = 'level1' | 'level2' | 'expert';
export type Reaction = 1 | 2 | 3 | 4;
export type WindTable = 'full' | 'expert';

export type Landing = {
  qq: number;
  hit: boolean;
  gap: boolean;
  reaction: Reaction;
  add: number;
  projectile: 'plain' | 'stink';
};

export type ResolvedThrow = {
  kind: 'throw' | 'powerUp';
  side: Side;
  item: Item | null;
  power: number | null;
  wind: number;
  landings: Landing[];
  meters: { cat: number; dog: number };
  winner: Side | null;
};

export type CatAndDogState = {
  kind: 'cat-and-dog';
  phase: 'playing' | 'won';
  roomCode: string;
  difficulty: Difficulty | null;
  toAct: Side;
  wind: number;
  windDraws: number;
  meters: { cat: number; dog: number };
  winner: Side | null;
  last: ResolvedThrow | null;
};

export type CatAndDogLobbyState = {
  kind: 'cat-and-dog';
  phase: 'lobby';
};

export type CatAndDogMove =
  | { type: 'throw'; item: Item; power: number }
  | { type: 'powerUp' };

const FULL_WIND = [0, -7, -6, -5, -4, -3, -2, -1, 7, 6, 5, 4, 3, 2] as const;
const EXPERT_WIND = [0, 1, -1] as const;
const ITEMS: readonly Item[] = ['none', 'doubleAttack', 'powerThrow', 'stinkBomb'];
const GIVE_UP_FRAME = 23;
const METER_FLOOR = 1;

type Row = {
  min: number;
  max: number;
  gap?: boolean;
  hit: boolean;
  reaction: Reaction;
  add: number;
  powerAdd?: number;
};

const DOG_ROWS: readonly Row[] = [
  { min: 1, max: 9, hit: false, reaction: 1, add: 0 },
  { min: 10, max: 10, gap: true, hit: false, reaction: 1, add: 0 },
  { min: 11, max: 17, hit: false, reaction: 1, add: 0 },
  { min: 18, max: 18, hit: true, reaction: 2, add: 2 },
  { min: 19, max: 19, hit: true, reaction: 2, add: 3 },
  { min: 20, max: 20, hit: true, reaction: 3, add: 5, powerAdd: 9 },
  { min: 21, max: 21, hit: true, reaction: 2, add: 2, powerAdd: 3 },
  { min: 22, max: 22, hit: true, reaction: 4, add: 3, powerAdd: 4 },
  { min: 23, max: 30, hit: false, reaction: 1, add: 0 },
  { min: 31, max: 31, gap: true, hit: false, reaction: 1, add: 0 },
  { min: 32, max: 32, hit: false, reaction: 1, add: 0 },
];

const CAT_ROWS: readonly Row[] = [
  { min: 1, max: 13, hit: false, reaction: 1, add: 0 },
  { min: 14, max: 14, gap: true, hit: false, reaction: 1, add: 0 },
  { min: 15, max: 16, hit: false, reaction: 1, add: 0 },
  { min: 17, max: 17, hit: true, reaction: 3, add: 1, powerAdd: 2 },
  { min: 18, max: 18, gap: true, hit: false, reaction: 1, add: 0 },
  { min: 19, max: 19, hit: true, reaction: 3, add: 2, powerAdd: 3 },
  { min: 20, max: 20, hit: true, reaction: 2, add: 6, powerAdd: 9 },
  { min: 21, max: 21, hit: true, reaction: 3, add: 2, powerAdd: 4 },
  { min: 22, max: 22, hit: true, reaction: 4, add: 2, powerAdd: 3 },
  { min: 23, max: 24, hit: false, reaction: 1, add: 0 },
  { min: 25, max: 25, gap: true, hit: false, reaction: 1, add: 0 },
  { min: 26, max: 30, hit: false, reaction: 1, add: 0 },
  { min: 31, max: 31, gap: true, hit: false, reaction: 1, add: 0 },
  { min: 32, max: 32, hit: false, reaction: 1, add: 0 },
];

export function seatSide(seat: number | undefined): Side | null {
  if (seat === 0) return 'cat';
  if (seat === 1) return 'dog';
  return null;
}

export function windTableFor(difficulty: Difficulty | null): WindTable {
  return difficulty === 'expert' ? 'expert' : 'full';
}

function hashWind(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function drawWind(roomCode: string, drawIndex: number, table: WindTable): number {
  const values = table === 'expert' ? EXPERT_WIND : FULL_WIND;
  const limit = 0x100000000 - (0x100000000 % values.length);
  let salt = 0;
  let hash = hashWind(`${roomCode}\0${drawIndex}\0${salt}`);
  while (hash >= limit) {
    salt += 1;
    hash = hashWind(`${roomCode}\0${drawIndex}\0${salt}`);
  }
  return values[hash % values.length]!;
}

export function difficultyForStart(humanCount: number, value: unknown): { ok: true; difficulty: Difficulty | null } | { ok: false; reason: string } {
  if (humanCount <= 1) {
    const difficulty = parseDifficulty(value);
    if (!difficulty) return { ok: false, reason: 'Choose a difficulty before starting versus CPU.' };
    return { ok: true, difficulty };
  }
  return { ok: true, difficulty: null };
}

export function catAndDogEventPayload(state: CatAndDogState, move: CatAndDogMove) {
  return {
    type: move.type,
    item: move.type === 'throw' ? move.item : null,
    power: move.type === 'throw' ? move.power : null,
    side: state.toAct,
  };
}

export function cpuPower(difficulty: Difficulty): number {
  if (difficulty === 'level1') return 21;
  if (difficulty === 'level2') return 22;
  return 20;
}

export function parseDifficulty(value: unknown): Difficulty | null {
  if (value === 'level1' || value === 'level2' || value === 'expert') return value;
  return null;
}

export function isItem(value: unknown): value is Item {
  return typeof value === 'string' && ITEMS.includes(value as Item);
}

export function createLobbyState(): CatAndDogLobbyState {
  return { kind: 'cat-and-dog', phase: 'lobby' };
}

export function isCatAndDogLobby(value: unknown): value is CatAndDogLobbyState {
  return Boolean(value && typeof value === 'object' && (value as CatAndDogLobbyState).kind === 'cat-and-dog' && (value as CatAndDogLobbyState).phase === 'lobby');
}

export function isCatAndDogState(value: unknown): value is CatAndDogState {
  if (!value || typeof value !== 'object') return false;
  const state = value as CatAndDogState;
  return state.kind === 'cat-and-dog' && (state.phase === 'playing' || state.phase === 'won') && typeof state.roomCode === 'string';
}

export function createPlayingState(input: { roomCode: string; difficulty: Difficulty | null }): CatAndDogState {
  const windDraws = 0;
  return {
    kind: 'cat-and-dog',
    phase: 'playing',
    roomCode: input.roomCode,
    difficulty: input.difficulty,
    toAct: 'dog',
    wind: drawWind(input.roomCode, windDraws, windTableFor(input.difficulty)),
    windDraws: windDraws + 1,
    meters: { cat: METER_FLOOR, dog: METER_FLOOR },
    winner: null,
    last: null,
  };
}

export function createRematchState(state: CatAndDogState): CatAndDogState {
  return createPlayingState({ roomCode: state.roomCode, difficulty: state.difficulty });
}

function clampQq(qq: number): number {
  if (qq <= 0) return 1;
  if (qq >= 32) return 32;
  return qq;
}

function rowFor(rows: readonly Row[], qq: number): Row {
  const clamped = clampQq(qq);
  const row = rows.find((candidate) => clamped >= candidate.min && clamped <= candidate.max);
  if (!row) throw new Error('Landing row is missing.');
  return row;
}

export function landThrow(side: Side, qq: number, item: Item): Landing {
  const row = rowFor(side === 'dog' ? DOG_ROWS : CAT_ROWS, qq);
  const add = item === 'powerThrow' && row.powerAdd !== undefined ? row.powerAdd : row.add;
  return {
    qq,
    hit: row.hit,
    gap: Boolean(row.gap),
    reaction: row.reaction,
    add: row.hit ? add : 0,
    projectile: item === 'stinkBomb' ? 'stink' : 'plain',
  };
}

function other(side: Side): Side {
  return side === 'cat' ? 'dog' : 'cat';
}

function winnerFromMeters(meters: { cat: number; dog: number }): Side | null {
  if (meters.cat >= GIVE_UP_FRAME) return 'dog';
  if (meters.dog >= GIVE_UP_FRAME) return 'cat';
  return null;
}

function withNextWind(state: CatAndDogState, meters: { cat: number; dog: number }, last: ResolvedThrow): CatAndDogState {
  const winner = winnerFromMeters(meters);
  if (winner) {
    return { ...state, phase: 'won', meters, winner, last };
  }
  return {
    ...state,
    phase: 'playing',
    toAct: other(state.toAct),
    wind: drawWind(state.roomCode, state.windDraws, windTableFor(state.difficulty)),
    windDraws: state.windDraws + 1,
    meters,
    winner: null,
    last,
  };
}

function applyLanding(meters: { cat: number; dog: number }, side: Side, landing: Landing) {
  const next = { ...meters };
  const target = other(side);
  next[target] += landing.add;
  return next;
}

export function parseCatAndDogMove(body: unknown): { ok: true; move: CatAndDogMove } | { ok: false; reason: string } {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'Choose a throw or a power up.' };
  const record = body as { type?: unknown; item?: unknown; power?: unknown };
  if (record.type === 'powerUp') return { ok: true, move: { type: 'powerUp' } };
  if (record.type !== 'throw') return { ok: false, reason: 'Choose a throw or a power up.' };
  if (!isItem(record.item)) return { ok: false, reason: 'Choose one item.' };
  if (typeof record.power !== 'number' || !Number.isInteger(record.power) || record.power < 1 || record.power > 33) {
    return { ok: false, reason: 'Power must be an integer from 1 through 33.' };
  }
  return { ok: true, move: { type: 'throw', item: record.item, power: record.power } };
}

export const catAndDog: GameAdapter<CatAndDogState, CatAndDogMove> = {
  slug: CAT_AND_DOG_SLUG,
  title: 'Cat-and-Dog',
  roomPrefix: 'CAD',
  players: { min: 2, max: 2 },
  supports: ['turn_based'],
  createInitialState: () => createPlayingState({ roomCode: 'CAD-7KQ', difficulty: null }),
  validateMove: (state, move, actor: Guest) => {
    if (state.phase !== 'playing' || state.winner) return { ok: false, reason: 'Game is over.' };
    if (seatSide(actor.seat) !== state.toAct) return { ok: false, reason: 'It is not this player’s turn.' };
    if (move.type === 'powerUp') return { ok: true };
    if (!isItem(move.item)) return { ok: false, reason: 'Choose one item.' };
    if (!Number.isInteger(move.power) || move.power < 1 || move.power > 33) {
      return { ok: false, reason: 'Power must be an integer from 1 through 33.' };
    }
    return { ok: true };
  },
  applyMove: (state, move) => {
    if (move.type === 'powerUp') {
      const meters = { ...state.meters };
      meters[state.toAct] = Math.max(METER_FLOOR, meters[state.toAct] - 7);
      return withNextWind(state, meters, {
        kind: 'powerUp',
        side: state.toAct,
        item: null,
        power: null,
        wind: state.wind,
        landings: [],
        meters,
        winner: null,
      });
    }

    const qq = state.toAct === 'dog' ? move.power - state.wind : move.power + state.wind;
    const landings: Landing[] = [];
    let meters = { ...state.meters };
    const repeats = move.item === 'doubleAttack' ? 2 : 1;
    for (let index = 0; index < repeats; index += 1) {
      if (winnerFromMeters(meters)) break;
      const landing = landThrow(state.toAct, qq, move.item);
      landings.push(landing);
      meters = applyLanding(meters, state.toAct, landing);
    }
    const winner = winnerFromMeters(meters);
    return withNextWind(state, meters, {
      kind: 'throw',
      side: state.toAct,
      item: move.item,
      power: move.power,
      wind: state.wind,
      landings,
      meters,
      winner,
    });
  },
  getStatus: (state) => (state.phase === 'won' || state.winner ? 'won' : 'playing'),
};

export function nextCpuMove(
  state: CatAndDogState,
  members: Array<{ seat: number; is_cpu?: boolean }>,
): CatAndDogMove | null {
  if (catAndDog.getStatus(state) !== 'playing' || !state.difficulty) return null;
  const cpu = members.find((member) => member.is_cpu && seatSide(member.seat) === state.toAct);
  if (!cpu) return null;
  return { type: 'throw', item: 'none', power: cpuPower(state.difficulty) };
}
