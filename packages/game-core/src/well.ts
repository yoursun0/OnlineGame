export const WELL_INTENT_DIRECTIONS = ['left', 'right', 'none'] as const;

export type WellIntentDirection = (typeof WELL_INTENT_DIRECTIONS)[number];

export const WELL_MIN_KIDS = 1;
export const WELL_MAX_KIDS = 4;

/** Guest control for a short interval. Not a board position and not a turn. */
export type WellIntent = {
  kind: 'intent';
  guestId: string;
  direction: WellIntentDirection;
  seq: number;
  t: number;
};

export type WellKid = {
  guestId: string;
  x: number;
  y: number;
  life: number;
  alive: boolean;
};

export type WellStair = {
  id: number;
  x: number;
  y: number;
  w: number;
  kind: string;
};

/** Host simulator well: kid positions, stairs, and clock. */
export type WellState = {
  clock: number;
  kids: WellKid[];
  stairs: WellStair[];
};

/** Live host well sent over Broadcast. Not the Postgres room row. */
export type WellSnapshot = {
  kind: 'snapshot';
  seq: number;
  ack: number;
  well: WellState;
};

/** Sparse server-stored well save. Not a per-frame Snapshot and not a move row. */
export type WellCheckpoint = {
  kind: 'checkpoint';
  seq: number;
  well: WellState;
};

export type WellPlayPayload = WellIntent | WellSnapshot | WellCheckpoint;

export function createWellIntent(
  guestId: string,
  direction: WellIntentDirection,
  seq: number,
  t: number,
): WellIntent {
  return { kind: 'intent', guestId, direction, seq, t };
}

export function createWellSnapshot(seq: number, ack: number, well: WellState): WellSnapshot {
  return { kind: 'snapshot', seq, ack, well };
}

export function createWellCheckpoint(seq: number, well: WellState): WellCheckpoint {
  return { kind: 'checkpoint', seq, well };
}

export function isWellIntent(value: unknown): value is WellIntent {
  if (!isRecord(value) || value.kind !== 'intent') return false;
  return (
    isNonEmptyString(value.guestId) &&
    isWellIntentDirection(value.direction) &&
    isNonNegativeInt(value.seq) &&
    isFiniteNumber(value.t)
  );
}

export function isWellSnapshot(value: unknown): value is WellSnapshot {
  if (!isRecord(value) || value.kind !== 'snapshot') return false;
  return isNonNegativeInt(value.seq) && isNonNegativeInt(value.ack) && isWellState(value.well);
}

export function isWellCheckpoint(value: unknown): value is WellCheckpoint {
  if (!isRecord(value) || value.kind !== 'checkpoint') return false;
  return isNonNegativeInt(value.seq) && isWellState(value.well);
}

export function isWellPlayPayload(value: unknown): value is WellPlayPayload {
  return isWellIntent(value) || isWellSnapshot(value) || isWellCheckpoint(value);
}

function isWellIntentDirection(value: unknown): value is WellIntentDirection {
  return value === 'left' || value === 'right' || value === 'none';
}

function isWellState(value: unknown): value is WellState {
  if (!isRecord(value) || !isFiniteNumber(value.clock) || value.clock < 0) return false;
  if (!Array.isArray(value.kids) || !Array.isArray(value.stairs)) return false;
  if (value.kids.length < WELL_MIN_KIDS || value.kids.length > WELL_MAX_KIDS) return false;
  if (value.stairs.length < 1) return false;
  if (!value.kids.every(isWellKid) || !value.stairs.every(isWellStair)) return false;
  const guestIds = new Set(value.kids.map((kid) => kid.guestId));
  if (guestIds.size !== value.kids.length) return false;
  const stairIds = new Set(value.stairs.map((stair) => stair.id));
  return stairIds.size === value.stairs.length;
}

function isWellKid(value: unknown): value is WellKid {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.guestId) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.life) &&
    typeof value.alive === 'boolean'
  );
}

function isWellStair(value: unknown): value is WellStair {
  if (!isRecord(value) || !isNonNegativeInt(value.id)) return false;
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.w) &&
    value.w > 0 &&
    isNonEmptyString(value.kind)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
