import { expect, test } from 'bun:test';
import { createSharedStartState, createSoloStartState, finishedState } from '@playroom/downstairs';
import { roomHeadline } from '../app/room-headline';

const members = [{ seat: 0, display_name: 'Host', guest_id: 'host' }];

test('a downstairs waiting room invites solo start', () => {
  expect(roomHeadline({
    status: 'open',
    state: { kind: 'well', phase: 'lobby', checkpoint: null },
    members,
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Waiting room — start solo anytime');
});

test('a downstairs waiting room with two humans names Shared', () => {
  expect(roomHeadline({
    status: 'open',
    state: { kind: 'well', phase: 'lobby', checkpoint: null },
    members: [
      { seat: 0, display_name: 'Host', guest_id: 'host' },
      { seat: 1, display_name: 'Guest', guest_id: 'guest' },
    ],
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Waiting room — Shared well when ready');
});

test('a finished downstairs well names the outcome', () => {
  const start = createSoloStartState('host');
  const finished = finishedState(start.checkpoint!, 'quit');
  expect(roomHeadline({
    status: 'finished',
    state: finished,
    members,
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Game complete — quit');
});

test('a finished Shared well names the winner', () => {
  const start = createSharedStartState(['host', 'guest']);
  const finished = finishedState(start.checkpoint!, 'hp', 'host');
  expect(roomHeadline({
    status: 'finished',
    state: finished,
    members: [
      { seat: 0, display_name: 'Host', guest_id: 'host' },
      { seat: 1, display_name: 'Guest', guest_id: 'guest' },
    ],
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Game complete — Host wins');
});
