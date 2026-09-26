/** Free-tier soft gates from issue #58. The database functions enforce the same numbers. */

export const ROOM_CAP = 40;
export const IDLE_ROOM_TTL_MINUTES = 15;

export const CREATE_ROOM_LIMIT = 5;
export const CREATE_ROOM_WINDOW_SECONDS = 60 * 60;
export const CREATE_ROOM_COOLDOWN_SECONDS = 20;

export const START_REMATCH_LIMIT = 10;
export const START_REMATCH_WINDOW_SECONDS = 60 * 60;
export const START_REMATCH_COOLDOWN_SECONDS = 5;

export const BUSY_ERROR = 'The server is busy. Please try again later.';
