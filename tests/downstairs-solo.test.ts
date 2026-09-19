import { expect, test } from 'bun:test';
import {
  Engine,
  STEP,
  checkpointFromWell,
  createLobbyState,
  createSoloStartState,
  finishedState,
  isDownstairsRoomState,
  playingState,
} from '@playroom/downstairs';
import { isWellCheckpoint } from '@playroom/game-core';

test('createSoloStartState builds a playing Checkpoint with one host kid', () => {
  const state = createSoloStartState('host-guest');
  expect(isDownstairsRoomState(state)).toBe(true);
  expect(state.phase).toBe('playing');
  expect(state.checkpoint).not.toBeNull();
  expect(isWellCheckpoint(state.checkpoint!)).toBe(true);
  expect(state.checkpoint!.well.kids).toHaveLength(1);
  expect(state.checkpoint!.well.kids[0]?.guestId).toBe('host-guest');
  expect(state.checkpoint!.well.kids[0]?.alive).toBe(true);
  expect(state.checkpoint!.well.stairs.length).toBeGreaterThan(0);
});

test('lobby and finished room states round-trip the well contract', () => {
  expect(isDownstairsRoomState(createLobbyState())).toBe(true);
  const start = createSoloStartState('host');
  const finished = finishedState(start.checkpoint!, 'quit');
  expect(isDownstairsRoomState(finished)).toBe(true);
  expect(finished.phase).toBe('finished');
  expect(finished.result?.reason).toBe('quit');
});

test('Solo well steps, checkpoints, and restores without using board moves', () => {
  const engine = new Engine();
  engine.start(
    { mode: 'solo', difficulty: 'normal', traps: { conveyor: true, spring: true, fragile: true } },
    ['host'],
  );
  engine.setSoloIntent('right');
  for (let i = 0; i < 120; i++) engine.step(STEP);
  const checkpoint = checkpointFromWell(1, engine.toRestorableWell());
  expect(isWellCheckpoint(checkpoint)).toBe(true);
  expect(playingState(checkpoint).phase).toBe('playing');

  const restored = new Engine();
  restored.restoreFromWell(checkpoint.well);
  expect(restored.players[0]?.guestId).toBe('host');
  expect(restored.players[0]?.alive).toBe(true);
  expect(restored.floors.length).toBe(checkpoint.well.stairs.length);
  expect(Math.abs(restored.time - checkpoint.well.clock)).toBeLessThan(0.0001);
});

test('quit marks the Solo well over so the host can finish', () => {
  const engine = new Engine();
  engine.start(
    { mode: 'solo', difficulty: 'normal', traps: { conveyor: true, spring: true, fragile: true } },
    ['host'],
  );
  engine.quit();
  expect(engine.over).toBe(true);
  expect(engine.players[0]?.alive).toBe(false);
  const finish = finishedState(checkpointFromWell(2, engine.toRestorableWell()), 'quit');
  expect(finish.phase).toBe('finished');
  expect(finish.result?.reason).toBe('quit');
});
