'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  type CatAndDogMove,
  type CatAndDogState,
  type Difficulty,
  type Item,
  type Side,
} from '@playroom/cat-and-dog';

const TOGGLE_ITEMS: Item[] = ['doubleAttack', 'powerThrow', 'stinkBomb'];

function sideName(side: Side, language: 'en' | 'zh-Hant') {
  if (language === 'zh-Hant') return side === 'cat' ? '貓' : '狗';
  return side === 'cat' ? 'Cat' : 'Dog';
}

function meterWidth(frame: number) {
  return `${Math.min(100, Math.max(0, ((frame - 1) / 22) * 100))}%`;
}

function landingPoint(side: Side, qq: number, hit: boolean) {
  if (side === 'cat') {
    if (hit) return { x: 498, y: 232 };
    if (qq < 17) return { x: 352, y: 196 };
    return { x: 578, y: 148 };
  }
  if (hit) return { x: 112, y: 214 };
  if (qq < 18) return { x: 392, y: 188 };
  return { x: 36, y: 132 };
}

function throwPath(side: Side, end: { x: number; y: number }) {
  const start = side === 'cat' ? { x: 132, y: 246 } : { x: 492, y: 248 };
  const peak = Math.min(start.y, end.y) - 150;
  return `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2} ${peak} ${end.x} ${end.y}`;
}

type Flight = {
  id: number;
  side: Side;
  item: Item;
  path: string;
  hit: boolean;
  end: { x: number; y: number };
};

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
  const [flight, setFlight] = useState<Flight | null>(null);
  const [impact, setImpact] = useState<{ side: Side; pose: number; x: number; y: number } | null>(null);
  const powerRef = useRef(1);
  const holdingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const flightTimers = useRef<number[]>([]);
  const seenThrow = useRef<string | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    flightTimers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!state.last || state.last.kind !== 'throw' || state.last.landings.length === 0) return;
    const key = `${state.windDraws}:${state.last.side}:${state.last.power}:${state.last.item}:${state.last.landings.map((landing) => landing.qq).join(',')}`;
    if (seenThrow.current === null) {
      seenThrow.current = key;
      return;
    }
    if (seenThrow.current === key) return;
    seenThrow.current = key;
    flightTimers.current.forEach((id) => window.clearTimeout(id));
    flightTimers.current = [];
    const thrower = state.last.side;
    const thrownItem = state.last.item ?? 'none';
    state.last.landings.forEach((landing, index) => {
      const end = landingPoint(thrower, landing.qq, landing.hit);
      const startId = window.setTimeout(() => {
        setFlight({
          id: Date.now() + index,
          side: thrower,
          item: thrownItem,
          path: throwPath(thrower, end),
          hit: landing.hit,
          end,
        });
        const landId = window.setTimeout(() => {
          setFlight(null);
          if (landing.hit || landing.reaction > 1) {
            setImpact({ side: thrower === 'cat' ? 'dog' : 'cat', pose: landing.reaction, x: end.x, y: end.y });
          } else {
            setImpact(null);
          }
        }, 780);
        flightTimers.current.push(landId);
      }, index * 860);
      flightTimers.current.push(startId);
    });
  }, [state.last, state.windDraws]);

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

  const catPose = impact?.side === 'cat' ? impact.pose : 1;
  const dogPose = impact?.side === 'dog' ? impact.pose : 1;
  const charge = holding ? power / 33 : 0;
  const windLabel = state.wind > 0 ? `+${state.wind}` : `${state.wind}`;

  return (
    <div className="cad-play">
      <div className="cad-stage">
        <svg className="cad-svg" viewBox="0 0 600 430" role="img" aria-label={zh ? '貓狗對擲院子' : 'Cat and Dog yard'}>
          <Yard />
          <HudMeters cat={state.meters.cat} dog={state.meters.dog} wind={state.wind} windLabel={windLabel} charge={charge} zh={zh} />
          <YardCat pose={catPose} winding={holding && state.toAct === 'cat'} warn={state.meters.cat >= 14 && state.meters.cat < 23} item={item} />
          <YardDog pose={dogPose} winding={holding && state.toAct === 'dog'} warn={state.meters.dog >= 14 && state.meters.dog < 23} item={item} />
          {flight ? <Thrown key={flight.id} flight={flight} /> : null}
          {impact && impact.pose >= 2 ? <Stars x={impact.x} y={impact.y - 28} /> : null}
        </svg>
        <div className="cad-hud-items" role="group" aria-label={zh ? '道具' : 'Items'}>
          {TOGGLE_ITEMS.map((choice) => (
            <button
              className={`cad-round cad-round-${choice}${item === choice ? ' cad-round-on' : ''}`}
              disabled={disabled}
              key={choice}
              type="button"
              title={choice === 'doubleAttack' ? (zh ? '雙擊' : 'Double attack') : choice === 'powerThrow' ? (zh ? '力投' : 'Power throw') : (zh ? '臭彈' : 'Stink bomb')}
              onClick={() => setItem((current) => current === choice ? 'none' : choice)}
            >
              <ItemGlyph item={choice} />
            </button>
          ))}
          <button className="cad-round cad-round-powerUp" disabled={disabled} type="button" title={zh ? '加力' : 'Power up'} onClick={() => onMove({ type: 'powerUp' })}>
            <ItemGlyph item="powerUp" />
          </button>
        </div>
        <button
          className={`cad-grab cad-grab-${state.toAct}`}
          disabled={disabled}
          type="button"
          aria-label={zh ? '按住角色投擲' : 'Hold the animal to throw'}
          onPointerDown={startHold}
          onPointerUp={() => stopHold(true)}
          onPointerCancel={() => stopHold(false)}
        />
      </div>
      <p className="cad-readout">
        {state.winner
          ? (zh ? `${sideName(state.winner, language)}勝` : `${sideName(state.winner, language)} wins`)
          : (zh ? `輪到${sideName(state.toAct, language)}` : `${sideName(state.toAct, language)} to throw`)}
        {state.last?.kind === 'throw' && state.last.landings[0] ? ` · ${state.last.landings[0].hit ? (zh ? '命中' : 'hit') : (zh ? '落空' : 'miss')}` : ''}
      </p>
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
        <i style={{ width: meterWidth(Math.round(charge * 22) + 1) }} />
      </button>
    </div>
  );
}

function Yard() {
  return (
    <g aria-hidden="true">
      <rect width="600" height="430" fill="#7ec8ef" />
      <ellipse cx="120" cy="78" rx="46" ry="16" fill="#fff" opacity=".85" />
      <ellipse cx="430" cy="62" rx="58" ry="18" fill="#fff" opacity=".7" />
      <path d="M0 168 C80 120 140 150 210 132 C300 108 360 150 460 118 C520 98 560 124 600 108 V220 H0 Z" fill="#b7e36a" />
      <path d="M0 198 C90 160 170 188 260 170 C360 148 430 188 520 162 C560 150 580 158 600 150 V250 H0 Z" fill="#8fc84e" />
      <rect x="0" y="78" width="168" height="250" fill="#b48adf" />
      <rect x="18" y="118" width="52" height="72" fill="#6d4f88" />
      <rect x="24" y="124" width="18" height="28" fill="#c7b6de" opacity=".35" />
      <path d="M0 292 C40 286 90 304 150 300 L168 308 V430 H0 Z" fill="#d7b07a" />
      <path d="M150 304 C220 292 280 312 360 300 L600 286 V430 H150 Z" fill="#62b84a" />
      <path d="M168 292 L150 308 L168 318 Z" fill="#c4a06a" />
      {Array.from({ length: 11 }, (_, index) => (
        <rect key={index} x={324 + index * 8.2} y="148" width="7.4" height="208" fill={index % 2 ? '#f8e08a' : '#f0d15a'} stroke="#d2ae3e" strokeWidth="0.4" />
      ))}
      <rect x="322" y="158" width="94" height="8" fill="#e6c44a" />
      <rect x="322" y="344" width="94" height="8" fill="#e6c44a" />
      <TrashCan />
      <rect x="78" y="292" width="74" height="46" rx="3" fill="#c9894a" stroke="#a86c32" />
      <path d="M82 292 H148 L140 304 H90 Z" fill="#e0a86a" />
      <ellipse cx="470" cy="332" rx="26" ry="9" fill="#e07a32" />
      <ellipse cx="470" cy="328" rx="20" ry="6" fill="#fff8ee" />
      <path d="M458 326 q12 -7 22 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M470 86 L600 48 L600 118 L520 132 Z" fill="#e07a4a" />
      <path d="M500 112 L600 86 V130 L528 140 Z" fill="#c45e34" />
    </g>
  );
}

function TrashCan() {
  return (
    <g>
      <rect x="28" y="248" width="46" height="58" rx="4" fill="#8d97a3" />
      <ellipse cx="51" cy="248" rx="23" ry="7" fill="#a8b1bb" />
      <rect x="36" y="236" width="10" height="12" fill="#e23b4a" transform="rotate(-18 41 242)" />
      <rect x="48" y="232" width="12" height="10" rx="2" fill="#3aa86a" />
      <circle cx="44" cy="258" r="5" fill="#f2c14e" />
    </g>
  );
}

function HudMeters({
  cat,
  dog,
  wind,
  windLabel,
  charge,
  zh,
}: {
  cat: number;
  dog: number;
  wind: number;
  windLabel: string;
  charge: number;
  zh: boolean;
}) {
  const catWarn = cat >= 14 && cat < 23;
  const dogWarn = dog >= 14 && dog < 23;
  return (
    <g aria-hidden="true">
      <rect x="78" y="18" width="360" height="16" rx="8" fill="#7a1d22" />
      <rect x="80" y="20" width={356 * Math.min(1, (cat - 1) / 22)} height="12" rx="6" fill={catWarn || cat >= 23 ? '#ffb020' : '#ef3b3b'} />
      <rect x={440 - 356 * Math.min(1, (dog - 1) / 22)} y="20" width={356 * Math.min(1, (dog - 1) / 22)} height="12" rx="6" fill={dogWarn || dog >= 23 ? '#ff8a3d' : '#f6d34a'} />
      <MiniCat x={86 + 300 * Math.min(1, (cat - 1) / 22)} warn={catWarn} />
      <MiniDog x={424 - 280 * Math.min(1, (dog - 1) / 22)} warn={dogWarn} />
      <g transform="translate(214 40)">
        <path d="M8 10 H132 L146 22 L132 34 H8 L-6 22 Z" fill="#f6c31a" stroke="#e0a40a" />
        <text x="28" y="25" fill="#7a3b00" fontSize="11" fontWeight="800" fontFamily="Arial Rounded MT Bold, Trebuchet MS, sans-serif">{zh ? '風' : 'WIND'} {windLabel}</text>
        <polygon points={wind < 0 ? '16,16 8,22 16,28' : wind > 0 ? '124,16 134,22 124,28' : '70,16 76,22 70,28'} fill="#7a3b00" />
        <rect x="18" y="36" width="104" height="8" rx="4" fill="#1d4c86" />
        <rect x="18" y="36" width={104 * charge} height="8" rx="4" fill={charge > 0.66 ? '#ef3b3b' : '#f6d34a'} />
      </g>
    </g>
  );
}

function MiniCat({ x, warn }: { x: number; warn: boolean }) {
  return (
    <g transform={`translate(${x} 8)`}>
      <ellipse cx="0" cy="8" rx="11" ry="8" fill="#2eafc0" />
      <path d="M-7 4 L-4 -4 L-1 4 M1 4 L4 -4 L7 4" fill="#2eafc0" />
      <circle cx="-3" cy="7" r="1" fill={warn ? '#ef3b3b' : '#17324a'} />
      <circle cx="3" cy="7" r="1" fill={warn ? '#ef3b3b' : '#17324a'} />
    </g>
  );
}

function MiniDog({ x, warn }: { x: number; warn: boolean }) {
  return (
    <g transform={`translate(${x} 8)`}>
      <ellipse cx="0" cy="8" rx="12" ry="8" fill="#c9a06a" />
      <ellipse cx="-8" cy="4" rx="4" ry="6" fill="#a67c45" />
      <ellipse cx="8" cy="4" rx="4" ry="6" fill="#a67c45" />
      <circle cx="-3" cy="8" r="1" fill={warn ? '#ef3b3b' : '#17324a'} />
      <circle cx="3" cy="8" r="1" fill={warn ? '#ef3b3b' : '#17324a'} />
    </g>
  );
}

function YardCat({ pose, winding, warn, item }: { pose: number; winding: boolean; warn: boolean; item: Item }) {
  const transform = pose === 4 ? 'rotate(18 130 300) translate(10 16)' : pose === 3 ? 'translate(4 12) rotate(-6 130 280)' : pose === 2 ? 'rotate(-8 130 270)' : '';
  return (
    <g className={winding ? 'cad-winding' : undefined} transform={transform} aria-hidden="true">
      <path d="M96 292 q18 28 48 18 q8 -22 -6 -30 q-20 2 -42 12 Z" fill="#1d8ea0" />
      <path d="M108 268 q28 -8 36 16 q-8 10 -28 8 q-16 -4 -8 -24 Z" fill="#2eafc0" />
      <circle cx="132" cy="250" r="20" fill="#2eafc0" />
      <path d="M116 238 L122 218 L128 238 Z" fill="#1d8ea0" />
      <path d="M132 236 L140 214 L146 236 Z" fill="#2eafc0" />
      <ellipse cx="142" cy="254" rx="10" ry="7" fill="#f7f1e4" />
      <path d={warn || pose >= 3 ? 'M128 246 L134 250' : 'M126 246 H132'} stroke="#17324a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="136" cy="247" r="1.6" fill="#17324a" />
      <path d="M96 274 q-18 10 -6 22" fill="none" stroke="#1d8ea0" strokeWidth="6" strokeLinecap="round" />
      <g className="cad-arm cad-arm-cat">
        <path d="M146 252 q18 -16 28 -4" fill="none" stroke="#2eafc0" strokeWidth="7" strokeLinecap="round" />
        <circle cx="172" cy="246" r="5" fill="#2eafc0" />
        {winding ? <ProjectileShape side="cat" item={item} x={184} y={236} /> : null}
      </g>
      {pose >= 3 ? <path d="M124 240 q5 7 0 9" fill="none" stroke="#9ee7f0" strokeWidth="2" /> : null}
    </g>
  );
}

function YardDog({ pose, winding, warn, item }: { pose: number; winding: boolean; warn: boolean; item: Item }) {
  const transform = pose === 4 ? 'rotate(-18 530 300) translate(-8 14)' : pose === 3 ? 'translate(-2 10)' : pose === 2 ? 'rotate(8 530 270)' : '';
  return (
    <g className={winding ? 'cad-winding' : undefined} transform={transform} aria-hidden="true">
      <path d="M500 286 q20 30 52 12 q6 -24 -10 -30 q-22 0 -42 18 Z" fill="#a67c45" />
      <path d="M514 262 q26 -6 34 18 q-10 8 -30 6 q-14 -6 -4 -24 Z" fill="#c9a06a" />
      <circle cx="524" cy="236" r="20" fill="#c9a06a" />
      <ellipse cx="510" cy="228" rx="8" ry="13" fill="#a67c45" />
      <ellipse cx="536" cy="232" rx="7" ry="11" fill="#a67c45" />
      <ellipse cx="512" cy="242" rx="11" ry="8" fill="#f7f1e4" />
      <ellipse cx="504" cy="242" rx="5" ry="4" fill="#3a2a22" />
      <circle cx="518" cy="232" r="1.6" fill={warn || pose >= 3 ? '#ef3b3b' : '#17324a'} />
      <circle cx="528" cy="234" r="1.6" fill={warn || pose >= 3 ? '#ef3b3b' : '#17324a'} />
      {pose >= 3 ? <path d="M506 250 q-8 5 -2 7" fill="none" stroke="#e07a8a" strokeWidth="2" strokeLinecap="round" /> : null}
      <rect x="520" y="250" width="14" height="5" rx="2" fill="#e07a32" />
      <path d="M548 278 q16 6 8 16" fill="none" stroke="#a67c45" strokeWidth="6" strokeLinecap="round" />
      <g className="cad-arm cad-arm-dog">
        <path d="M508 258 q-20 -8 -28 2" fill="none" stroke="#c9a06a" strokeWidth="7" strokeLinecap="round" />
        <circle cx="478" cy="258" r="5" fill="#c9a06a" />
        {winding ? <ProjectileShape side="dog" item={item} x={462} y={250} /> : null}
      </g>
    </g>
  );
}

function ProjectileShape({ side, item, x, y }: { side: Side; item: Item; x: number; y: number }) {
  if (side === 'dog' && item !== 'stinkBomb') {
    return <path d={`M${x - 8} ${y} q8 -7 16 0 q-8 7 -16 0`} fill="#f7f1e4" stroke="#d9cbb4" />;
  }
  const fill = item === 'stinkBomb' ? '#3c4a38' : item === 'powerThrow' ? '#ef4b3a' : '#3aa86a';
  return <rect x={x - 6} y={y - 8} width="12" height="16" rx="3" fill={fill} stroke="#17324a" strokeWidth="0.6" />;
}

function Thrown({ flight }: { flight: Flight }) {
  return (
    <g aria-hidden="true">
      <animateMotion dur="0.78s" fill="freeze" path={flight.path} />
      <ProjectileShape side={flight.side} item={flight.item} x={0} y={0} />
    </g>
  );
}

function Stars({ x, y }: { x: number; y: number }) {
  return (
    <g className="cad-stars" aria-hidden="true">
      <circle cx={x - 10} cy={y} r="3" fill="#f6d34a" />
      <circle cx={x + 8} cy={y - 6} r="2.4" fill="#fff" />
      <circle cx={x + 2} cy={y + 8} r="2" fill="#ef9a3a" />
    </g>
  );
}

function ItemGlyph({ item }: { item: Item | 'powerUp' }) {
  if (item === 'doubleAttack') return <span>x2</span>;
  if (item === 'powerThrow') return <span className="cad-glyph-can" />;
  if (item === 'stinkBomb') return <span className="cad-glyph-bomb" />;
  return <span>x</span>;
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
