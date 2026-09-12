'use client';

import { getOpenRow, getWinningLine, type ConnectFourState } from '@playroom/connect-four';

export function ConnectFourBoard({
  state,
  onMove,
  disabled,
  language,
}: {
  state: ConnectFourState;
  onMove: (column: number) => void;
  disabled: boolean;
  language: 'en' | 'zh-Hant';
}) {
  const winning = getWinningLine(state.board, state.lastDrop) ?? [];
  const winningSet = new Set(winning.map(([row, column]) => `${row}-${column}`));
  const boardLabel = language === 'en' ? 'Connect Four board' : '四子棋棋盤';
  const youLabel = language === 'en' ? 'RED' : '紅';
  const opponentLabel = language === 'en' ? 'YELLOW' : '黃';

  return (
    <div className="connect-play">
      <div className="connect-board-wrap">
        <div className="connect-board-glow" aria-hidden="true" />
        <div className="connect-board" role="grid" aria-label={boardLabel}>
          {state.board.flatMap((rowCells, row) => rowCells.map((cell, column) => {
            const key = `${row}-${column}`;
            const classes = ['connect-cell'];
            if (cell === 'red') classes.push('token-red');
            if (cell === 'yellow') classes.push('token-yellow');
            if (winningSet.has(key)) classes.push('winner');
            else if (winning.length && cell) classes.push('dimmed');
            if (state.lastDrop?.row === row && state.lastDrop.column === column) classes.push('just-dropped');
            const occupant = cell === 'red' ? (language === 'en' ? 'red token' : '紅棋') : cell === 'yellow' ? (language === 'en' ? 'yellow token' : '黃棋') : (language === 'en' ? 'empty' : '空');
            return (
              <div
                className={classes.join(' ')}
                key={key}
                role="gridcell"
                aria-label={language === 'en' ? `Row ${6 - row}, column ${column + 1}: ${occupant}` : `第 ${6 - row} 列，第 ${column + 1} 欄：${occupant}`}
              />
            );
          }))}
        </div>
        <div className="connect-columns" aria-label={language === 'en' ? 'Drop token into a column' : '選擇直欄落子'}>
          {Array.from({ length: 7 }, (_, column) => {
            const full = getOpenRow(state.board, column) < 0;
            return (
              <button
                className="connect-column"
                disabled={disabled || full}
                key={column}
                type="button"
                onClick={() => onMove(column)}
                aria-label={language === 'en' ? `Drop token in column ${column + 1}` : `在第 ${column + 1} 欄落子`}
              />
            );
          })}
        </div>
        <div className="connect-board-sheen" aria-hidden="true" />
      </div>
      <div className="connect-legend">
        <span className="legend-token red" /> {youLabel}
        <span className="legend-divider">/</span>
        <span className="legend-token yellow" /> {opponentLabel}
        <span className="footer-note">{language === 'en' ? 'FIRST TO 4 · NO UNDOS' : '先連成四子 · 不能悔棋'}</span>
      </div>
    </div>
  );
}
