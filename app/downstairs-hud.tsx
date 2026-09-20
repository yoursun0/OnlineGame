import { MAX_LIFE } from '@playroom/downstairs';

export function LifeBlock({ label, life }: { label: string; life: number }) {
  const filled = Math.max(0, Math.min(MAX_LIFE, Math.ceil(life)));
  return (
    <div className="well-life">
      <p className="well-life-label">{label}</p>
      <div
        className="well-life-bar"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MAX_LIFE}
        aria-valuenow={filled}
      >
        {Array.from({ length: MAX_LIFE }, (_, index) => (
          <span key={index} className={index < filled ? 'well-life-pip is-on' : 'well-life-pip'} />
        ))}
      </div>
    </div>
  );
}

export function FloorWidget({ label, depth }: { label: string; depth: number }) {
  return (
    <div className="well-floor" aria-label={`${label} ${depth}`}>
      <strong className="well-floor-value">{depth}</strong>
      <span className="well-floor-label">{label}</span>
    </div>
  );
}
