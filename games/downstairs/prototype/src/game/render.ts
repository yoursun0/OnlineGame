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
} from "./constants";
import type { GameAssets, SpriteSet } from "./assets";
import { spriteFor } from "./assets";
import type { Actor, Engine, Floor } from "./engine";

const C = {
  void: "#07090d",
  wallDeep: "#16324c",
  wallMid: "#2f7eb8",
  wallLite: "#6ec4ea",
  wallGrout: "#0d2236",
  greenDeep: "#1a5a28",
  greenMid: "#3db346",
  greenLite: "#7eec6a",
  greenHi: "#c8ff9a",
  greenGrout: "#0e3018",
  silverHi: "#e8eef4",
  silver: "#b7c2cc",
  silverMid: "#7e8b98",
  silverDark: "#3d4652",
  silverInk: "#1c222a",
  yellow: "#f0c42a",
  yellowHi: "#ffe56a",
  yellowDeep: "#b8860a",
  spike: "#dfe6ee",
  spikeCore: "#9aa3ad",
};

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  assets: GameAssets | null,
  now: number,
) {
  const shakeX = engine.shake > 0 ? Math.sin(now * 58) * 3.2 * (engine.shake / 0.28) : 0;
  const shakeY = engine.shake > 0 ? Math.cos(now * 47) * 2.2 * (engine.shake / 0.28) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);

  ctx.translate(shakeX, shakeY);
  drawBg(ctx, engine.scroll);
  drawCeiling(ctx);
  for (const f of engine.floors) drawFloor(ctx, f, engine.time);
  for (const p of engine.players) {
    if (!p.alive) continue;
    drawActor(ctx, p, spriteFor(assets, p.id));
  }
  for (const q of engine.particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, q.size, q.size);
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
  grout: "#2a3038",
  mid: "#7a848e",
  lite: "#c5ced6",
  deep: "#4a545e",
};

function drawBg(ctx: CanvasRenderingContext2D, scroll: number) {
  ctx.fillStyle = "#0c3a78";
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  for (let i = 0; i < 36; i++) {
    const gy = ((i * 47 + scroll * 0.45) % (STAGE_H + 90)) - 45;
    const gx = WALL_W + 16 + ((i * 89) % (STAGE_W - WALL_W * 2 - 32));
    ctx.fillStyle = i % 3 === 0 ? "#1a64b4" : i % 3 === 1 ? "#0a2e62" : "#145498";
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
  ctx.fillStyle = C.silver;
  ctx.fillRect(0, 0, STAGE_W, 2);
}

function drawFloor(ctx: CanvasRenderingContext2D, f: Floor, now: number) {
  if (f.y >= STAGE_H || f.y + FLOOR_H < 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.18, f.collapse);

  if (f.kind === "spike") drawSpikeFloor(ctx, f);
  else if (f.kind === "spring") drawSpringFloor(ctx, f);
  else if (f.kind === "convL" || f.kind === "convR") drawConveyor(ctx, f, now);
  else if (f.kind === "fragile") drawFragile(ctx, f);
  else drawBricks(ctx, f.x, f.y, f.w, FLOOR_H, WALL_PAL);

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
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = pal.grout;
  ctx.fillRect(x, y + h - 1, w, 1);
}

function drawSpikeFloor(ctx: CanvasRenderingContext2D, f: Floor) {
  drawBricks(ctx, f.x, f.y, f.w, FLOOR_H, WALL_PAL);
  const n = Math.max(5, Math.round(f.w / 12));
  const step = f.w / n;
  for (let i = 0; i < n; i++) {
    const x = f.x + i * step;
    ctx.beginPath();
    ctx.moveTo(x + 1, f.y);
    ctx.lineTo(x + step / 2, f.y - 11);
    ctx.lineTo(x + step - 1, f.y);
    ctx.closePath();
    ctx.fillStyle = C.spike;
    ctx.fill();
    ctx.fillStyle = C.spikeCore;
    ctx.beginPath();
    ctx.moveTo(x + 3, f.y);
    ctx.lineTo(x + step / 2, f.y - 7);
    ctx.lineTo(x + step - 3, f.y);
    ctx.fill();
  }
}

function drawSpringFloor(ctx: CanvasRenderingContext2D, f: Floor) {
  const squish = f.charged ? 5 : 0;
  const cx = f.x + f.w / 2;
  ctx.strokeStyle = C.yellow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(f.x + 16, f.y + FLOOR_H);
  ctx.quadraticCurveTo(cx, f.y - 10 + squish, f.x + f.w - 16, f.y + FLOOR_H);
  ctx.stroke();
  ctx.strokeStyle = C.silverHi;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(f.x + 22, f.y + FLOOR_H - 1);
  ctx.quadraticCurveTo(cx, f.y - 5 + squish, f.x + f.w - 22, f.y + FLOOR_H - 1);
  ctx.stroke();
  drawBricks(ctx, f.x, f.y + squish, f.w, FLOOR_H - squish, GREEN_PAL);
  ctx.fillStyle = C.yellowHi;
  ctx.fillRect(f.x + 10, f.y + squish, f.w - 20, 2);
}

function drawConveyor(ctx: CanvasRenderingContext2D, f: Floor, now: number) {
  const dir = f.kind === "convR" ? 1 : -1;
  ctx.fillStyle = C.silverInk;
  ctx.fillRect(f.x - 1, f.y, f.w + 2, FLOOR_H);
  ctx.fillStyle = C.silver;
  ctx.fillRect(f.x, f.y, f.w, FLOOR_H - 1);
  ctx.fillStyle = C.silverHi;
  ctx.fillRect(f.x, f.y, f.w, 2);
  ctx.fillStyle = C.silverDark;
  ctx.fillRect(f.x, f.y + FLOOR_H - 3, f.w, 3);

  ctx.fillStyle = "#1a1e24";
  ctx.fillRect(f.x + 7, f.y + 3, f.w - 14, FLOOR_H - 6);

  const r = FLOOR_H / 2 - 0.5;
  drawRoller(ctx, f.x + r, f.y + FLOOR_H / 2, r);
  drawRoller(ctx, f.x + f.w - r, f.y + FLOOR_H / 2, r);

  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x + 8, f.y + 4, f.w - 16, FLOOR_H - 8);
  ctx.clip();
  const pitch = 14;
  const off = ((now * 85 * dir) % pitch + pitch) % pitch;
  for (let x = f.x - pitch + off; x < f.x + f.w + pitch; x += pitch) {
    ctx.beginPath();
    if (dir > 0) {
      ctx.moveTo(x, f.y + 5);
      ctx.lineTo(x + 7, f.y + FLOOR_H / 2);
      ctx.lineTo(x, f.y + FLOOR_H - 5);
      ctx.lineTo(x + 2.5, f.y + FLOOR_H / 2);
    } else {
      ctx.moveTo(x + 7, f.y + 5);
      ctx.lineTo(x, f.y + FLOOR_H / 2);
      ctx.lineTo(x + 7, f.y + FLOOR_H - 5);
      ctx.lineTo(x + 4.5, f.y + FLOOR_H / 2);
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

function drawFragile(ctx: CanvasRenderingContext2D, f: Floor) {
  ctx.globalAlpha = Math.max(0.25, f.collapse * 0.85);
  drawBricks(ctx, f.x, f.y, f.w, FLOOR_H, GRAY_PAL);
  ctx.strokeStyle = "rgba(20,24,28,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(f.x + 8, f.y + 3);
  ctx.lineTo(f.x + f.w * 0.4, f.y + 8);
  ctx.lineTo(f.x + f.w * 0.55, f.y + 4);
  ctx.lineTo(f.x + f.w - 10, f.y + 10);
  ctx.stroke();
}

function drawActor(ctx: CanvasRenderingContext2D, p: Actor, set: SpriteSet | null) {
  if (p.blink) return;
  if (!set || !set.idle.complete) {
    drawFallbackKid(ctx, p);
    return;
  }
  const sheet = p.anim === "walk" ? set.walk : p.anim === "fall" ? set.fall : set.idle;
  const cols = 2;
  const cw = sheet.naturalWidth / cols;
  const ch = sheet.naturalHeight / 2;
  const col = p.frame % 2;
  const row = Math.floor(p.frame / 2);
  const dw = SPRITE_SIZE;
  const dh = SPRITE_SIZE + 6;
  const dx = p.x + HERO_W / 2 - dw / 2;
  const dy = p.y + HERO_H - dh + 4;
  ctx.save();
  if (p.facing < 0) {
    ctx.translate(dx + dw / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + dw / 2), 0);
  }
  ctx.imageSmoothingEnabled = false;
  if (p.id === 2) ctx.filter = "hue-rotate(-52deg) saturate(1.4)";
  else if (p.id === 3) ctx.filter = "hue-rotate(228deg) saturate(1.25)";
  ctx.drawImage(sheet, col * cw, row * ch, cw, ch, dx, dy, dw, dh);
  ctx.filter = "none";
  ctx.restore();
  ctx.fillStyle = PLAYER_COLOR[p.id] ?? PLAYER_COLOR[0];
  ctx.fillRect(p.x + HERO_W / 2 - 4, p.y - 4, 8, 3);
  if (!p.alive) {
    ctx.fillStyle = "rgba(196,92,74,0.35)";
    ctx.fillRect(p.x, p.y, HERO_W, HERO_H);
  }
}

function drawFallbackKid(ctx: CanvasRenderingContext2D, p: Actor) {
  const skins = ["#f0c56a", "#7ee08a", "#f08080", "#c9a0e8"];
  const shirts = ["#d4a03a", "#2f8a3e", "#c43a3a", "#7a3cb8"];
  const skin = skins[p.id] ?? skins[0]!;
  const shirt = shirts[p.id] ?? shirts[0]!;
  ctx.fillStyle = skin;
  ctx.fillRect(p.x + 5, p.y + 1, 12, 12);
  ctx.fillStyle = "#2a1c12";
  ctx.fillRect(p.x + 5, p.y + 1, 12, 4);
  ctx.fillStyle = shirt;
  ctx.fillRect(p.x + 6, p.y + 13, 10, 12);
  const swing = p.anim === "walk" ? (p.frame % 2 === 0 ? 2 : -2) : 0;
  ctx.fillStyle = "#1c2430";
  ctx.fillRect(p.x + 6, p.y + 25, 4, 9 + swing);
  ctx.fillRect(p.x + 12, p.y + 25, 4, 9 - swing);
  if (!p.alive) {
    ctx.fillStyle = "rgba(196,92,74,0.35)";
    ctx.fillRect(p.x, p.y, HERO_W, HERO_H);
  }
}
