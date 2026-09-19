import {
  createWellCheckpoint,
  isWellCheckpoint,
  type WellCheckpoint,
  type WellKid,
  type WellStair,
  type WellState,
} from '@playroom/game-core';
import type { FloorKind, WellFinishReason } from './constants';

export const DOWNSTAIRS_SLUG = 'downstairs';

export type DownstairsRoomPhase = 'lobby' | 'playing' | 'finished';

export type DownstairsResult = {
  reason: WellFinishReason;
  winnerGuestId?: string | null;
};

export type DownstairsRoomState = {
  kind: 'well';
  phase: DownstairsRoomPhase;
  checkpoint: WellCheckpoint | null;
  result?: DownstairsResult;
};

export type RestorableKid = WellKid & {
  vx?: number;
  vy?: number;
  facing?: 1 | -1;
  invuln?: number;
  ceilIFrame?: number;
  healFloor?: number;
  best?: number;
  death?: 'hp' | 'fall' | null;
  anim?: 'idle' | 'walk' | 'fall';
  frame?: number;
};

export type RestorableStair = WellStair & {
  collapse?: number;
  collapsing?: boolean;
  springT?: number;
  charged?: boolean;
  kind: FloorKind | string;
};

export type RestorableWell = {
  clock: number;
  kids: RestorableKid[];
  stairs: RestorableStair[];
  depth?: number;
  floorIndex?: number;
  lastY?: number;
  nextId?: number;
  scroll?: number;
  over?: boolean;
};

export function createLobbyState(): DownstairsRoomState {
  return { kind: 'well', phase: 'lobby', checkpoint: null };
}

export function isDownstairsRoomState(value: unknown): value is DownstairsRoomState {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.kind !== 'well') return false;
  if (record.phase !== 'lobby' && record.phase !== 'playing' && record.phase !== 'finished') return false;
  if (record.checkpoint !== null && !isWellCheckpoint(record.checkpoint)) return false;
  if (record.result !== undefined) {
    if (typeof record.result !== 'object' || record.result === null) return false;
    const result = record.result as { reason?: unknown; winnerGuestId?: unknown };
    if (result.reason !== 'hp' && result.reason !== 'fall' && result.reason !== 'quit') return false;
    if (result.winnerGuestId !== undefined && result.winnerGuestId !== null && typeof result.winnerGuestId !== 'string') {
      return false;
    }
  }
  return true;
}

export function playingState(checkpoint: WellCheckpoint): DownstairsRoomState {
  return { kind: 'well', phase: 'playing', checkpoint };
}

export function finishedState(
  checkpoint: WellCheckpoint,
  reason: WellFinishReason,
  winnerGuestId?: string | null,
): DownstairsRoomState {
  return {
    kind: 'well',
    phase: 'finished',
    checkpoint,
    result: winnerGuestId === undefined ? { reason } : { reason, winnerGuestId },
  };
}

export function checkpointFromWell(seq: number, well: WellState): WellCheckpoint {
  return createWellCheckpoint(seq, well);
}

export function asRestorableWell(checkpoint: WellCheckpoint): RestorableWell {
  return checkpoint.well as unknown as RestorableWell;
}
