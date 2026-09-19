import { connectFour, getWinner as getConnectWinner, type Color, type ConnectFourState } from '@playroom/connect-four';
import { getWinner, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';

type HeadlineMember = { seat: number; display_name: string };

function namedSeat(members: HeadlineMember[], seat: number, mark: string) {
  const name = members.find((member) => member.seat === seat)?.display_name.trim();
  return name ? `${mark} · ${name}` : mark;
}

function ticTacToeLabel(members: HeadlineMember[], mark: 'X' | 'O') {
  return namedSeat(members, mark === 'X' ? 0 : 1, mark);
}

function connectFourMark(color: Color, language: 'en' | 'zh-Hant') {
  if (language === 'zh-Hant') return color === 'red' ? '紅' : '黃';
  return color === 'red' ? 'Red' : 'Yellow';
}

function connectFourLabel(members: HeadlineMember[], color: Color, language: 'en' | 'zh-Hant') {
  return namedSeat(members, color === 'red' ? 0 : 1, connectFourMark(color, language));
}

export function roomHeadline(input: {
  status: 'open' | 'playing' | 'finished' | 'expired';
  state: TicTacToeState | ConnectFourState | unknown;
  members: HeadlineMember[];
  language: 'en' | 'zh-Hant';
  gameSlug?: string;
}) {
  const zh = input.language === 'zh-Hant';
  if (input.gameSlug === 'downstairs') {
    const state = input.state as { phase?: string; result?: { reason?: string }; checkpoint?: { well?: { kids?: Array<{ life?: number }> } } };
    if (input.status === 'playing') {
      const life = state.checkpoint?.well?.kids?.[0]?.life;
      if (typeof life === 'number') {
        return zh ? `Solo 井進行中 · 生命 ${Math.ceil(life)}` : `Solo well · life ${Math.ceil(life)}`;
      }
      return zh ? 'Solo 井進行中' : 'Solo well in play';
    }
    if (input.status === 'finished') {
      const reason = state.result?.reason;
      if (reason === 'quit') return zh ? '遊戲結束 — 已退出' : 'Game complete — quit';
      if (reason === 'fall') return zh ? '遊戲結束 — 跌出井外' : 'Game complete — fell out';
      if (reason === 'hp') return zh ? '遊戲結束 — 生命歸零' : 'Game complete — out of life';
      return zh ? '遊戲結束' : 'Game complete';
    }
    return zh ? '等待開局（可單人即開）' : 'Waiting room — start solo anytime';
  }

  if (input.gameSlug === 'connect-four') {
    const state = input.state as ConnectFourState;
    if (input.status === 'playing') {
      return `${zh ? '輪到' : 'Turn'}: ${connectFourLabel(input.members, state.nextColor, input.language)}`;
    }
    if (input.status === 'finished') {
      const result = connectFour.getStatus(state);
      if (result === 'draw') return zh ? '遊戲結束 — 和局' : 'Game complete — draw';
      const winner = getConnectWinner(state.board, state.lastDrop);
      if (winner) {
        const label = connectFourLabel(input.members, winner, input.language);
        return zh ? `遊戲結束 — ${label} 獲勝` : `Game complete — ${label} wins`;
      }
    }
    return zh ? '等待玩家' : 'Waiting room';
  }

  const state = input.state as TicTacToeState;
  if (input.status === 'playing') {
    return `${zh ? '輪到' : 'Turn'}: ${ticTacToeLabel(input.members, state.nextMark)}`;
  }
  if (input.status === 'finished') {
    const result = ticTacToe.getStatus(state);
    if (result === 'draw') return zh ? '遊戲結束 — 和局' : 'Game complete — draw';
    const winner = getWinner(state.board);
    if (winner) {
      const label = ticTacToeLabel(input.members, winner);
      return zh ? `遊戲結束 — ${label} 獲勝` : `Game complete — ${label} wins`;
    }
  }
  return zh ? '等待玩家' : 'Waiting room';
}
