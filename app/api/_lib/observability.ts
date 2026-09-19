import { createHash } from 'node:crypto';

type RoomLifecycleAction = 'create' | 'join' | 'ready' | 'start' | 'leave' | 'report' | 'move' | 'replay' | 'checkpoint' | 'finish';

function guestHash(guestId: string) {
  return createHash('sha256').update(guestId).digest('hex').slice(0, 16);
}

export function logRoomLifecycle(action: RoomLifecycleAction, input: {
  roomCode?: string;
  guestId?: string;
  version?: number;
  status?: string;
}) {
  console.info(JSON.stringify({
    event: 'playroom.room.lifecycle',
    action,
    roomCode: input.roomCode,
    guest: input.guestId ? guestHash(input.guestId) : undefined,
    version: input.version,
    status: input.status,
    timestamp: new Date().toISOString(),
  }));
}

export function logApiFailure(route: string, error: unknown, roomCode?: string) {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(JSON.stringify({
    event: 'playroom.api.failure',
    route,
    roomCode,
    error: errorName,
    timestamp: new Date().toISOString(),
  }));
}
