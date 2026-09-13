export type GameMode = 'realtime' | 'turn_based';

export type GameStatus = 'playing' | 'won' | 'draw';

export type Guest = { id: string; seat?: number };

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Turn-based board games. Realtime well traffic is WellIntent / WellSnapshot / WellCheckpoint, not Move. */
export type GameAdapter<State, Move> = {
  slug: string;
  title: string;
  roomPrefix: string;
  players: { min: number; max: number };
  supports: GameMode[];
  createInitialState(): State;
  validateMove(state: State, move: Move, actor: Guest): MoveResult;
  applyMove(state: State, move: Move, actor: Guest): State;
  getStatus(state: State): GameStatus;
};

export {
  WELL_INTENT_DIRECTIONS,
  WELL_MAX_KIDS,
  WELL_MIN_KIDS,
  createWellCheckpoint,
  createWellIntent,
  createWellSnapshot,
  isWellCheckpoint,
  isWellIntent,
  isWellPlayPayload,
  isWellSnapshot,
} from './well';

export type {
  WellCheckpoint,
  WellIntent,
  WellIntentDirection,
  WellKid,
  WellPlayPayload,
  WellSnapshot,
  WellStair,
  WellState,
} from './well';

export type GameCatalogEntry = {
  slug: string;
  title: string;
  shortDescription: string;
  roomPrefix: string;
  players: { min: number; max: number };
  estimatedMinutes: number;
  supports: GameMode[];
  available: boolean;
};

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  {
    slug: 'tic-tac-toe',
    title: 'Tic-tac-toe',
    shortDescription: 'Three in a row. Quick to learn, hard to leave unfinished.',
    roomPrefix: 'TIK',
    players: { min: 2, max: 2 },
    estimatedMinutes: 5,
    supports: ['turn_based'],
    available: true,
  },
  {
    slug: 'connect-four',
    title: 'Connect Four',
    shortDescription: 'Four pieces, one clean line, and just enough room for a trap.',
    roomPrefix: 'CON',
    players: { min: 2, max: 2 },
    estimatedMinutes: 8,
    supports: ['turn_based'],
    available: true,
  },
];
