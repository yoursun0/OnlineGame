import { expect, test } from 'bun:test';
import {
  Engine,
  WELL_BROADCAST_HZ,
  WELL_PRESENCE_GRACE_MS,
  applyHostSnapshot,
  applyOwnPrediction,
  asRestorableWell,
  checkpointFromWell,
  createSharedStartState,
  createSoloStartState,
  createWellIntent,
  createWellSnapshot,
  finishedState,
  isDownstairsRoomState,
  kidsMissingFromOccupants,
  pendingIntents,
  wellTopic,
  playModeForCount,
  winnerGuestIdFromEngine,
} from '@playroom/downstairs';
import { isWellCheckpoint, isWellIntent, isWellSnapshot } from '@playroom/game-core';

test('Shared start state puts two kids in one well Checkpoint', () => {
  const start = createSharedStartState(['host-1', 'guest-2']);
  expect(isDownstairsRoomState(start)).toBe(true);
  expect(start.phase).toBe('playing');
  expect(isWellCheckpoint(start.checkpoint)).toBe(true);
  expect(start.checkpoint!.well.kids).toHaveLength(2);
  expect(start.checkpoint!.well.kids.map((kid) => kid.guestId)).toEqual(['host-1', 'guest-2']);
});

test('Solo start still works beside Shared helpers', () => {
  const solo = createSoloStartState('solo-host');
  expect(solo.checkpoint!.well.kids).toHaveLength(1);
  expect(createSharedStartState(['a', 'b']).checkpoint!.well.kids).toHaveLength(2);
});

test('intent-driven Shared engine applies guest intents and leaveKid', () => {
  const start = createSharedStartState(['host-1', 'guest-2']);
  const engine = new Engine();
  engine.restoreFromWell(asRestorableWell(start.checkpoint!));
  expect(engine.intentDriven).toBe(true);
  expect(engine.players).toHaveLength(2);

  engine.setIntent('guest-2', 'left');
  engine.step(1 / 120);
  expect(engine.players[1]?.dir).toBe(-1);

  expect(engine.leaveKid('guest-2')).toBe(true);
  expect(engine.players[1]?.alive).toBe(false);
  expect(engine.over).toBe(true);
  expect(winnerGuestIdFromEngine(engine)).toBe('host-1');
});

test('Broadcast helpers keep Intent / Snapshot contracts without Postgres shape', () => {
  expect(WELL_BROADCAST_HZ).toBeGreaterThan(0);
  expect(WELL_PRESENCE_GRACE_MS).toBeGreaterThan(0);
  expect(wellTopic('room-uuid')).toBe('well:room-uuid');

  const intent = createWellIntent('guest-2', 'right', 4, 10);
  expect(isWellIntent(intent)).toBe(true);
  expect(pendingIntents([intent], 3)).toHaveLength(1);
  expect(pendingIntents([intent], 4)).toHaveLength(0);

  const start = createSharedStartState(['host-1', 'guest-2']);
  const snapshot = createWellSnapshot(1, 4, start.checkpoint!.well);
  expect(isWellSnapshot(snapshot)).toBe(true);

  const guestEngine = new Engine();
  guestEngine.restoreFromWell(asRestorableWell(start.checkpoint!));
  const before = guestEngine.players[1]!.x;
  applyOwnPrediction(guestEngine, 'guest-2', 'right', 0.05);
  expect(guestEngine.players[1]!.x).toBeGreaterThan(before);

  const hostX = guestEngine.players[1]!.x;
  applyHostSnapshot(guestEngine, snapshot, 'guest-2', hostX);
  expect(Math.abs(guestEngine.players[1]!.x - hostX)).toBeLessThanOrEqual(24);
});

test('Presence missing kids and finished winnerGuestId round-trip', () => {
  const start = createSharedStartState(['host-1', 'guest-2']);
  const engine = new Engine();
  engine.restoreFromWell(asRestorableWell(start.checkpoint!));
  expect(kidsMissingFromOccupants(engine, ['host-1'])).toEqual(['guest-2']);
  expect(kidsMissingFromOccupants(engine, ['host-1', 'guest-2'])).toEqual([]);

  engine.leaveKid('guest-2');
  const checkpoint = checkpointFromWell(2, engine.toRestorableWell());
  const finished = finishedState(checkpoint, 'hp', winnerGuestIdFromEngine(engine));
  expect(isDownstairsRoomState(finished)).toBe(true);
  expect(finished.result?.winnerGuestId).toBe('host-1');
});

test('Shared start state puts 3 and 4 kids in one well Checkpoint', () => {
  const three = createSharedStartState(['host-1', 'guest-2', 'guest-3']);
  expect(three.checkpoint!.well.kids).toHaveLength(3);
  expect(three.checkpoint!.well.kids.map((kid) => kid.guestId)).toEqual(['host-1', 'guest-2', 'guest-3']);
  expect(playModeForCount(3)).toBe('vs3');

  const four = createSharedStartState(['host-1', 'guest-2', 'guest-3', 'guest-4']);
  expect(four.checkpoint!.well.kids).toHaveLength(4);
  expect(four.checkpoint!.well.kids.map((kid) => kid.guestId)).toEqual(['host-1', 'guest-2', 'guest-3', 'guest-4']);
  expect(playModeForCount(4)).toBe('vs4');
});

test('last kid standing wins in a 4-kid Shared well', () => {
  const start = createSharedStartState(['a', 'b', 'c', 'd']);
  const engine = new Engine();
  engine.restoreFromWell(asRestorableWell(start.checkpoint!));
  expect(engine.players).toHaveLength(4);

  expect(engine.leaveKid('b')).toBe(true);
  expect(engine.leaveKid('c')).toBe(true);
  expect(engine.over).toBe(false);
  expect(engine.leaveKid('d')).toBe(true);
  expect(engine.over).toBe(true);
  expect(winnerGuestIdFromEngine(engine)).toBe('a');
});
