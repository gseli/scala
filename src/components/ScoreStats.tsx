import type { Score } from '../engine/scoring';

const fmt = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);

export function ScoreStats({ score }: { score: Score }) {
  const c = score.counts;
  return (
    <div className="stats">
      <Stat label="Precisión" value={fmt(score.accuracy)} big />
      <Stat label="Desvío medio" value={`${score.meanOffset > 0 ? '+' : ''}${score.meanOffset.toFixed(0)} ms`} />
      <Stat label="Consistencia" value={`±${score.stdDev.toFixed(0)} ms`} />
      <Stat label="Acentos" value={fmt(score.accentPct)} />
      <Stat label="Adornos" value={fmt(score.gracePct)} />
      <Stat label="Sticking" value={fmt(score.stickingPct)} />
      <div className="stat counts">
        <span className="r-perfect">{c.perfect} perfectos</span>
        <span className="r-good">{c.good} bien</span>
        <span className="r-ok">{c.ok} justos</span>
        <span className="r-miss">{c.miss} fallados</span>
        <span className="r-extra">{score.extras.length} de más</span>
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className={`stat ${big ? 'big' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
