import { expect, test } from 'bun:test';
import { createHand } from '../src/reducer';
import { isTienGowView, projectView } from '../src/view';
import { wenId } from '../src/tiles';
import { dump, fillHands, lead, PLAY_TABLE } from './helpers';

test('projectView omits other hands and dump faces', () => {
  const hands = fillHands([
    [wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0), wenId('di', 0), wenId('tian', 0)],
    [wenId('tian', 1), wenId('lingren', 0), wenId('gaojiao', 0), wenId('pingfeng', 0), wenId('lingren', 1), wenId('gaojiao', 1), wenId('di', 1), wenId('ren', 1)],
    undefined,
    undefined,
  ]);
  let state = createHand({ seed: 'view', table: PLAY_TABLE, bankerSeat: 0, hands });
  state = lead(state, [wenId('bandeng', 0)]);
  state = dump(state, 1);
  const view = projectView(state, 0);
  expect(view.hand.sort()).toEqual(state.hands[0].slice().sort());
  expect(view.hand).not.toEqual(state.hands[1]);
  expect(Object.keys(view)).not.toContain('hands');
  const dumpPlay = view.trick?.plays.find((play) => play.type === 'dump');
  expect(dumpPlay).toEqual({ seat: 1, type: 'dump', count: 1 });
  expect(JSON.stringify(view)).not.toContain(state.trick!.plays[1].type === 'dump' ? state.trick!.plays[1].tiles[0] : 'never');
  expect(isTienGowView(view)).toBe(true);
  expect(isTienGowView(state)).toBe(false);
});
