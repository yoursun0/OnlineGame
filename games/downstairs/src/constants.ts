export const STAGE_W = 360;
export const STAGE_H = 480;
export const SPIKE_H = 16;
export const WALL_W = 18;

export const HERO_W = 22;
export const HERO_H = 34;

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

export const WELL_CHECKPOINT_INTERVAL_MS = 5000;

export type Difficulty = 'easy' | 'normal' | 'hard';
export type FloorKind = 'normal' | 'spike' | 'convL' | 'convR' | 'spring' | 'fragile';
export type PlayMode = 'solo' | 'vs2' | 'vs3' | 'vs4';
export type WellFinishReason = 'hp' | 'fall' | 'quit';

export const FLOOR_KINDS: readonly FloorKind[] = ['normal', 'spike', 'convL', 'convR', 'spring', 'fragile'];

export const PLAYER_COLOR = ['#e0b03a', '#3db346', '#e24b4b', '#a85be8'] as const;

export function playModeForCount(count: number): PlayMode {
  if (count <= 1) return 'solo';
  if (count === 2) return 'vs2';
  if (count === 3) return 'vs3';
  return 'vs4';
}

export function isVersus(mode: PlayMode): boolean {
  return mode !== 'solo';
}

export function scrollSpeed(floor: number, d: Difficulty): number {
  if (d === 'easy') return 39 + floor * 0.36;
  if (d === 'hard') return 65 + floor * 0.84;
  return 53 + floor * 0.62;
}

export function spikeChance(_floor: number, d: Difficulty): number {
  if (d === 'hard') return 0.75;
  return 0.4;
}

export function isFloorKind(value: string): value is FloorKind {
  return (FLOOR_KINDS as readonly string[]).includes(value);
}
