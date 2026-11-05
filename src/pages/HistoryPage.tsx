import { useMemo, useState } from 'react';
import { MASTERY, bestFor, deleteSessions, useProgress, type SessionRecord } from '../store/progress';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);
const date = (t: number) => new Date(t).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function HistoryPage() {
  const { sessions } = useProgress();
  const [filter, setFilter] = useState('');

  const exercises = useMemo(() => {
    const m = new Map<string, string>();
    sessions.forEach((s) => m.set(s.exerciseId, s.exerciseName));
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'es', { numeric: true }));
  }, [sessions]);
  const shown = filter ? sessions.filter((s) => s.exerciseId === filter) : sessions;
  const best = filter ? bestFor(sessions, filter) : null;

  return (
    <div>
      <div className="page-head">
        <h2>Historial</h2>
        <div className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todos los ejercicios ({sessions.length} sesiones)</option>
            {exercises.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          {shown.length > 0 && (
            <button
              className="danger"
              onClick={() => {
                if (confirm(filter ? '¿Borrar el historial de este ejercicio?' : '¿Borrar todo el historial?')) deleteSessions(filter || undefined);
              }}
            >
              Borrar
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 && <p className="muted">Todavía no hay sesiones guardadas. ¡A practicar!</p>}

      {best && (
        <div className="panel">
          <p>
            {best.count} sesiones · Mejor precisión <strong>{Math.round(best.bestAccuracy)}%</strong>
            {best.masteredBpm && (
              <>
                {' '}· Tempo dominado (≥{MASTERY}%): <strong>{best.masteredBpm} BPM</strong>
              </>
            )}
          </p>
          <Chart sessions={[...shown].reverse()} />
        </div>
      )}

      {shown.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                {!filter && <th>Ejercicio</th>}
                <th>BPM</th>
                <th>Precisión</th>
                <th>Desvío</th>
                <th>±</th>
                <th>Acentos</th>
                <th>Adornos</th>
                <th>Sticking</th>
                <th>Fallos / extra</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td>{date(s.date)}</td>
                  {!filter && <td>{s.exerciseName}</td>}
                  <td>{s.bpmStart === s.bpmEnd ? s.bpmStart : `${s.bpmStart}→${s.bpmEnd}`}</td>
                  <td className={s.accuracy >= MASTERY ? 'r-perfect' : s.accuracy >= 75 ? 'r-ok' : 'r-miss'}>{pct(s.accuracy)}</td>
                  <td>{`${s.meanOffset > 0 ? '+' : ''}${s.meanOffset.toFixed(0)} ms`}</td>
                  <td>{s.stdDev.toFixed(0)} ms</td>
                  <td>{pct(s.accentPct)}</td>
                  <td>{pct(s.gracePct)}</td>
                  <td>{pct(s.stickingPct)}</td>
                  <td>
                    {s.misses} / {s.extras}
                    {s.source === 'teclado' && <span className="muted"> ⌨</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Accuracy (line) and final BPM (bars) per session, oldest first. */
function Chart({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) return null;
  const W = 640;
  const H = 140;
  const pad = 24;
  const maxBpm = Math.max(...sessions.map((s) => s.bpmEnd));
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (sessions.length - 1);
  const yAcc = (a: number) => H - pad - (a / 100) * (H - 2 * pad);
  const barW = Math.max(2, Math.min(18, (W - 2 * pad) / sessions.length - 4));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución de precisión y tempo">
      <line x1={pad} x2={W - pad} y1={yAcc(MASTERY)} y2={yAcc(MASTERY)} className="chart-goal" />
      {sessions.map((s, i) => {
        const h = (s.bpmEnd / maxBpm) * (H - 2 * pad);
        return <rect key={s.id} x={x(i) - barW / 2} y={H - pad - h} width={barW} height={h} className="chart-bar"><title>{s.bpmEnd} BPM</title></rect>;
      })}
      <polyline className="chart-line" points={sessions.map((s, i) => `${x(i)},${yAcc(s.accuracy)}`).join(' ')} />
      {sessions.map((s, i) => (
        <circle key={s.id} cx={x(i)} cy={yAcc(s.accuracy)} r={3} className="chart-dot"><title>{Math.round(s.accuracy)}%</title></circle>
      ))}
      <text x={pad} y={14} className="chart-text">Precisión (línea) · BPM (barras, máx. {maxBpm})</text>
    </svg>
  );
}
