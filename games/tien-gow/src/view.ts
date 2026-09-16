import { listLegalMoves, type Recap, type State, type Toast, type TrickPlay } from './reducer';
import type { Combo } from './combinations';
import type { Table } from './table';
import type { Move, Phase } from './reducer';
import type { TileId } from './tiles';

export type ViewPlay =
  | { seat: number; type: 'lead' | 'beat'; tiles: TileId[]; combo: Combo }
  | { seat: number; type: 'dump'; count: number };

export type View = {
  seat: number;
  table: Table;
  phase: Phase;
  toAct: number;
  bankerSeat: number;
  bankerStreak: number;
  chips: number[];
  hand: TileId[];
  dong: number[];
  publicDong: TileId[][];
  trick: { leader: number; combo: Combo | null; plays: ViewPlay[] } | null;
  log: string[];
  toasts: Toast[];
  recap: Recap | null;
  legal: Move[];
  jieSeat: number | null;
};

export function projectView(state: State, seat: number): View {
  return {
    seat,
    table: state.table,
    phase: state.phase,
    toAct: state.toAct,
    bankerSeat: state.bankerSeat,
    bankerStreak: state.bankerStreak,
    chips: [...state.chips],
    hand: [...state.hands[seat]],
    dong: [...state.dong],
    publicDong: state.dongPublic.map((tiles) => [...tiles]),
    trick: state.trick
      ? {
          leader: state.trick.leader,
          combo: state.trick.combo,
          plays: state.trick.plays.map(hideDumpFaces),
        }
      : null,
    log: [...state.log],
    toasts: [...state.toasts],
    recap: state.recap ? structuredClone(state.recap) : null,
    legal: listLegalMoves(state, seat),
    jieSeat: state.jieSeat,
  };
}

function hideDumpFaces(play: TrickPlay): ViewPlay {
  if (play.type === 'dump') return { seat: play.seat, type: 'dump', count: play.tiles.length };
  return { seat: play.seat, type: play.type, tiles: [...play.tiles], combo: play.combo };
}
