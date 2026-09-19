import {
  CONV_SPEED,
  FLOOR_GAP,
  FLOOR_H,
  FLOOR_W,
  GRAVITY,
  HEAL,
  HERO_H,
  HERO_W,
  INVULN,
  MAX_LIFE,
  MOVE_SPEED,
  SPIKE_DMG,
  SPIKE_H,
  SPRING_V,
  STAGE_H,
  STAGE_W,
  TERMINAL,
  WALL_W,
  type Difficulty,
  type FloorKind,
  type PlayMode,
  type PlayerId,
  isVersus,
  playModeForCount,
  playerCount,
  scrollSpeed,
  spikeChance,
} from './constants';
import type { RestorableWell } from './state';

export type TrapFlags = {
  conveyor: boolean;
  spring: boolean;
  fragile: boolean;
};

export type Floor = {
  id: number;
  x: number;
  y: number;
  w: number;
  kind: FloorKind;
  collapse: number;
  collapsing: boolean;
  springT: number;
  charged: boolean;
};

export type Actor = {
  id: PlayerId;
  guestId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: -1 | 0 | 1;
  facing: 1 | -1;
  life: number;
  invuln: number;
  ceilIFrame: number;
  healFloor: number;
  blink: boolean;
  onFloor: Floor | null;
  onPlayer: Actor | null;
  best: number;
  alive: boolean;
  death: "hp" | "fall" | null;
  diedAt: number;
  anim: "idle" | "walk" | "fall";
  frame: number;
  frameT: number;
  prevX: number;
  prevY: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

export type EngineConfig = {
  mode: PlayMode;
  difficulty: Difficulty;
  traps: TrapFlags;
};

export class Engine {
  mode: PlayMode = "solo";
  difficulty: Difficulty = "normal";
  traps: TrapFlags = { conveyor: true, spring: true, fragile: true };
  players: Actor[] = [];
  floors: Floor[] = [];
  particles: Particle[] = [];
  time = 0;
  floorIndex = 0;
  depth = 0;
  shake = 0;
  scroll = 0;
  running = false;
  over = false;
  winner: PlayerId | null = null;
  touch: (-1 | 0 | 1)[] = [0, 0, 0, 0];
  keys = new Set<string>();
  /** When true, dirs come from setIntent (online Shared well), not local hot-seat keys. */
  intentDriven = false;
  private nextId = 1;
  private lastY = 0;
  private events: { land: boolean; hurt: boolean; spring: boolean; death: boolean } = {
    land: false,
    hurt: false,
    spring: false,
    death: false,
  };

  start(cfg: EngineConfig, guestIds: string[]) {
    this.mode = cfg.mode;
    this.difficulty = cfg.difficulty;
    this.traps = cfg.traps;
    this.time = 0;
    this.floorIndex = 0;
    this.depth = 0;
    this.shake = 0;
    this.scroll = 0;
    this.running = true;
    this.over = false;
    this.winner = null;
    this.nextId = 0;
    this.floors = [];
    this.particles = [];
    this.spawnStartFloors();
    const base = this.floors[0]!;
    const n = playerCount(this.mode);
    if (guestIds.length !== n) {
      throw new Error(`Expected ${n} guest id(s) for mode ${this.mode}.`);
    }
    const span = Math.max(1, base.w - 10 - HERO_W);
    this.players = [];
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? base.x + 12 : base.x + 5 + (span * i) / (n - 1);
      this.players.push(this.makeActor(i as PlayerId, guestIds[i]!, x, base.y - HERO_H));
    }
    this.players.forEach((p) => {
      p.onFloor = base;
    });
    this.intentDriven = n > 1;
  }

  /** Solo host intent: left / right / none. */
  setSoloIntent(direction: 'left' | 'right' | 'none') {
    const p = this.players[0];
    if (p) this.setIntent(p.guestId, direction);
  }

  /** Apply a guest Intent to that kid. Shared wells use this instead of hot-seat keys. */
  setIntent(guestId: string, direction: 'left' | 'right' | 'none') {
    const p = this.players.find((player) => player.guestId === guestId);
    if (!p || !p.alive) return;
    if (direction === 'left') {
      p.dir = -1;
      p.facing = -1;
      this.touch[p.id] = -1;
    } else if (direction === 'right') {
      p.dir = 1;
      p.facing = 1;
      this.touch[p.id] = 1;
    } else {
      p.dir = 0;
      this.touch[p.id] = 0;
    }
  }

  /** Non-host left the well. Last kid standing may win. */
  leaveKid(guestId: string) {
    const p = this.players.find((player) => player.guestId === guestId);
    if (!p || !p.alive) return false;
    this.kill(p, 'hp');
    this.checkOver();
    return true;
  }

  quit() {
    const live = this.players.filter((p) => p.alive);
    for (const p of live) this.kill(p, 'hp');
    this.running = false;
    this.over = true;
  }

  consumeEvents() {
    const e = { ...this.events };
    this.events.land = false;
    this.events.hurt = false;
    this.events.spring = false;
    this.events.death = false;
    return e;
  }

  setKey(code: string, down: boolean) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  clearKeys() {
    this.keys.clear();
    this.touch = [0, 0, 0, 0];
  }

  step(dt: number) {
    if (!this.running) return;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.readInput();
    this.scrollWorld(dt);
    for (const p of this.players) {
      if (!p.alive) continue;
      this.stepPlayer(p, dt);
    }
    this.resolveRiders();
    if (isVersus(this.mode)) this.bump();
    this.stepFloors(dt);
    this.stepParticles(dt);
    this.maintainFloors();
    this.checkOver();
  }

  private makeActor(id: PlayerId, guestId: string, x: number, y: number): Actor {
    return {
      id,
      guestId,
      x,
      y,
      vx: 0,
      vy: 0,
      dir: 0,
      facing: id % 2 === 0 ? 1 : -1,
      life: MAX_LIFE,
      invuln: 0,
      ceilIFrame: 0,
      healFloor: 0,
      blink: false,
      onFloor: null,
      onPlayer: null,
      best: 0,
      alive: true,
      death: null,
      diedAt: 0,
      anim: "idle",
      frame: 0,
      frameT: 0,
      prevX: x,
      prevY: y,
    };
  }

  private spawnStartFloors() {
    const y0 = 168;
    this.floors.push({
      id: this.nextId++,
      x: Math.floor((STAGE_W - FLOOR_W) / 2),
      y: y0,
      w: FLOOR_W,
      kind: "normal",
      collapse: 1,
      collapsing: false,
      springT: 0,
      charged: false,
    });
    this.lastY = y0;
    while (this.lastY + FLOOR_GAP < STAGE_H) this.spawnFloor();
  }

  private spawnFloor() {
    this.lastY += FLOOR_GAP;
    this.floorIndex += 1;
    const w = FLOOR_W;
    const x = WALL_W + Math.random() * (STAGE_W - WALL_W * 2 - w);
    const kind = this.floorIndex <= 3 ? "normal" : this.pickKind(this.floorIndex);
    this.floors.push({
      id: this.nextId++,
      x,
      y: this.lastY,
      w,
      kind,
      collapse: 1,
      collapsing: false,
      springT: 0,
      charged: false,
    });
  }

  private pickKind(index: number): FloorKind {
    if (index === 4 && this.traps.conveyor) return Math.random() < 0.5 ? "convR" : "convL";
    const r = Math.random();
    const spike = spikeChance(index, this.difficulty);
    if (r < spike) return "spike";
    let pool: FloorKind[] = ["normal", "normal", "normal"];
    if (this.traps.fragile) pool.push("fragile");
    if (this.traps.conveyor) pool = pool.concat(["convL", "convR"]);
    if (this.traps.spring) pool.push("spring");
    if (index < 4) return "normal";
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  private readInput() {
    if (this.intentDriven) return;
    const p = this.players;
    this.setDir(
      p[0],
      this.keys.has("ArrowLeft") ||
        (this.mode === "solo" && (this.keys.has("KeyA") || this.keys.has("KeyZ"))) ||
        this.touch[0] < 0,
      this.keys.has("ArrowRight") ||
        (this.mode === "solo" && (this.keys.has("KeyD") || this.keys.has("KeyX"))) ||
        this.touch[0] > 0,
    );
    this.setDir(
      p[1],
      this.keys.has("KeyA") || this.keys.has("KeyZ") || this.touch[1] < 0,
      this.keys.has("KeyD") || this.keys.has("KeyX") || this.touch[1] > 0,
    );
    this.setDir(
      p[2],
      this.keys.has("KeyV") || this.touch[2] < 0,
      this.keys.has("KeyB") || this.touch[2] > 0,
    );
    this.setDir(
      p[3],
      this.keys.has("Comma") || this.touch[3] < 0,
      this.keys.has("Period") || this.touch[3] > 0,
    );
  }

  private setDir(p: Actor | undefined, left: boolean, right: boolean) {
    if (!p || !p.alive) return;
    if (left && !right) p.dir = -1;
    else if (right && !left) p.dir = 1;
    else p.dir = 0;
    if (p.dir !== 0) p.facing = p.dir;
  }

  private scrollWorld(dt: number) {
    const speed = scrollSpeed(this.depth, this.difficulty);
    this.scroll += speed * dt;
    const dy = speed * dt;
    for (const f of this.floors) f.y -= dy;
    this.lastY -= dy;
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.onFloor) p.y -= dy;
    }
  }

  private stepPlayer(p: Actor, dt: number) {
    p.prevX = p.x;
    p.prevY = p.y;
    p.invuln = Math.max(0, p.invuln - dt);
    p.ceilIFrame = Math.max(0, p.ceilIFrame - dt);
    p.blink = p.invuln > 0 && Math.floor(this.time * 12) % 2 === 0;

    if (p.onPlayer && (!p.onPlayer.alive || this.headOverlap(p, p.onPlayer) < 2)) {
      p.onPlayer = null;
    }

    let conv = 0;
    if (p.onFloor && !p.onPlayer) {
      if (p.onFloor.kind === "convL") conv = -CONV_SPEED;
      if (p.onFloor.kind === "convR") conv = CONV_SPEED;
    }
    p.vx = p.dir * MOVE_SPEED + conv;
    p.x += p.vx * dt;
    if (p.x < WALL_W) p.x = WALL_W;
    if (p.x > STAGE_W - WALL_W - HERO_W) p.x = STAGE_W - WALL_W - HERO_W;

    if (p.onPlayer) {
      p.vy = 0;
    } else if (p.onFloor) {
      const f = p.onFloor;
      const on = p.x + HERO_W > f.x + 2 && p.x < f.x + f.w - 2 && f.collapse > 0.15 && f.y < STAGE_H;
      if (!on) {
        p.onFloor = null;
      } else {
        p.y = f.y - HERO_H;
        p.vy = 0;
      }
    }

    if (!p.onFloor && !p.onPlayer) {
      p.vy = Math.min(TERMINAL, p.vy + GRAVITY * dt);
      p.y += p.vy * dt;
      this.tryLandOnPlayers(p);
      if (!p.onPlayer) this.tryLand(p);
    }

    if (p.y < SPIKE_H - 2) {
      p.y = SPIKE_H - 2;
      p.vy = 160;
      p.onFloor = null;
      p.onPlayer = null;
      if (p.ceilIFrame <= 0) {
        p.ceilIFrame = 0.45;
        this.hit(p, SPIKE_DMG);
        this.burst(p.x + HERO_W / 2, SPIKE_H + 4, "#c45c4a", 10);
      }
    }

    if (p.y + HERO_H >= STAGE_H) {
      this.kill(p, "fall");
    }

    this.animate(p, dt);
  }

  private tryLand(p: Actor) {
    if (p.vy < 0) return;
    const prevBottom = p.prevY + HERO_H;
    const bottom = p.y + HERO_H;
    if (bottom >= STAGE_H) return;
    for (const f of this.floors) {
      if (f.collapse <= 0.2) continue;
      if (f.y >= STAGE_H) continue;
      if (bottom < f.y - 8 || prevBottom > f.y + 10) continue;
      if (p.x + HERO_W <= f.x + 1 || p.x >= f.x + f.w - 1) continue;
      if (prevBottom <= f.y + 6 && bottom >= f.y) {
        p.y = f.y - HERO_H;
        p.vy = 0;
        p.onFloor = f;
        p.onPlayer = null;
        if (f.id > p.best) {
          p.best = f.id;
          this.depth = Math.max(this.depth, f.id);
        }
        this.onLand(p, f);
        break;
      }
    }
  }

  private tryLandOnPlayers(p: Actor) {
    if (p.vy < 0) return;
    const prevBottom = p.prevY + HERO_H;
    const bottom = p.y + HERO_H;
    for (const host of this.players) {
      if (host === p || !host.alive) continue;
      if (!host.onFloor && !host.onPlayer) continue;
      if (this.riding(host, p)) continue;
      const head = host.y;
      if (bottom < head - 8 || prevBottom > head + 10) continue;
      if (this.headOverlap(p, host) < 6) continue;
      if (prevBottom <= head + 6 && bottom >= head) {
        p.onPlayer = host;
        p.onFloor = null;
        p.vy = 0;
        p.y = host.y - HERO_H;
        this.events.land = true;
        this.burst(p.x + HERO_W / 2, head, "#9ad0ea", 5);
        break;
      }
    }
  }

  private headOverlap(a: Actor, b: Actor) {
    return Math.min(a.x + HERO_W, b.x + HERO_W) - Math.max(a.x, b.x);
  }

  private riding(rider: Actor, host: Actor) {
    let s: Actor | null = rider;
    let n = 0;
    while (s && s.onPlayer && n++ < 8) {
      if (s.onPlayer === host) return true;
      s = s.onPlayer;
    }
    return false;
  }

  private resolveRiders() {
    const riders = this.players.filter((p) => p.alive && p.onPlayer);
    riders.sort((a, b) => this.stackDepth(a) - this.stackDepth(b));
    for (const p of riders) {
      const host = p.onPlayer;
      if (!host || !host.alive) {
        p.onPlayer = null;
        continue;
      }
      if (this.headOverlap(p, host) < 2) {
        p.onPlayer = null;
        continue;
      }
      p.x += host.x - host.prevX;
      if (p.x < WALL_W) p.x = WALL_W;
      if (p.x > STAGE_W - WALL_W - HERO_W) p.x = STAGE_W - WALL_W - HERO_W;
      p.y = host.y - HERO_H;
      p.vy = 0;
      p.onFloor = null;
    }
  }

  private stackDepth(p: Actor) {
    let n = 0;
    let s: Actor | null = p;
    while (s && s.onPlayer && n < 8) {
      n += 1;
      s = s.onPlayer;
    }
    return n;
  }

  private onLand(p: Actor, f: Floor) {
    this.events.land = true;
    this.burst(p.x + HERO_W / 2, f.y, "#9ad0ea", 6);
    if (f.kind === "spike") {
      this.hurt(p, SPIKE_DMG);
      this.burst(p.x + HERO_W / 2, f.y, "#e06b5c", 12);
    } else if (f.id > p.healFloor && p.invuln <= 0 && p.life < MAX_LIFE) {
      p.healFloor = f.id;
      p.life = Math.min(MAX_LIFE, p.life + HEAL);
    } else if (f.id > p.healFloor) {
      p.healFloor = f.id;
    }
    if (f.kind === "fragile") f.collapsing = true;
    if (f.kind === "spring") {
      f.charged = true;
      f.springT = 0;
    }
  }

  private hit(p: Actor, amount: number) {
    if (!p.alive) return;
    p.life -= amount;
    p.invuln = INVULN;
    this.shake = 0.28;
    this.events.hurt = true;
    if (p.life <= 0) this.kill(p, "hp");
  }

  private hurt(p: Actor, amount: number) {
    if (p.invuln > 0 || !p.alive) return;
    this.hit(p, amount);
  }

  private kill(p: Actor, why: "hp" | "fall") {
    if (!p.alive) return;
    p.alive = false;
    p.death = why;
    p.diedAt = this.time;
    p.life = 0;
    p.onFloor = null;
    p.onPlayer = null;
    for (const o of this.players) {
      if (o.onPlayer === p) o.onPlayer = null;
    }
    this.events.death = true;
    this.shake = 0.4;
    this.burst(p.x + HERO_W / 2, p.y + HERO_H / 2, "#c45c4a", 18);
  }

  private bump() {
    const live = this.players.filter((p) => p.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        this.bumpPair(live[i]!, live[j]!);
      }
    }
  }

  private bumpPair(a: Actor, b: Actor) {
    if (this.riding(a, b) || this.riding(b, a)) return;
    if (a.x + HERO_W <= b.x || b.x + HERO_W <= a.x) return;
    if (a.y + HERO_H <= b.y + 4 || b.y + HERO_H <= a.y + 4) return;
    const overlap = a.x + HERO_W / 2 < b.x + HERO_W / 2
      ? a.x + HERO_W - b.x
      : b.x + HERO_W - a.x;
    const push = Math.min(overlap / 2 + 0.5, 6);
    if (a.x + HERO_W / 2 <= b.x + HERO_W / 2) {
      a.x -= push;
      b.x += push;
    } else {
      a.x += push;
      b.x -= push;
    }
    a.x = Math.max(WALL_W, Math.min(STAGE_W - WALL_W - HERO_W, a.x));
    b.x = Math.max(WALL_W, Math.min(STAGE_W - WALL_W - HERO_W, b.x));
  }

  private stepFloors(dt: number) {
    for (const f of this.floors) {
      if (f.collapsing) {
        f.collapse = Math.max(0, f.collapse - dt * 2.4);
        if (f.collapse <= 0) {
          for (const p of this.players) if (p.onFloor === f) p.onFloor = null;
        }
      }
      if (f.charged) {
        f.springT += dt;
        if (f.springT > 0.09) {
          for (const p of this.players) {
            if (p.onFloor === f && p.alive) {
              p.vy = SPRING_V;
              p.onFloor = null;
              this.events.spring = true;
            }
          }
          f.charged = false;
          f.springT = 0;
        }
      }
    }
  }

  private maintainFloors() {
    this.floors = this.floors.filter((f) => f.y > -FLOOR_H && f.collapse > 0);
    while (this.lastY + FLOOR_GAP < STAGE_H) this.spawnFloor();
  }

  private checkOver() {
    const live = this.players.filter((p) => p.alive);
    if (!isVersus(this.mode)) {
      if (live.length > 0) return;
      this.running = false;
      this.over = true;
      return;
    }
    if (live.length > 1) return;
    this.running = false;
    this.over = true;
    if (live.length === 1) {
      this.winner = live[0]!.id;
      return;
    }
    let best = this.players[0]!;
    let tie = false;
    for (const p of this.players.slice(1)) {
      if (p.diedAt > best.diedAt) {
        best = p;
        tie = false;
      } else if (p.diedAt === best.diedAt) {
        tie = true;
      }
    }
    this.winner = tie ? null : best.id;
  }

  private animate(p: Actor, dt: number) {
    if (!p.onFloor && !p.onPlayer) p.anim = "fall";
    else if (p.dir !== 0) p.anim = "walk";
    else p.anim = "idle";
    const rate = p.anim === "walk" ? 0.09 : p.anim === "fall" ? 0.11 : 0.18;
    p.frameT += dt;
    if (p.frameT >= rate) {
      p.frameT = 0;
      p.frame = (p.frame + 1) % 4;
    }
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life: 0.28 + Math.random() * 0.25,
        max: 0.5,
        size: 1.5 + Math.random() * 2,
        color,
      });
    }
  }

  private stepParticles(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 420 * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  toRestorableWell(): RestorableWell {
    return {
      clock: this.time,
      depth: this.depth,
      floorIndex: this.floorIndex,
      lastY: this.lastY,
      nextId: this.nextId,
      scroll: this.scroll,
      over: this.over,
      kids: this.players.map((p) => ({
        guestId: p.guestId,
        x: p.x,
        y: p.y,
        life: p.life,
        alive: p.alive,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        invuln: p.invuln,
        ceilIFrame: p.ceilIFrame,
        healFloor: p.healFloor,
        best: p.best,
        death: p.death,
        anim: p.anim,
        frame: p.frame,
      })),
      stairs: this.floors.map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        w: f.w,
        kind: f.kind,
        collapse: f.collapse,
        collapsing: f.collapsing,
        springT: f.springT,
        charged: f.charged,
      })),
    };
  }

  restoreFromWell(well: RestorableWell, cfg?: EngineConfig) {
    const resolved: EngineConfig = cfg ?? {
      mode: playModeForCount(well.kids.length),
      difficulty: 'normal',
      traps: { conveyor: true, spring: true, fragile: true },
    };
    this.mode = resolved.mode;
    this.difficulty = resolved.difficulty;
    this.traps = resolved.traps;
    this.intentDriven = well.kids.length > 1;
    this.time = well.clock;
    this.depth = well.depth ?? 0;
    this.floorIndex = well.floorIndex ?? well.stairs.length;
    this.lastY = well.lastY ?? Math.max(...well.stairs.map((s) => s.y));
    this.nextId = well.nextId ?? (Math.max(...well.stairs.map((s) => s.id)) + 1);
    this.scroll = well.scroll ?? 0;
    this.shake = 0;
    this.particles = [];
    this.over = Boolean(well.over);
    this.running = !this.over;
    this.winner = null;
    this.floors = well.stairs.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      w: s.w,
      kind: (s.kind as FloorKind),
      collapse: s.collapse ?? 1,
      collapsing: Boolean(s.collapsing),
      springT: s.springT ?? 0,
      charged: Boolean(s.charged),
    }));
    this.players = well.kids.map((kid, index) => {
      const actor = this.makeActor(index as PlayerId, kid.guestId, kid.x, kid.y);
      actor.life = kid.life;
      actor.alive = kid.alive;
      actor.vx = kid.vx ?? 0;
      actor.vy = kid.vy ?? 0;
      actor.facing = kid.facing === -1 ? -1 : 1;
      actor.invuln = kid.invuln ?? 0;
      actor.ceilIFrame = kid.ceilIFrame ?? 0;
      actor.healFloor = kid.healFloor ?? 0;
      actor.best = kid.best ?? 0;
      actor.death = kid.death ?? null;
      actor.anim = kid.anim ?? 'idle';
      actor.frame = kid.frame ?? 0;
      const floor = this.floors.find((f) => Math.abs(f.y - (kid.y + HERO_H)) < 1.5
        && kid.x + HERO_W > f.x && kid.x < f.x + f.w);
      actor.onFloor = kid.alive ? floor ?? null : null;
      return actor;
    });
  }
}
