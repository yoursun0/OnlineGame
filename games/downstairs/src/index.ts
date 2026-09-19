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
  STAGE_W,
  STEP,
  WELL_CHECKPOINT_INTERVAL_MS,
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

export { Engine } from './engine';
export type { EngineConfig, Floor, Actor, TrapFlags } from './engine';
export { renderWell } from './render';

import { Engine } from './engine';
import { checkpointFromWell, playingState, type DownstairsRoomState } from './state';

/** Build the first playing room state for a Solo well (host kid only). */
export function createSoloStartState(hostGuestId: string): DownstairsRoomState {
  const engine = new Engine();
  engine.start(
    { mode: 'solo', difficulty: 'normal', traps: { conveyor: true, spring: true, fragile: true } },
    [hostGuestId],
  );
  return playingState(checkpointFromWell(0, engine.toRestorableWell()));
}
