import { expect, test } from 'bun:test';
import {
  SPRITE_SIZE,
  STAGE_H,
  STAGE_W,
  createSoloStartState,
  createSharedStartState,
  Engine,
  asRestorableWell,
  renderWell,
} from '@playroom/downstairs';

test('downstairs art exports prototype sprite size and stage used by PLAYROOM canvas', () => {
  expect(SPRITE_SIZE).toBe(54);
  expect(STAGE_W).toBe(360);
  expect(STAGE_H).toBe(480);
});

test('renderWell draws without throwing when given a 2d context stub', () => {
  const start = createSoloStartState('host');
  const engine = new Engine();
  engine.restoreFromWell(asRestorableWell(start.checkpoint!));

  const calls: string[] = [];
  const ctx = {
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    clearRect() {},
    translate() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    arc() {},
    ellipse() {},
    quadraticCurveTo() {},
    rect() {},
    clip() {},
    drawImage() {},
    set imageSmoothingEnabled(_v: boolean) {},
    set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set filter(_v: string) {},
  } as unknown as CanvasRenderingContext2D;

  expect(() => renderWell(ctx, engine, 1.25, null)).not.toThrow();
  expect(calls).toContain('save');
  expect(calls).toContain('restore');
});

test('shared start still builds a multi-kid well (art must not touch netcode)', () => {
  const start = createSharedStartState(['h', 'g', 'a']);
  expect(start.checkpoint?.well.kids).toHaveLength(3);
});
