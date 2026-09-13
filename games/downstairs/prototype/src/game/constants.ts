export const STAGE_W = 360;
export const STAGE_H = 480;
export const SPIKE_H = 16;
export const WALL_W = 18;

export const HERO_W = 22;
export const HERO_H = 34;
export const SPRITE_SIZE = 54;

export const FLOOR_H = 14;
export const FLOOR_W = 108;
export const FLOOR_GAP = 76;

export const MAX_LIFE = 12;
export const SPIKE_DMG = 5;
export const HEAL = 1;
export const INVULN = 1.05;

export const GRAVITY = 1120;
export const TERMINAL = 313;
export const MOVE_SPEED = 99;
export const CONV_SPEED = 47;
export const SPRING_V = -455;

export const STEP = 1 / 120;
export const MAX_FRAME_DT = 0.1;

export type Difficulty = "easy" | "normal" | "hard";
export type FloorKind = "normal" | "spike" | "convL" | "convR" | "spring" | "fragile";
export type GamePhase = "menu" | "how" | "playing" | "paused" | "over";
export type PlayMode = "solo" | "vs2" | "vs3" | "vs4";
export type PlayerId = 0 | 1 | 2 | 3;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "簡單",
  normal: "普通",
  hard: "困難",
};

export const MODE_LABEL: Record<PlayMode, string> = {
  solo: "單人挑戰",
  vs2: "雙人對戰",
  vs3: "三人對戰",
  vs4: "四人對戰",
};

export const PLAYER_NAME = ["黃帽 P1", "綠帽 P2", "紅帽 P3", "紫帽 P4"] as const;
export const PLAYER_COLOR = ["#e0b03a", "#3db346", "#e24b4b", "#a85be8"] as const;

export function playerCount(mode: PlayMode): number {
  if (mode === "solo") return 1;
  if (mode === "vs2") return 2;
  if (mode === "vs3") return 3;
  return 4;
}

export function isVersus(mode: PlayMode): boolean {
  return mode !== "solo";
}

export function scrollSpeed(floor: number, d: Difficulty): number {
  if (d === "easy") return 39 + floor * 0.36;
  if (d === "hard") return 65 + floor * 0.84;
  return 53 + floor * 0.62;
}

export function spikeChance(_floor: number, d: Difficulty): number {
  if (d === "hard") return 0.75;
  return 0.4;
}
