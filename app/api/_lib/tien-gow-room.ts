import {
  applyMove,
  isTienGowView,
  nextCpuMove,
  projectView,
  type Move,
  type State,
} from '@playroom/tien-gow';
import { appendGameEvents } from './append-game-events';

export { isTienGowView };

type CpuMember = { guest_id: string; seat: number; is_cpu?: boolean };
type CpuRoom = { id: string; status: string; version: number; state: unknown; game_slug?: string };

/** Consecutive CPU seats written in one command transaction. GET does not continue the drain. */
export const TGW_CPU_DRAIN_CAP = 24;

const TILE_ID = /^[a-z0-9:-]+$/i;

export function isTienGowState(value: unknown): value is State {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<State>;
  return Array.isArray(state.hands)
    && state.hands.length === 4
    && typeof state.toAct === 'number'
    && typeof state.phase === 'string'
    && Array.isArray(state.chips);
}

export function parseTienGowMove(body: unknown): { ok: true; move: Move } | { ok: false; reason: string } {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'Choose a legal 打天九 move.' };
  const record = body as { type?: unknown; tiles?: unknown };
  if (record.type === 'claimExample' || record.type === 'skipExample') {
    return { ok: true, move: { type: record.type } };
  }
  if (record.type === 'lead' || record.type === 'beat' || record.type === 'dump') {
    if (!Array.isArray(record.tiles) || record.tiles.length < 1 || record.tiles.length > 8) {
      return { ok: false, reason: 'Choose a valid tile set.' };
    }
    if (!record.tiles.every((tile) => typeof tile === 'string' && TILE_ID.test(tile))) {
      return { ok: false, reason: 'Choose a valid tile set.' };
    }
    return { ok: true, move: { type: record.type, tiles: record.tiles } };
  }
  return { ok: false, reason: 'Choose a legal 打天九 move.' };
}

export function publicTienGowMovePayload(move: Move, seat: number): Record<string, unknown> {
  if (move.type === 'dump') return { type: 'dump', seat, count: move.tiles.length };
  if (move.type === 'lead' || move.type === 'beat') return { type: move.type, seat, tiles: [...move.tiles] };
  return { type: move.type, seat };
}

export function pendingTienGowCpuSeat(state: State, members: CpuMember[]): CpuMember | undefined {
  if (state.phase === 'recap') return undefined;
  const cpu = members.find((member) => member.is_cpu && member.seat === state.toAct);
  if (!cpu) return undefined;
  return nextCpuMove(state, cpu.seat) ? cpu : undefined;
}

export function drainTienGowCpuState(
  state: State,
  members: CpuMember[],
  cap = TGW_CPU_DRAIN_CAP,
): { state: State; applied: Array<{ seat: number; move: Move }>; states: State[] } {
  const applied: Array<{ seat: number; move: Move }> = [];
  const states: State[] = [];
  let current = state;
  for (let step = 0; step < cap; step += 1) {
    const cpu = pendingTienGowCpuSeat(current, members);
    if (!cpu) break;
    const move = nextCpuMove(current, cpu.seat);
    if (!move) break;
    current = applyMove(current, move, { id: cpu.guest_id, seat: cpu.seat });
    applied.push({ seat: cpu.seat, move });
    states.push(current);
  }
  return { state: current, applied, states };
}

function sanitizeTienGowEventPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as { type?: unknown; seat?: unknown; tiles?: unknown; count?: unknown };
  if (record.type !== 'dump') return payload;
  const count = typeof record.count === 'number'
    ? record.count
    : Array.isArray(record.tiles) ? record.tiles.length : 0;
  return { type: 'dump', seat: record.seat, count };
}

export function projectTienGowSnapshot<T extends {
  room: { game_slug?: string; state: unknown };
  members: Array<{ guest_id: string; seat: number }>;
  events?: Array<{ payload?: unknown }>;
}>(snapshot: T, viewerGuestId: string): T {
  if (snapshot.room.game_slug !== 'tien-gow' || !isTienGowState(snapshot.room.state)) return snapshot;
  const member = snapshot.members.find((candidate) => candidate.guest_id === viewerGuestId);
  if (!member || member.seat < 0 || member.seat > 3) return snapshot;
  return {
    ...snapshot,
    room: {
      ...snapshot.room,
      state: projectView(snapshot.room.state, member.seat),
    },
    events: snapshot.events?.map((event) => ({
      ...event,
      payload: sanitizeTienGowEventPayload(event.payload),
    })),
  };
}

export async function applyTienGowCpuTurns(room: CpuRoom, members: CpuMember[]) {
  if (!isTienGowState(room.state)) return { moves: [] as Array<{ seat: number; move: Move }>, states: [] as State[] };
  const drained = drainTienGowCpuState(room.state, members);
  if (drained.applied.length === 0) return { moves: [], states: [] as State[] };
  const steps = drained.applied.map((item, index) => {
    const guestId = members.find((member) => member.seat === item.seat)?.guest_id;
    const state = drained.states[index];
    if (!guestId || !state) throw new Error('Computer seat is missing.');
    return {
      guest_id: guestId,
      state,
      status: 'playing' as const,
      event_type: 'move',
      payload: publicTienGowMovePayload(item.move, item.seat),
    };
  });
  await appendGameEvents(room.id, steps[0]!.guest_id, room.version, steps);
  return { moves: drained.applied, states: drained.states };
}

export function presentRoomCommandSnapshot<T extends {
  room: { game_slug?: string; state: unknown };
  members: Array<{ guest_id: string; seat: number }>;
  events?: Array<{ payload?: unknown }>;
  cpuStates?: State[];
}>(snapshot: T, viewerGuestId: string): T & { cpuFrames?: unknown[] } {
  const { cpuStates, ...rest } = snapshot;
  const projected = projectTienGowSnapshot(rest, viewerGuestId);
  if (!cpuStates?.length || snapshot.room.game_slug !== 'tien-gow') return projected;
  const member = snapshot.members.find((candidate) => candidate.guest_id === viewerGuestId);
  if (!member) return projected;
  return {
    ...projected,
    cpuFrames: cpuStates.map((state) => projectView(state, member.seat)),
  };
}
