export type GameMode = 'realtime' | 'turn_based';

export type GameStatus = 'playing' | 'won' | 'draw';

export type Guest = { id: string; seat?: number };

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: string };

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
];
