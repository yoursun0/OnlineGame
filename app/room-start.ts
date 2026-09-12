export function canHostStartRoom(input: {
  status: 'open' | 'playing' | 'finished' | 'expired';
  hostGuestId: string;
  guestId: string;
  members: Array<{ is_ready: boolean; is_cpu?: boolean }>;
  maxPlayers: number;
}) {
  if (input.status !== 'open' || input.hostGuestId !== input.guestId) return false;
  const humans = input.members.filter((member) => !member.is_cpu);
  if (humans.length === 1) return true;
  return input.members.length === input.maxPlayers && input.members.every((member) => member.is_ready);
}
