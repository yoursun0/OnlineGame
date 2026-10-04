import {
  identifyCombo,
  isTienGowView,
  projectView,
  type Move,
  type State,
  type View,
} from '@playroom/tien-gow';

/** Face-up computer play. Lab uses a longer pause; a room step stays inside 400–700ms. */
export const TGW_CPU_PLAY_MS = 600;
/** Example skip. Same short beat as the lab. */
export const TGW_CPU_SKIP_MS = 400;

export type TienGowCpuFrame = { view: View; ms: number };

export function tienGowCpuMoveMs(move: Move): number {
  return move.type === 'skipExample' ? TGW_CPU_SKIP_MS : TGW_CPU_PLAY_MS;
}

export function tienGowCpuStepMs(ms: unknown): number {
  const value = typeof ms === 'number' ? ms : TGW_CPU_PLAY_MS;
  if (!Number.isFinite(value)) return TGW_CPU_PLAY_MS;
  return Math.min(700, Math.max(400, Math.round(value)));
}

export function roomRefreshIsStale(animating: boolean, startedGeneration: number, currentGeneration: number): boolean {
  return animating || startedGeneration !== currentGeneration;
}

function heldFourthPlay(previous: State, move: Move, seat: number): View['trick'] | null {
  if (!previous.trick || previous.trick.plays.length !== 3) return null;
  const trick = projectView(previous, 0).trick;
  if (!trick) return null;
  if (move.type === 'dump') {
    return { ...trick, plays: [...trick.plays, { seat, type: 'dump', count: move.tiles.length }] };
  }
  if (move.type !== 'beat') return null;
  const combo = identifyCombo(move.tiles, previous.table);
  if (!combo) return null;
  return {
    ...trick,
    combo,
    plays: [...trick.plays, { seat, type: 'beat', tiles: [...move.tiles], combo }],
  };
}

/** One visible frame per computer move. The fourth play stays on the table instead of jumping to the cleared trick. */
export function tienGowCpuPlaybackFrames(
  before: State,
  moves: Array<{ seat: number; move: Move }>,
  afterStates: State[],
  viewerSeat: number,
): { opening: View; frames: TienGowCpuFrame[] } {
  const frames: TienGowCpuFrame[] = [];
  let previous = before;
  const count = Math.min(moves.length, afterStates.length);
  for (let index = 0; index < count; index += 1) {
    const item = moves[index]!;
    const after = afterStates[index]!;
    const projected = projectView(after, viewerSeat);
    const held = heldFourthPlay(previous, item.move, item.seat);
    frames.push({
      view: held ? { ...projected, trick: held } : projected,
      ms: tienGowCpuMoveMs(item.move),
    });
    previous = after;
  }
  return { opening: projectView(before, viewerSeat), frames };
}

function playbackSignature(view: View): string {
  return JSON.stringify({
    phase: view.phase,
    toAct: view.toAct,
    hand: view.hand,
    chips: view.chips,
    dong: view.dong,
    trick: view.trick,
    jieSeat: view.jieSeat,
    recap: view.recap,
  });
}

export type TienGowPlaybackStep = { state: View; waitMs: number };

/**
 * Opening paints immediately (the dealt hand or the human move).
 * Each computer frame waits, then paints. A held four-play trick waits again before the settled board.
 */
export function tienGowCpuPlaybackPlan(input: {
  opening: unknown;
  frames: readonly { view?: unknown; ms?: unknown }[];
  finalState: unknown;
}): TienGowPlaybackStep[] {
  const steps: TienGowPlaybackStep[] = [];
  if (isTienGowView(input.opening)) steps.push({ state: input.opening, waitMs: 0 });
  for (const frame of input.frames) {
    if (!isTienGowView(frame?.view)) continue;
    steps.push({ state: frame.view, waitMs: tienGowCpuStepMs(frame.ms) });
  }
  if (steps.length === 0) return [];
  const last = steps[steps.length - 1]!;
  if (isTienGowView(input.finalState) && playbackSignature(last.state) !== playbackSignature(input.finalState)) {
    steps.push({ state: input.finalState, waitMs: last.waitMs === 0 ? TGW_CPU_PLAY_MS : last.waitMs });
  }
  return steps;
}
