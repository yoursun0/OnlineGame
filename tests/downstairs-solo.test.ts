import { expect, test } from 'bun:test';
import {
  Engine,
  asRestorableWell,
  checkpointFromWell,
  createLobbyState,
  createSoloStartState,
  finishedState,
  isDownstairsRoomState,
  playingState,
} from '@playroom/downstairs';
import { isWellCheckpoint } from '@playroom/game-core';

test('lobby and solo start states use the well room contract', () => {
  const lobby = createLobbyState();
  expect(isDownstairsRoomState(lobby)).toBe(true);
  expect(lobby.phase).toBe('lobby');
  expect(lobby.checkpoint).toBeNull();

  const start = createSoloStartState('host-1');
  expect(isDownstairsRoomState(start)).toBe(true);
  expect(start.phase).toBe('playing');
  expect(start.checkpoint).not.toBeNull();
  expect(isWellCheckpoint(start.checkpoint)).toBe(true);
  expect(start.checkpoint!.well.kids).toHaveLength(1);
  expect(start.checkpoint!.well.kids[0]?.guestId).toBe('host-1');
  expect(start.checkpoint!.well.stairs.length).toBeGreaterThan(0);
});

test('a Solo well can run to death and round-trip through a Checkpoint', () => {
  const start = createSoloStartState('host-1');
  const engine = new Engine();
  engine.restoreFromWell(asRestorableWell(start.checkpoint!));
  expect(engine.players[0]?.alive).toBe(true);

  // Force a fall death without waiting for a long run.
  const kid = engine.players[0]!;
  kid.y = 500;
  kid.onFloor = null;
  engine.step(1 / 120);
  expect(engine.players[0]?.alive).toBe(false);
  expect(engine.over).toBe(true);

  const checkpoint = checkpointFromWell(1, engine.toRestorableWell());
  expect(isWellCheckpoint(checkpoint)).toBe(true);
  const finished = finishedState(checkpoint, 'fall');
  expect(isDownstairsRoomState(finished)).toBe(true);
  expect(finished.phase).toBe('finished');
  expect(finished.result?.reason).toBe('fall');

  const restored = new Engine();
  restored.restoreFromWell(asRestorableWell(finished.checkpoint!));
  restored.running = false;
  restored.over = true;
  expect(restored.players[0]?.alive).toBe(false);
  expect(restored.floors.length).toBeGreaterThan(0);
});

test('playingState keeps Checkpoint shape for refresh recovery', () => {
  const start = createSoloStartState('host-1');
  const next = playingState(checkpointFromWell(2, start.checkpoint!.well));
  expect(next.phase).toBe('playing');
  expect(next.checkpoint?.seq).toBe(2);
  expect(isWellCheckpoint(next.checkpoint)).toBe(true);
});
