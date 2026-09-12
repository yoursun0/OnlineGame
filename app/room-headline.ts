import { getWinner, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';

type HeadlineMember = { seat: number; display_name: string };

function playerLabel(members: HeadlineMember[], mark: 'X' | 'O') {
  const seat = mark === 'X' ? 0 : 1;
  const name = members.find((member) => member.seat === seat)?.display_name.trim();
  return name ? `${mark} · ${name}` : mark;
}

export function roomHeadline(input: {
  status: 'open' | 'playing' | 'finished' | 'expired';
  state: TicTacToeState;
  members: HeadlineMember[];
  language: 'en' | 'zh-Hant';
}) {
  const zh = input.language === 'zh-Hant';
  if (input.status === 'playing') {
    return `${zh ? '輪到' : 'Turn'}: ${playerLabel(input.members, input.state.nextMark)}`;
  }
  if (input.status === 'finished') {
    const result = ticTacToe.getStatus(input.state);
    if (result === 'draw') return zh ? '遊戲結束 — 和局' : 'Game complete — draw';
    const winner = getWinner(input.state.board);
    if (winner) {
      const label = playerLabel(input.members, winner);
      return zh ? `遊戲結束 — ${label} 獲勝` : `Game complete — ${label} wins`;
    }
  }
  return zh ? '等待玩家' : 'Waiting room';
}
