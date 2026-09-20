/** Soft human-turn deadline. Warn-only: the table waits; no automatic move. */
export const TGW_HUMAN_TURN_MS = 75_000;

export type TienGowTurnKind = 'idle' | 'cpu' | 'human';
export type TienGowTurnClockPhase = 'idle' | 'counting' | 'warn';

export type TienGowTurnMember = { seat: number; is_cpu?: boolean };

export function tienGowTurnActor(
  phase: string,
  toAct: number,
  members: readonly TienGowTurnMember[],
): { kind: TienGowTurnKind; seat: number } {
  if (phase === 'recap') return { kind: 'idle', seat: toAct };
  const member = members.find((candidate) => candidate.seat === toAct);
  if (!member) return { kind: 'idle', seat: toAct };
  if (member.is_cpu) return { kind: 'cpu', seat: toAct };
  return { kind: 'human', seat: toAct };
}

export function tienGowTurnClockKey(input: {
  phase: string;
  toAct: number;
  playCount: number;
}): string {
  return `${input.phase}:${input.toAct}:${input.playCount}`;
}

export function tienGowTurnClockState(input: {
  kind: TienGowTurnKind;
  now: number;
  startedAt: number;
  durationMs?: number;
}): TienGowTurnClockPhase {
  if (input.kind !== 'human') return 'idle';
  const duration = input.durationMs ?? TGW_HUMAN_TURN_MS;
  return input.now - input.startedAt >= duration ? 'warn' : 'counting';
}

export function tienGowTurnRemainingMs(
  now: number,
  startedAt: number,
  durationMs = TGW_HUMAN_TURN_MS,
): number {
  return Math.max(0, durationMs - (now - startedAt));
}

export function formatTienGowTurnRemaining(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function tienGowTurnClockCopy(input: {
  language: 'en' | 'zh-Hant';
  clock: TienGowTurnClockPhase;
  kind: TienGowTurnKind;
  wind: string;
  isOwnTurn: boolean;
  isHost: boolean;
}): { toast: string | null; nudge: string | null } {
  if (input.kind !== 'human' || input.clock !== 'warn') return { toast: null, nudge: null };
  const zh = input.language === 'zh-Hant';
  if (input.isOwnTurn) {
    return {
      toast: zh ? '仍輪到你出牌 — 牌桌在等你。' : 'Still your turn — the table is waiting.',
      nudge: null,
    };
  }
  if (input.isHost) {
    return {
      toast: null,
      nudge: zh
        ? `${input.wind}已超過出牌時限，仍可出牌（不會代打）。`
        : `${input.wind} is past the turn clock. They can still play.`,
    };
  }
  return {
    toast: zh ? `還在等${input.wind}出牌。` : `Waiting on ${input.wind}.`,
    nudge: null,
  };
}

export function tienGowTurnClockView(input: {
  phase: string;
  toAct: number;
  playCount: number;
  members: readonly TienGowTurnMember[];
  now: number;
  startedAt: number;
  durationMs?: number;
  language: 'en' | 'zh-Hant';
  viewerSeat: number;
  isHost: boolean;
  wind: string;
}): {
  kind: TienGowTurnKind;
  phase: TienGowTurnClockPhase;
  remainingMs: number;
  remainingLabel: string | null;
  toast: string | null;
  nudge: string | null;
} {
  const actor = tienGowTurnActor(input.phase, input.toAct, input.members);
  const clock = tienGowTurnClockState({
    kind: actor.kind,
    now: input.now,
    startedAt: input.startedAt,
    durationMs: input.durationMs,
  });
  const remainingMs = actor.kind === 'human'
    ? tienGowTurnRemainingMs(input.now, input.startedAt, input.durationMs)
    : 0;
  const copy = tienGowTurnClockCopy({
    language: input.language,
    clock,
    kind: actor.kind,
    wind: input.wind,
    isOwnTurn: actor.kind === 'human' && input.viewerSeat === input.toAct,
    isHost: input.isHost,
  });
  return {
    kind: actor.kind,
    phase: clock,
    remainingMs,
    remainingLabel: clock === 'counting' ? formatTienGowTurnRemaining(remainingMs) : null,
    toast: copy.toast,
    nudge: copy.nudge,
  };
}
