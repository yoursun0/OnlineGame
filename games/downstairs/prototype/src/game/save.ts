import type { Difficulty } from "./constants";

const KEY = "downshaft-save-v1";
const VERSION = 1;

export type ScoreRow = { name: string; floor: number; at: number };

export type SaveData = {
  version: number;
  best: Record<Difficulty, ScoreRow[]>;
  muted: boolean;
  lastDifficulty: Difficulty;
};

const empty = (): SaveData => ({
  version: VERSION,
  best: { easy: [], normal: [], hard: [] },
  muted: false,
  lastDifficulty: "normal",
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = empty();
    return {
      version: VERSION,
      muted: Boolean(parsed.muted),
      lastDifficulty: parsed.lastDifficulty === "easy" || parsed.lastDifficulty === "hard" ? parsed.lastDifficulty : "normal",
      best: {
        easy: Array.isArray(parsed.best?.easy) ? parsed.best!.easy.slice(0, 5) : [],
        normal: Array.isArray(parsed.best?.normal) ? parsed.best!.normal.slice(0, 5) : [],
        hard: Array.isArray(parsed.best?.hard) ? parsed.best!.hard.slice(0, 5) : [],
      },
    };
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
  } catch {
    /* private mode */
  }
}

export function recordScore(data: SaveData, d: Difficulty, floor: number, name = "YOU"): SaveData {
  const row: ScoreRow = { name, floor, at: Date.now() };
  const list = [...data.best[d], row].sort((a, b) => b.floor - a.floor).slice(0, 5);
  const next = { ...data, best: { ...data.best, [d]: list }, lastDifficulty: d };
  writeSave(next);
  return next;
}
