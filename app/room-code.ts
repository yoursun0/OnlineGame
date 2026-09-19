export const PLAYROOM_ROOM_CODE = /^(TIK|CON|LAD)-[2-9A-HJ-NP-Z]{3}$/;

export function isPlayroomRoomCode(code: string) {
  return PLAYROOM_ROOM_CODE.test(code);
}
