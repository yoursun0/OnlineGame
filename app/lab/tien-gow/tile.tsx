'use client';

import { getTile, isPipPaintRed, type Tile } from '@playroom/tien-gow';

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
      <PipFace tile={tile} face={0} />
      <span className="tgw-bone-waist" />
      <PipFace tile={tile} face={1} />
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

function PipFace({ tile, face }: { tile: Tile; face: 0 | 1 }) {
  const value = tile.pips[face];
  return (
    <span className="tgw-face" aria-hidden="true">
      {pipSlots(value).map(([x, y], index) => (
        <i
          key={`${value}-${index}`}
          className={isPipPaintRed(tile, face, index) ? 'pip red' : 'pip'}
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
      return [[26, 24], [74, 76]];
    case 3:
      return [[26, 24], [50, 50], [74, 76]];
    case 4:
      return [[26, 24], [74, 24], [26, 76], [74, 76]];
    case 5:
      return [[26, 24], [74, 24], [50, 50], [26, 76], [74, 76]];
    case 6:
      return [[26, 20], [74, 20], [26, 50], [74, 50], [26, 80], [74, 80]];
    default:
      return [];
  }
}

export function tileById(id: string): Tile {
  return getTile(id);
}
