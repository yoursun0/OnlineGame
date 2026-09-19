import { expect, test } from 'bun:test';
import { createSoloStartState, finishedState } from '@playroom/downstairs';
import { roomHeadline } from '../app/room-headline';

const members = [{ seat: 0, display_name: 'Host' }];

test('a downstairs waiting room invites solo start', () => {
  expect(roomHeadline({
    status: 'open',
    state: { kind: 'well', phase: 'lobby', checkpoint: null },
    members,
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Waiting room — start solo anytime');
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
