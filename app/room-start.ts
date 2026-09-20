export function canHostStartRoom(input: {
  status: 'open' | 'playing' | 'finished' | 'expired';
  hostGuestId: string;
  guestId: string;
  members: Array<{ is_ready: boolean; is_cpu?: boolean }>;
  maxPlayers: number;
  gameSlug?: string;
}) {
  if (input.status !== 'open' || input.hostGuestId !== input.guestId) return false;
  // Lobby-only until AFK G4 CPU fill + random seats (#43).
  if (input.gameSlug === 'tien-gow') return false;
  const humans = input.members.filter((member) => !member.is_cpu);
  if (humans.length === 1) return true;
  if (input.gameSlug === 'downstairs') {
    // Shared well: 2–4 humans, all ready. Room max is 4.
    return humans.length >= 2 && humans.length <= 4 && humans.every((member) => member.is_ready);
  }
  return input.members.length === input.maxPlayers && input.members.every((member) => member.is_ready);
}
