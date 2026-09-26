/** Interval used only when the browser has no Supabase client. That path never reaches the database. */
export const ROOM_POLL_WITHOUT_CLIENT_MS = 1_500;

/** Safety poll after Realtime fails. Idle subscribed rooms do not poll. */
export const ROOM_POLL_WITHOUT_REALTIME_MS = 15_000;

const REALTIME_DOWN = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

/**
 * One live path at a time. A subscribed Realtime channel is enough.
 * Poll only with no browser client, or after that channel reports it is down.
 * A null status means the channel is still connecting, so do not poll yet.
 */
export function shouldPollRoom(hasBrowserClient: boolean, channelStatus: string | null): boolean {
  if (!hasBrowserClient) return true;
  if (channelStatus === 'SUBSCRIBED') return false;
  return channelStatus !== null && REALTIME_DOWN.has(channelStatus);
}
