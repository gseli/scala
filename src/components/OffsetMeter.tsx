import type { Rating } from '../engine/scoring';

const RANGE = 60;

interface Props {
  recent: { offset: number; rating: Rating }[];
}

/** Recent strokes on an early ← on time → late scale. */
export function OffsetMeter({ recent }: Props) {
  const last = recent.slice(-8);
  const mean = last.length ? last.reduce((a, r) => a + r.offset, 0) / last.length : null;
  const pos = (ms: number) => `${50 + (Math.max(-RANGE, Math.min(RANGE, ms)) / RANGE) * 50}%`;

  let label = 'Esperando golpes…';
  let tone = '';
  if (mean !== null) {
    if (Math.abs(mean) <= 8) [label, tone] = ['A tiempo', 'ok'];
    else if (mean > 0) [label, tone] = [`Atrasado +${mean.toFixed(0)} ms`, mean > 25 ? 'bad' : 'warn'];
    else [label, tone] = [`Adelantado ${mean.toFixed(0)} ms`, mean < -25 ? 'bad' : 'warn'];
  }

  return (
    <div className="meter">
      <div className={`meter-label ${tone}`}>{label}</div>
      <div className="meter-track">
        <span className="meter-zone" />
        <span className="meter-center" />
        {recent.map((r, i) => (
          <span key={i} className={`meter-dot r-${r.rating}`} style={{ left: pos(r.offset), opacity: 0.25 + (0.75 * (i + 1)) / recent.length }} />
        ))}
        {mean !== null && <span className="meter-mean" style={{ left: pos(mean) }} />}
      </div>
      <div className="meter-scale">
        <span>Adelantado</span>
        <span>0</span>
        <span>Atrasado</span>
      </div>
    </div>
  );
}
