'use client';

import { getTile, isRedPip, type Tile } from '@playroom/tien-gow';

export function BoneTile({
  tile,
  selected = false,
  dimmed = false,
  faceDown = false,
  onClick,
  title,
}: {
  tile?: Tile;
  selected?: boolean;
  dimmed?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const className = [
    'tgw-bone',
    selected ? 'is-selected' : '',
    dimmed ? 'is-dimmed' : '',
    faceDown ? 'is-back' : '',
    onClick ? 'is-button' : '',
  ].filter(Boolean).join(' ');

  if (faceDown || !tile) {
    return (
      <span className={className} title={title} aria-hidden={!title}>
        <span className="tgw-bone-back" />
      </span>
    );
  }

  const inner = (
    <>
      <PipFace value={tile.pips[0]} />
      <span className="tgw-bone-waist" />
      <PipFace value={tile.pips[1]} />
      <span className="tgw-bone-name">{tile.label}</span>
    </>
  );

  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick} aria-pressed={selected} title={title ?? tile.label}>
        {inner}
      </button>
    );
  }

  return (
    <span className={className} title={title ?? tile.label}>
      {inner}
    </span>
  );
}

function PipFace({ value }: { value: number }) {
  return (
    <span className="tgw-face" aria-hidden="true">
      {pipSlots(value).map(([x, y], index) => (
        <i
          key={`${value}-${index}`}
          className={isRedPip(value) ? 'pip red' : 'pip'}
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </span>
  );
}

function pipSlots(value: number): Array<[number, number]> {
  switch (value) {
    case 1:
      return [[50, 50]];
    case 2:
      return [[28, 28], [72, 72]];
    case 3:
      return [[28, 28], [50, 50], [72, 72]];
    case 4:
      return [[28, 28], [72, 28], [28, 72], [72, 72]];
    case 5:
      return [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]];
    case 6:
      return [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]];
    default:
      return [];
  }
}

export function tileById(id: string): Tile {
  return getTile(id);
}
