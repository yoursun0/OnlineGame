'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  type CatAndDogMove,
  type CatAndDogState,
  type Difficulty,
  type Item,
  type Side,
} from '@playroom/cat-and-dog';

const ITEMS: Item[] = ['none', 'powerThrow', 'stinkBomb', 'doubleAttack'];

function sideName(side: Side, language: 'en' | 'zh-Hant') {
  if (language === 'zh-Hant') return side === 'cat' ? '貓' : '狗';
  return side === 'cat' ? 'Cat' : 'Dog';
}

function meterWidth(frame: number) {
  return `${Math.min(100, Math.max(0, ((frame - 1) / 22) * 100))}%`;
}

export function CatAndDogTable({
  state,
  onMove,
  disabled,
  language,
}: {
  state: CatAndDogState;
  onMove: (move: CatAndDogMove) => void;
  disabled: boolean;
  language: 'en' | 'zh-Hant';
}) {
  const zh = language === 'zh-Hant';
  const [item, setItem] = useState<Item>('none');
  const [power, setPower] = useState(1);
  const [holding, setHolding] = useState(false);
  const powerRef = useRef(1);
  const holdingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const defender = state.last?.kind === 'throw' ? (state.last.side === 'cat' ? 'dog' : 'cat') : null;
  const reaction = state.last?.landings.at(-1)?.reaction ?? 1;
  const projectile = state.last?.landings.at(-1)?.projectile;
  const hit = state.last?.landings.some((landing) => landing.hit) ?? false;

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  function stopHold(send: boolean) {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const wasHolding = holdingRef.current;
    holdingRef.current = false;
    setHolding(false);
    if (send && wasHolding) onMove({ type: 'throw', item, power: powerRef.current });
  }

  function startHold(event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) {
    if (disabled || holdingRef.current) return;
    if ('button' in event && event.button !== 0) return;
    if ('pointerId' in event) event.currentTarget.setPointerCapture(event.pointerId);
    powerRef.current = 1;
    holdingRef.current = true;
    setPower(1);
    setHolding(true);
    timerRef.current = window.setInterval(() => {
      powerRef.current = Math.min(33, powerRef.current + 1);
      setPower(powerRef.current);
    }, 50);
  }

  const itemLabel: Record<Item, string> = zh
    ? { none: '普通', powerThrow: '力投', stinkBomb: '臭彈', doubleAttack: '雙擊' }
    : { none: 'Plain', powerThrow: 'Power throw', stinkBomb: 'Stink bomb', doubleAttack: 'Double attack' };
  const aimed = state.toAct === 'dog' ? power - state.wind : power + state.wind;

  return (
    <div className="cad-play">
      <div className="cad-meters" aria-label={zh ? '放棄計量' : 'Give-up meters'}>
        {(['cat', 'dog'] as const).map((side) => {
          const frame = state.meters[side];
          return (
            <div className={`cad-meter cad-meter-${side}${frame >= 14 ? ' cad-meter-warn' : ''}${frame >= 23 ? ' cad-meter-gone' : ''}`} key={side}>
              <span>{sideName(side, language)}</span>
              <i aria-hidden="true"><b style={{ width: meterWidth(frame) }} /></i>
              <em>{frame}</em>
            </div>
          );
        })}
      </div>
      <div className="cad-stage" role="img" aria-label={zh ? '貓狗對擲場地' : 'Cat and Dog yard'}>
        <div className={`cad-actor cad-cat${defender === 'cat' ? ` cad-pose-${reaction}` : ''}`} aria-hidden="true">
          <span className="cad-ears" /><span className="cad-head" /><span className="cad-body" /><span className="cad-tail" />
        </div>
        <div className="cad-fence" aria-hidden="true">
          <span className="cad-wind">{zh ? '風' : 'Wind'} {state.wind > 0 ? `+${state.wind}` : state.wind}</span>
        </div>
        <div className={`cad-actor cad-dog${defender === 'dog' ? ` cad-pose-${reaction}` : ''}`} aria-hidden="true">
          <span className="cad-ears" /><span className="cad-head" /><span className="cad-body" /><span className="cad-tail" />
        </div>
        {projectile ? <span className={`cad-shot cad-shot-${projectile}${hit ? ' cad-shot-hit' : ' cad-shot-miss'} cad-shot-${state.last?.side}`} /> : null}
      </div>
      <p className="cad-readout">
        {state.winner
          ? (zh ? `${sideName(state.winner, language)}勝` : `${sideName(state.winner, language)} wins`)
          : (zh ? `輪到${sideName(state.toAct, language)}` : `${sideName(state.toAct, language)} to throw`)}
        {state.last?.kind === 'throw' && state.last.landings[0] ? ` · ${state.last.landings[0].hit ? (zh ? '命中' : 'hit') : (zh ? '落空' : 'miss')}` : ''}
      </p>
      <div className="cad-items" role="group" aria-label={zh ? '道具' : 'Items'}>
        {ITEMS.map((choice) => (
          <button
            className={item === choice ? 'cad-item cad-item-on' : 'cad-item'}
            disabled={disabled}
            key={choice}
            type="button"
            onClick={() => setItem(choice)}
          >
            {itemLabel[choice]}
          </button>
        ))}
        <button className="cad-item cad-item-up" disabled={disabled} type="button" onClick={() => onMove({ type: 'powerUp' })}>
          {zh ? '加力' : 'Power up'}
        </button>
      </div>
      <button
        className={`cad-hold${holding ? ' cad-hold-on' : ''}`}
        disabled={disabled}
        type="button"
        aria-valuemin={1}
        aria-valuemax={33}
        aria-valuenow={power}
        aria-label={zh ? '按住投擲' : 'Hold to throw'}
        onPointerDown={startHold}
        onPointerUp={() => stopHold(true)}
        onPointerCancel={() => stopHold(false)}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            startHold(event);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            stopHold(true);
          }
        }}
      >
        <span>{holding ? (zh ? '放開投出' : 'Release') : (zh ? '按住投擲' : 'Hold to throw')}</span>
        <strong>{power}</strong>
        <small>{zh ? `瞄準 ${aimed}` : `Aim ${aimed}`}</small>
      </button>
    </div>
  );
}

export function CatAndDogDifficulty({
  value,
  onChange,
  language,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
  language: 'en' | 'zh-Hant';
}) {
  const zh = language === 'zh-Hant';
  const choices: Array<{ id: Difficulty; label: string; note: string }> = zh
    ? [
      { id: 'level1', label: '等級 1', note: '電腦力度 21' },
      { id: 'level2', label: '等級 2', note: '電腦力度 22' },
      { id: 'expert', label: '微風', note: '電腦力度 20' },
    ]
    : [
      { id: 'level1', label: 'Level 1', note: 'CPU power 21' },
      { id: 'level2', label: 'Level 2', note: 'CPU power 22' },
      { id: 'expert', label: 'Expert wind', note: 'CPU power 20' },
    ];
  return (
    <div className="cad-difficulty" role="radiogroup" aria-label={zh ? '難度' : 'Difficulty'}>
      {choices.map((choice) => (
        <button
          aria-checked={value === choice.id}
          className={value === choice.id ? 'cad-item cad-item-on' : 'cad-item'}
          key={choice.id}
          role="radio"
          type="button"
          onClick={() => onChange(choice.id)}
        >
          <b>{choice.label}</b>
          <small>{choice.note}</small>
        </button>
      ))}
    </div>
  );
}
