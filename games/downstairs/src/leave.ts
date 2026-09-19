import type { WellCheckpoint } from '@playroom/game-core';
import type { DownstairsRoomPhase, DownstairsRoomState } from './state';

/** Pure outcomes for a guest (re)mount during/after a well. */
export type GuestWellRefreshOutcome = 'restore' | 'out' | 'finished' | 'lobby';

/**
 * Non-host refresh: restore from Checkpoint when present; out if playing with none;
 * finished wells still show the stored result.
 */
export function guestWellRefreshOutcome(
  phase: DownstairsRoomPhase,
  checkpoint: WellCheckpoint | null,
): GuestWellRefreshOutcome {
  if (phase === 'lobby') return 'lobby';
  if (phase === 'finished') return 'finished';
  if (phase === 'playing') return checkpoint ? 'restore' : 'out';
  return 'lobby';
}

/** Shared host tab close / navigate-away should persist host_left; Solo refresh must not. */
export function shouldPersistHostLeftOnUnload(input: {
  isHost: boolean;
  shared: boolean;
  phase: DownstairsRoomPhase;
  alreadyFinished: boolean;
}) {
  return input.isHost && input.shared && input.phase === 'playing' && !input.alreadyFinished;
}

/** Whether this finish reason may be written by a non-host member (Presence drop backup). */
export function nonHostMayDeclareHostLeft(reason: string) {
  return reason === 'host_left';
}

export function isPlayingWellWithCheckpoint(state: DownstairsRoomState) {
  return state.phase === 'playing' && state.checkpoint !== null;
}
