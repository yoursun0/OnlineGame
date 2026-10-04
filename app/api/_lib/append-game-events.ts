import { getAdminClient } from './supabase-admin';

export type GameStep = {
  guest_id: string;
  state: unknown;
  status: 'playing' | 'finished';
  event_type: string;
  payload: Record<string, unknown>;
};

export async function appendGameEvents(roomId: string, actorGuestId: string, expectedVersion: number, steps: GameStep[]) {
  if (steps.length === 0) return expectedVersion;
  const { data, error } = await getAdminClient().rpc('append_game_events', {
    p_room_id: roomId,
    p_actor_guest_id: actorGuestId,
    p_expected_version: expectedVersion,
    p_steps: steps,
  });
  if (error) throw error;
  return data as number;
}
