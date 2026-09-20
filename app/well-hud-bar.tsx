import { WellLifeBlock, type WellLifeLanguage, type WellLifeTone } from './well-life-block';

export type WellHudKid = {
  life: number;
  best?: number;
};

export type WellHudSeat = {
  label: string;
  life: number;
  floor: number;
  tone: WellLifeTone;
};

const TONES: WellLifeTone[] = [0, 1, 2, 3];

export function wellHudSeatLabel(index: number): string {
  return `P${index + 1}`;
}

export function wellHudSeatsFromKids(kids: readonly WellHudKid[]): WellHudSeat[] {
  return kids.slice(0, 4).map((kid, index) => ({
    label: wellHudSeatLabel(index),
    life: kid.life,
    floor: kid.best ?? 0,
    tone: TONES[index] ?? 0,
  }));
}

export function wellHudDepthUnit(language: WellLifeLanguage, paused = false): string {
  if (paused) return language === 'zh-Hant' ? '暫停' : 'Paused';
  return language === 'zh-Hant' ? '層' : 'floors';
}

export function wellHudAriaLabel(depth: number, language: WellLifeLanguage): string {
  return language === 'zh-Hant' ? `井深 ${depth}層` : `Well depth ${depth} floors`;
}

function SeatOrSpacer({
  seat,
  language,
  align = 'left',
}: {
  seat: WellHudSeat | undefined;
  language: WellLifeLanguage;
  align?: 'left' | 'right';
}) {
  if (!seat) return <div className="well-hud-spacer" />;
  return (
    <WellLifeBlock
      label={seat.label}
      life={seat.life}
      floor={seat.floor}
      language={language}
      tone={seat.tone}
      align={align}
    />
  );
}

export function WellHudBar({
  seats,
  depth,
  language,
  paused = false,
}: {
  seats: readonly WellHudSeat[];
  depth: number;
  language: WellLifeLanguage;
  paused?: boolean;
}) {
  const p1 = seats[0];
  const p2 = seats[1];
  const p3 = seats[2];
  const p4 = seats[3];
  const unit = wellHudDepthUnit(language, paused);

  return (
    <div className="well-hud-bar" data-seats={seats.length}>
      <div className="well-hud-row">
        <SeatOrSpacer seat={p1} language={language} />
        <div className="well-hud-center" aria-label={wellHudAriaLabel(depth, language)}>
          <p className="well-hud-depth">{depth}</p>
          <p className={paused ? 'well-hud-unit is-paused' : 'well-hud-unit'}>{unit}</p>
        </div>
        <SeatOrSpacer seat={p2} language={language} align="right" />
      </div>
      {seats.length >= 3 && (
        <div className="well-hud-row">
          <SeatOrSpacer seat={p3} language={language} />
          <SeatOrSpacer seat={p4} language={language} align="right" />
        </div>
      )}
    </div>
  );
}
