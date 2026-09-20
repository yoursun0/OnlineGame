import { MAX_LIFE } from '@playroom/downstairs';

export const WELL_LIFE_SEGMENTS = MAX_LIFE;

export type WellLifeLanguage = 'en' | 'zh-Hant';
export type WellLifeTone = 0 | 1 | 2 | 3;

export function clampWellLife(life: number, segments = WELL_LIFE_SEGMENTS): number {
  if (!Number.isFinite(life)) return 0;
  return Math.max(0, Math.min(segments, Math.ceil(life)));
}

export function wellLifeFloorText(floor: number, language: WellLifeLanguage): string {
  return language === 'zh-Hant' ? `${floor}層` : `${floor} floors`;
}

export function wellLifeAriaLabel(
  label: string,
  life: number,
  floor: number,
  language: WellLifeLanguage,
): string {
  const filled = clampWellLife(life);
  const floorText = wellLifeFloorText(floor, language);
  return language === 'zh-Hant'
    ? `${label} ${filled}，${floorText}`
    : `${label} ${filled}, ${floorText}`;
}

export function WellLifeBlock({
  label,
  life,
  floor,
  language,
  tone = 0,
  align = 'left',
}: {
  label: string;
  life: number;
  floor: number;
  language: WellLifeLanguage;
  tone?: WellLifeTone;
  align?: 'left' | 'right';
}) {
  const filled = clampWellLife(life);
  const floorText = wellLifeFloorText(floor, language);
  const aria = wellLifeAriaLabel(label, filled, floor, language);
  const lifeName = language === 'zh-Hant' ? `${label} ${filled}` : `${label} ${filled}`;

  return (
    <div
      className={align === 'right' ? 'well-life-block is-right' : 'well-life-block'}
      data-tone={tone}
    >
      <p className="well-life-label">
        {label} · {floorText}
      </p>
      <div
        className="well-life-bar"
        role="meter"
        aria-label={aria}
        aria-valuemin={0}
        aria-valuemax={WELL_LIFE_SEGMENTS}
        aria-valuenow={filled}
        title={lifeName}
      >
        {Array.from({ length: WELL_LIFE_SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={index < filled ? 'well-life-seg is-filled' : 'well-life-seg'}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
