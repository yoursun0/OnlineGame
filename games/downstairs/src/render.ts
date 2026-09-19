import {
  FLOOR_H,
  HERO_H,
  HERO_W,
  PLAYER_COLOR,
  SPIKE_H,
  SPRITE_SIZE,
  STAGE_H,
  STAGE_W,
  WALL_W,
} from './constants';
import type { GameAssets, SpriteSet, WellTextures } from './assets';
import { spriteFor } from './assets';
import type { Actor, Engine, Floor } from './engine';

const C = {
  void: '#07090d',
  wallDeep: '#16324c',
  wallMid: '#2f7eb8',
  wallLite: '#6ec4ea',
  wallGrout: '#0d2236',
  greenDeep: '#1a5a28',
  greenMid: '#3db346',
  greenLite: '#7eec6a',
  greenHi: '#c8ff9a',
  greenGrout: '#0e3018',
  silverHi: '#e8eef4',
  silver: '#b7c2cc',
  silverMid: '#7e8b98',
  silverDark: '#3d4652',
  silverInk: '#1c222a',
  yellow: '#f0c42a',
  yellowHi: '#ffe56a',
  yellowDeep: '#b8860a',
  spike: '#dfe6ee',
  spikeCore: '#9aa3ad',
  woodLite: '#c48a4a',
  woodMid: '#8b5a2b',
  woodDeep: '#5a3418',
  woodHi: '#e0b070',
};

export type WellRenderAssets = {
  kids?: GameAssets | null;
  textures?: WellTextures | null;
};

/** Draw the live well viewport in the downstairs.grok.me prototype art style. */
export function renderWell(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  now: number,
  assets: WellRenderAssets | null = null,
) {
  const kids = assets?.kids ?? null;
  const textures = assets?.textures ?? null;
  const shakeX = engine.shake > 0 ? Math.sin(now * 58) * 3.2 * (engine.shake / 0.28) : 0;
  const shakeY = engine.shake > 0 ? Math.cos(now * 47) * 2.2 * (engine.shake / 0.28) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);

  ctx.translate(shakeX, shakeY);
  drawBg(ctx, engine.scroll, textures);
  drawCeiling(ctx);
  for (const floor of engine.floors) drawFloor(ctx, floor, engine.time);
  for (const player of engine.players) {
    if (!player.alive) continue;
    drawActor(ctx, player, spriteFor(kids, player.id));
  }
  for (const particle of engine.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

type BrickPal = { grout: string; mid: string; lite: string; deep: string };

const WALL_PAL: BrickPal = {
  grout: C.wallGrout,
  mid: C.wallMid,
  lite: C.wallLite,
  deep: C.wallDeep,
};

const GREEN_PAL: BrickPal = {
  grout: C.greenGrout,
  mid: C.greenMid,
  lite: C.greenLite,
  deep: C.greenDeep,
};

const GRAY_PAL: BrickPal = {
  grout: '#2a3038',
  mid: '#7a848e',
  lite: '#c5ced6',
  deep: '#4a545e',
};

function drawBg(ctx: CanvasRenderingContext2D, scroll: number, _textures: WellTextures | null) {
  // Match downstairs.grok.me: deep blue shaft + parallax blobs (sprite sheets still used for kids).
  ctx.fillStyle = '#0c3a78';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  for (let i = 0; i < 36; i++) {
    const gy = ((i * 47 + scroll * 0.45) % (STAGE_H + 90)) - 45;
    const gx = WALL_W + 16 + ((i * 89) % (STAGE_W - WALL_W * 2 - 32));
    ctx.fillStyle = i % 3 === 0 ? '#1a64b4' : i % 3 === 1 ? '#0a2e62' : '#145498';
    ctx.beginPath();
    ctx.ellipse(gx, gy, 26 + (i % 5) * 7, 14 + (i % 4) * 5, (i % 6) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const brickH = 10;
  const wallOff = ((scroll * 0.55) % brickH + brickH) % brickH;
  drawWall(ctx, 0, wallOff, 1);
  drawWall(ctx, STAGE_W - WALL_W, wallOff, -1);
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, off: number, face: 1 | -1) {
  const brickH = 10;
  const brickW = 9;
  for (let y = -off - brickH; y < STAGE_H + brickH; y += brickH) {
    const row = Math.floor((y + off) / brickH);
    const stagger = row % 2 === 0 ? 0 : brickW / 2;
    ctx.fillStyle = WALL_PAL.grout;
    ctx.fillRect(x, y, WALL_W, brickH);
    for (let col = -1; col < 4; col++) {
      const bx = x + col * brickW + stagger;
      if (bx + 1 < x || bx >= x + WALL_W) continue;
      const clipX = Math.max(bx, x);
      const clipW = Math.min(bx + brickW - 1, x + WALL_W) - clipX;
      if (clipW <= 1) continue;
      ctx.fillStyle = row % 3 === 0 ? WALL_PAL.mid : WALL_PAL.lite;
      ctx.fillRect(clipX, y + 1, clipW, brickH - 2);
      ctx.fillStyle = WALL_PAL.lite;
      ctx.fillRect(clipX, y + 1, clipW, 1);
      ctx.fillStyle = WALL_PAL.deep;
      ctx.fillRect(clipX, y + brickH - 2, clipW, 1);
    }
  }
  ctx.fillStyle = face > 0 ? WALL_PAL.deep : WALL_PAL.lite;
  ctx.fillRect(face > 0 ? x + WALL_W - 2 : x, 0, 2, STAGE_H);
}

/** Ceiling spike rail (prototype “top door / grate” into the shaft). */
function drawCeiling(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.silverInk;
  ctx.fillRect(0, 0, STAGE_W, 5);
  ctx.fillStyle = C.silverDark;
  ctx.fillRect(0, 4, STAGE_W, SPIKE_H - 4);
  const step = 12;
  for (let x = 0; x < STAGE_W + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, SPIKE_H);
    ctx.lineTo(x + step / 2, SPIKE_H + 13);
    ctx.lineTo(x + step, SPIKE_H);
    ctx.closePath();
    ctx.fillStyle = C.spike;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 3, SPIKE_H);
    ctx.lineTo(x + step / 2, SPIKE_H + 9);
    ctx.lineTo(x + step - 3, SPIKE_H);
    ctx.closePath();
    ctx.fillStyle = C.spikeCore;
    ctx.fill();
  }
  // Small wooden lintel / door frame at the top centre (readable on mobile).
  const doorW = 52;
  const doorX = (STAGE_W - doorW) / 2;
  ctx.fillStyle = C.woodDeep;
  ctx.fillRect(doorX - 3, 0, doorW + 6, 7);
  ctx.fillStyle = C.woodMid;
  ctx.fillRect(doorX, 1, doorW, 5);
  ctx.fillStyle = C.woodHi;
  ctx.fillRect(doorX + 4, 2, doorW - 8, 2);
  ctx.fillStyle = C.silver;
  ctx.fillRect(0, 0, STAGE_W, 2);
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  floor: Floor,
  now: number,
) {
  if (floor.y >= STAGE_H || floor.y + FLOOR_H < 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.18, floor.collapse);

  if (floor.kind === 'spike') drawSpikeFloor(ctx, floor);
  else if (floor.kind === 'spring') drawSpringFloor(ctx, floor);
  else if (floor.kind === 'convL' || floor.kind === 'convR') drawConveyor(ctx, floor, now);
  else if (floor.kind === 'fragile') drawFragile(ctx, floor);
  else drawBricks(ctx, floor.x, floor.y, floor.w, FLOOR_H, WALL_PAL);

  ctx.restore();
}

function drawBricks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: BrickPal,
) {
  const brickW = 9;
  ctx.fillStyle = pal.grout;
  ctx.fillRect(x, y, w, h);
  const cols = Math.max(1, Math.round(w / brickW));
  const cw = w / cols;
  for (let col = 0; col < cols; col++) {
    const bx = x + col * cw;
    const bwClip = Math.min(cw - 1, x + w - bx);
    ctx.fillStyle = col % 3 === 0 ? pal.mid : pal.lite;
    ctx.fillRect(bx, y + 1, bwClip, h - 2);
    ctx.fillStyle = pal.lite;
    ctx.fillRect(bx, y + 1, bwClip, 1);
    ctx.fillStyle = pal.deep;
    ctx.fillRect(bx, y + h - 3, bwClip, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = pal.grout;
  ctx.fillRect(x, y + h - 1, w, 1);
}

function drawSpikeFloor(ctx: CanvasRenderingContext2D, floor: Floor) {
  drawBricks(ctx, floor.x, floor.y, floor.w, FLOOR_H, WALL_PAL);
  const n = Math.max(5, Math.round(floor.w / 12));
  const step = floor.w / n;
  for (let i = 0; i < n; i++) {
    const x = floor.x + i * step;
    ctx.beginPath();
    ctx.moveTo(x + 1, floor.y);
    ctx.lineTo(x + step / 2, floor.y - 11);
    ctx.lineTo(x + step - 1, floor.y);
    ctx.closePath();
    ctx.fillStyle = C.spike;
    ctx.fill();
    ctx.fillStyle = C.spikeCore;
    ctx.beginPath();
    ctx.moveTo(x + 3, floor.y);
    ctx.lineTo(x + step / 2, floor.y - 7);
    ctx.lineTo(x + step - 3, floor.y);
    ctx.fill();
  }
}

function drawSpringFloor(ctx: CanvasRenderingContext2D, floor: Floor) {
  const squish = floor.charged ? 5 : 0;
  const cx = floor.x + floor.w / 2;
  ctx.strokeStyle = C.yellow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(floor.x + 16, floor.y + FLOOR_H);
  ctx.quadraticCurveTo(cx, floor.y - 10 + squish, floor.x + floor.w - 16, floor.y + FLOOR_H);
  ctx.stroke();
  ctx.strokeStyle = C.silverHi;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(floor.x + 22, floor.y + FLOOR_H - 1);
  ctx.quadraticCurveTo(cx, floor.y - 5 + squish, floor.x + floor.w - 22, floor.y + FLOOR_H - 1);
  ctx.stroke();
  drawBricks(ctx, floor.x, floor.y + squish, floor.w, FLOOR_H - squish, GREEN_PAL);
  ctx.fillStyle = C.yellowHi;
  ctx.fillRect(floor.x + 10, floor.y + squish, floor.w - 20, 2);
}

function drawConveyor(ctx: CanvasRenderingContext2D, floor: Floor, now: number) {
  const dir = floor.kind === 'convR' ? 1 : -1;
  ctx.fillStyle = C.silverInk;
  ctx.fillRect(floor.x - 1, floor.y, floor.w + 2, FLOOR_H);
  ctx.fillStyle = C.silver;
  ctx.fillRect(floor.x, floor.y, floor.w, FLOOR_H - 1);
  ctx.fillStyle = C.silverHi;
  ctx.fillRect(floor.x, floor.y, floor.w, 2);
  ctx.fillStyle = C.silverDark;
  ctx.fillRect(floor.x, floor.y + FLOOR_H - 3, floor.w, 3);

  ctx.fillStyle = '#1a1e24';
  ctx.fillRect(floor.x + 7, floor.y + 3, floor.w - 14, FLOOR_H - 6);

  const r = FLOOR_H / 2 - 0.5;
  drawRoller(ctx, floor.x + r, floor.y + FLOOR_H / 2, r);
  drawRoller(ctx, floor.x + floor.w - r, floor.y + FLOOR_H / 2, r);

  ctx.save();
  ctx.beginPath();
  ctx.rect(floor.x + 8, floor.y + 4, floor.w - 16, FLOOR_H - 8);
  ctx.clip();
  const pitch = 14;
  const off = ((now * 85 * dir) % pitch + pitch) % pitch;
  for (let x = floor.x - pitch + off; x < floor.x + floor.w + pitch; x += pitch) {
    ctx.beginPath();
    if (dir > 0) {
      ctx.moveTo(x, floor.y + 5);
      ctx.lineTo(x + 7, floor.y + FLOOR_H / 2);
      ctx.lineTo(x, floor.y + FLOOR_H - 5);
      ctx.lineTo(x + 2.5, floor.y + FLOOR_H / 2);
    } else {
      ctx.moveTo(x + 7, floor.y + 5);
      ctx.lineTo(x, floor.y + FLOOR_H / 2);
      ctx.lineTo(x + 7, floor.y + FLOOR_H - 5);
      ctx.lineTo(x + 4.5, floor.y + FLOOR_H / 2);
    }
    ctx.closePath();
    ctx.fillStyle = C.yellow;
    ctx.fill();
  }
  ctx.restore();
}

function drawRoller(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.silver;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = C.silverDark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 1, cy - 1, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = C.silverHi;
  ctx.fill();
}

function drawFragile(ctx: CanvasRenderingContext2D, floor: Floor) {
  ctx.globalAlpha = Math.max(0.25, floor.collapse * 0.85);
  drawBricks(ctx, floor.x, floor.y, floor.w, FLOOR_H, GRAY_PAL);
  ctx.strokeStyle = 'rgba(20,24,28,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(floor.x + 8, floor.y + 3);
  ctx.lineTo(floor.x + floor.w * 0.4, floor.y + 8);
  ctx.lineTo(floor.x + floor.w * 0.55, floor.y + 4);
  ctx.lineTo(floor.x + floor.w - 10, floor.y + 10);
  ctx.stroke();
}

function drawActor(ctx: CanvasRenderingContext2D, actor: Actor, set: SpriteSet | null) {
  if (actor.blink) return;
  if (!set || !set.idle.complete) {
    drawFallbackKid(ctx, actor);
    return;
  }
  const sheet = actor.anim === 'walk' ? set.walk : actor.anim === 'fall' ? set.fall : set.idle;
  const cols = 2;
  const cw = sheet.naturalWidth / cols;
  const ch = sheet.naturalHeight / 2;
  const col = actor.frame % 2;
  const row = Math.floor(actor.frame / 2);
  const dw = SPRITE_SIZE;
  const dh = SPRITE_SIZE + 6;
  const dx = actor.x + HERO_W / 2 - dw / 2;
  const dy = actor.y + HERO_H - dh + 4;
  ctx.save();
  if (actor.facing < 0) {
    ctx.translate(dx + dw / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + dw / 2), 0);
  }
  ctx.imageSmoothingEnabled = false;
  if (actor.id === 2) ctx.filter = 'hue-rotate(-52deg) saturate(1.4)';
  else if (actor.id === 3) ctx.filter = 'hue-rotate(228deg) saturate(1.25)';
  ctx.drawImage(sheet, col * cw, row * ch, cw, ch, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
  ctx.fillStyle = PLAYER_COLOR[actor.id] ?? PLAYER_COLOR[0];
  ctx.fillRect(actor.x + HERO_W / 2 - 4, actor.y - 4, 8, 3);
}

function drawFallbackKid(ctx: CanvasRenderingContext2D, actor: Actor) {
  const skins = ['#f0c56a', '#7ee08a', '#f08080', '#c9a0e8'];
  const shirts = ['#d4a03a', '#2f8a3e', '#c43a3a', '#7a3cb8'];
  const skin = skins[actor.id] ?? skins[0]!;
  const shirt = shirts[actor.id] ?? shirts[0]!;
  ctx.fillStyle = skin;
  ctx.fillRect(actor.x + 5, actor.y + 1, 12, 12);
  ctx.fillStyle = '#2a1c12';
  ctx.fillRect(actor.x + 5, actor.y + 1, 12, 4);
  ctx.fillStyle = shirt;
  ctx.fillRect(actor.x + 6, actor.y + 13, 10, 12);
  const swing = actor.anim === 'walk' ? (actor.frame % 2 === 0 ? 2 : -2) : 0;
  ctx.fillStyle = '#1c2430';
  ctx.fillRect(actor.x + 6, actor.y + 25, 4, 9 + swing);
  ctx.fillRect(actor.x + 12, actor.y + 25, 4, 9 - swing);
  ctx.fillStyle = PLAYER_COLOR[actor.id] ?? PLAYER_COLOR[0];
  ctx.fillRect(actor.x + HERO_W / 2 - 4, actor.y - 4, 8, 3);
}
