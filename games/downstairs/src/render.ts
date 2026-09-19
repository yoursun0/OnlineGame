import { FLOOR_H, HERO_H, HERO_W, PLAYER_COLOR, SPIKE_H, STAGE_H, STAGE_W, WALL_W } from './constants';
import type { Actor, Engine, Floor } from './engine';

export function renderWell(ctx: CanvasRenderingContext2D, engine: Engine, now: number) {
  const shakeX = engine.shake > 0 ? Math.sin(now * 58) * 3.2 * (engine.shake / 0.28) : 0;
  const shakeY = engine.shake > 0 ? Math.cos(now * 47) * 2.2 * (engine.shake / 0.28) : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.translate(shakeX, shakeY);
  ctx.fillStyle = '#0c3a78';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = '#16324c';
  ctx.fillRect(0, 0, WALL_W, STAGE_H);
  ctx.fillRect(STAGE_W - WALL_W, 0, WALL_W, STAGE_H);
  ctx.fillStyle = '#c45c4a';
  ctx.fillRect(WALL_W, 0, STAGE_W - WALL_W * 2, SPIKE_H);
  for (const floor of engine.floors) drawFloor(ctx, floor);
  for (const player of engine.players) {
    if (!player.alive) continue;
    drawActor(ctx, player);
  }
  for (const particle of engine.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFloor(ctx: CanvasRenderingContext2D, floor: Floor) {
  const alpha = Math.max(0.15, floor.collapse);
  ctx.globalAlpha = alpha;
  if (floor.kind === 'spike') ctx.fillStyle = '#dfe6ee';
  else if (floor.kind === 'spring') ctx.fillStyle = '#f0c42a';
  else if (floor.kind === 'fragile') ctx.fillStyle = '#7a848e';
  else if (floor.kind === 'convL' || floor.kind === 'convR') ctx.fillStyle = '#3db346';
  else ctx.fillStyle = '#2f7eb8';
  ctx.fillRect(floor.x, floor.y, floor.w, FLOOR_H);
  if (floor.kind === 'spike') {
    ctx.fillStyle = '#9aa3ad';
    for (let x = floor.x + 4; x < floor.x + floor.w - 4; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, floor.y);
      ctx.lineTo(x + 4, floor.y - 8);
      ctx.lineTo(x + 8, floor.y);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawActor(ctx: CanvasRenderingContext2D, actor: Actor) {
  if (actor.blink) return;
  ctx.fillStyle = PLAYER_COLOR[actor.id] ?? '#e0b03a';
  ctx.fillRect(actor.x, actor.y, HERO_W, HERO_H);
  ctx.fillStyle = '#1c222a';
  const eyeX = actor.facing === -1 ? actor.x + 4 : actor.x + HERO_W - 10;
  ctx.fillRect(eyeX, actor.y + 10, 4, 4);
}
