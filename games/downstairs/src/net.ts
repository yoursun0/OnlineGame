import {
  createWellIntent,
  createWellSnapshot,
  isWellIntent,
  isWellSnapshot,
  type WellIntent,
  type WellIntentDirection,
  type WellSnapshot,
} from '@playroom/game-core';
import { HERO_W, MOVE_SPEED, STAGE_W, WALL_W, WELL_OWN_PREDICT_SLACK_PX } from './constants';
import type { Engine } from './engine';
import type { RestorableWell } from './state';

export const WELL_TOPIC_PREFIX = 'well:';
export const WELL_BROADCAST_INTENT = 'intent';
export const WELL_BROADCAST_SNAPSHOT = 'snapshot';

export function wellTopic(roomId: string) {
  return `${WELL_TOPIC_PREFIX}${roomId}`;
}

export function clampKidX(x: number) {
  return Math.max(WALL_W, Math.min(STAGE_W - WALL_W - HERO_W, x));
}

export function predictOwnKidX(x: number, direction: WellIntentDirection, dt: number) {
  const dir = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  return clampKidX(x + dir * MOVE_SPEED * dt);
}

export function pendingIntents(intents: WellIntent[], ack: number) {
  return intents.filter((intent) => intent.seq > ack);
}

export function latestPendingDirection(intents: WellIntent[], ack: number): WellIntentDirection | null {
  const pending = pendingIntents(intents, ack);
  return pending[pending.length - 1]?.direction ?? null;
}

/** Guest render: host Snapshot for the well, keep own X when it is still close. */
export function applyHostSnapshot(
  engine: Engine,
  snapshot: WellSnapshot,
  ownGuestId: string,
  predictedX: number | undefined,
) {
  engine.restoreFromWell(snapshot.well as RestorableWell);
  const own = engine.players.find((player) => player.guestId === ownGuestId);
  if (!own || !own.alive || predictedX === undefined) return;
  if (Math.abs(predictedX - own.x) <= WELL_OWN_PREDICT_SLACK_PX) {
    own.x = predictedX;
  }
}

export function applyOwnPrediction(
  engine: Engine,
  ownGuestId: string,
  direction: WellIntentDirection,
  dt: number,
) {
  const own = engine.players.find((player) => player.guestId === ownGuestId);
  if (!own || !own.alive) return;
  engine.setIntent(ownGuestId, direction);
  own.x = predictOwnKidX(own.x, direction, dt);
}

export function kidsMissingFromOccupants(engine: Engine, occupantGuestIds: readonly string[]) {
  const present = new Set(occupantGuestIds);
  return engine.players.filter((player) => player.alive && !present.has(player.guestId)).map((player) => player.guestId);
}

export function winnerGuestIdFromEngine(engine: Engine): string | null | undefined {
  if (engine.players.length <= 1) return undefined;
  const live = engine.players.filter((player) => player.alive);
  if (live.length === 1) return live[0]!.guestId;
  return null;
}

export {
  createWellIntent,
  createWellSnapshot,
  isWellIntent,
  isWellSnapshot,
};
