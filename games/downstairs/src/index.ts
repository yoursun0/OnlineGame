export {
  DOWNSTAIRS_SLUG,
  asRestorableWell,
  checkpointFromWell,
  createLobbyState,
  finishedState,
  isDownstairsRoomState,
  playingState,
} from './state';
export type {
  DownstairsResult,
  DownstairsRoomPhase,
  DownstairsRoomState,
  RestorableKid,
  RestorableStair,
  RestorableWell,
} from './state';

export {
  FLOOR_KINDS,
  HEAL,
  MAX_LIFE,
  MAX_FRAME_DT,
  PLAYER_COLOR,
  SPIKE_DMG,
  STAGE_H,
  SPRITE_SIZE,
  STAGE_W,
  STEP,
  WELL_BROADCAST_HZ,
  WELL_CHECKPOINT_INTERVAL_MS,
  WELL_OWN_PREDICT_SLACK_PX,
  WELL_PRESENCE_GRACE_MS,
  isFloorKind,
  isVersus,
  playModeForCount,
  playerCount,
  scrollSpeed,
  spikeChance,
} from './constants';
export type {
  Difficulty,
  FloorKind,
  PlayMode,
  PlayerId,
  WellFinishReason,
} from './constants';

export {
  guestWellRefreshOutcome,
  isPlayingWellWithCheckpoint,
  nonHostMayDeclareHostLeft,
  shouldPersistHostLeftOnUnload,
} from './leave';
export type { GuestWellRefreshOutcome } from './leave';

export { Engine } from './engine';
export type { EngineConfig, Floor, Actor, TrapFlags } from './engine';
export { renderWell } from './render';
export type { WellRenderAssets } from './render';
export { loadWellAssets, spriteFor } from './assets';
export type { GameAssets, SpriteSet, WellTextures } from './assets';
export {
  WELL_BROADCAST_INTENT,
  WELL_BROADCAST_SNAPSHOT,
  WELL_TOPIC_PREFIX,
  applyHostSnapshot,
  applyOwnPrediction,
  clampKidX,
  createWellIntent,
  createWellSnapshot,
  isWellIntent,
  isWellSnapshot,
  kidsMissingFromOccupants,
  latestPendingDirection,
  pendingIntents,
  predictOwnKidX,
  wellTopic,
  winnerGuestIdFromEngine,
} from './net';

import { Engine } from './engine';
import { playModeForCount } from './constants';
import { checkpointFromWell, playingState, type DownstairsRoomState } from './state';

const DEFAULT_TRAPS = { conveyor: true, spring: true, fragile: true } as const;

/** Build the first playing room state for a Solo well (host kid only). */
export function createSoloStartState(hostGuestId: string): DownstairsRoomState {
  return createStartState([hostGuestId]);
}

/** Build the first playing room state for a Shared well (2–4 kids). */
export function createSharedStartState(guestIds: string[]): DownstairsRoomState {
  if (guestIds.length < 2 || guestIds.length > 4) {
    throw new Error('A Shared well needs 2–4 guest ids.');
  }
  return createStartState(guestIds);
}

/** Solo (1) or Shared (2–4) start Checkpoint from the host-first occupant list. */
export function createStartState(guestIds: string[]): DownstairsRoomState {
  if (guestIds.length < 1 || guestIds.length > 4) {
    throw new Error('A downstairs well needs 1–4 guest ids.');
  }
  const engine = new Engine();
  engine.start(
    { mode: playModeForCount(guestIds.length), difficulty: 'normal', traps: { ...DEFAULT_TRAPS } },
    guestIds,
  );
  return playingState(checkpointFromWell(0, engine.toRestorableWell()));
}
