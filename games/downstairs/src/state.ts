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

export type DownstairsRoomState = {
  kind: 'well';
  phase: DownstairsRoomPhase;
  checkpoint: WellCheckpoint | null;
  result?: { reason: WellFinishReason };
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

export type RestorableWell = WellState & {
  depth?: number;
  floorIndex?: number;
  lastY?: number;
  nextId?: number;
  scroll?: number;
  over?: boolean;
  kids: RestorableKid[];
  stairs: RestorableStair[];
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
    const reason = (record.result as { reason?: unknown }).reason;
    if (reason !== 'hp' && reason !== 'fall' && reason !== 'quit') return false;
  }
  return true;
}

export function playingState(checkpoint: WellCheckpoint): DownstairsRoomState {
  return { kind: 'well', phase: 'playing', checkpoint };
}

export function finishedState(checkpoint: WellCheckpoint, reason: WellFinishReason): DownstairsRoomState {
  return { kind: 'well', phase: 'finished', checkpoint, result: { reason } };
}

export function checkpointFromWell(seq: number, well: WellState): WellCheckpoint {
  return createWellCheckpoint(seq, well);
}
