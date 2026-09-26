/** Visible-tab snapshot poll. Idle subscribed rooms still poll while the tab is open; Realtime alone was not reliable. */
export const ROOM_POLL_WITH_CLIENT_MS = 5_000;

/** Used when the browser has no Supabase client. That path never opens a Realtime channel. */
export const ROOM_POLL_WITHOUT_CLIENT_MS = 1_500;

/** Presence while the tab is visible. Hidden tabs do not send it, so the room can go idle. */
export const ROOM_HEARTBEAT_MS = 60_000;

/**
 * Snapshot polling and the room Realtime channel run only for a visible tab
 * whose room has not been marked expired. A hidden tab drops both.
 * An in-flight snapshot request is left to finish.
 */
export function shouldSyncRoom(visibilityState: string, roomStatus: string): boolean {
  return visibilityState === 'visible' && roomStatus !== 'expired';
}

export function roomPollPeriodMs(hasBrowserClient: boolean): number {
  return hasBrowserClient ? ROOM_POLL_WITH_CLIENT_MS : ROOM_POLL_WITHOUT_CLIENT_MS;
}

/** Over-limit and database-busy responses stay on screen. The player retries by submitting again. */
export function canAutoRetryRoomCommand(status: number): boolean {
  return status !== 429 && status !== 503;
}

/** A schema-cache or pool failure must not keep the 5-second room poll running. */
export function shouldPauseRoomPoll(message: string): boolean {
  return message.includes('schema cache')
    || message.includes('connection pool')
    || message === 'The server is busy. Please try again later.';
}
