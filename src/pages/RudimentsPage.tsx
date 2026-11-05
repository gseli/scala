import { useMemo, useState } from 'react';
import { CATEGORY_NAMES, RUDIMENTS } from '../rudiments/data';
import { parsePattern, stickingText } from '../rudiments/dsl';
import type { RudimentCategory } from '../rudiments/types';
import { bestFor, useProgress } from '../store/progress';

export function RudimentsPage() {
  const { sessions } = useProgress();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return RUDIMENTS.filter((r) => !t || `${r.number} ${r.name} ${r.nameEs}`.toLowerCase().includes(t));
  }, [q]);

  return (
    <div>
      <div className="page-head">
        <h2>Los 40 rudimentos esenciales</h2>
        <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {(Object.keys(CATEGORY_NAMES) as RudimentCategory[]).map((cat) => {
        const list = filtered.filter((r) => r.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h3 className="cat">{CATEGORY_NAMES[cat]}</h3>
            <div className="grid">
              {list.map((r) => {
                const best = bestFor(sessions, r.id);
                return (
                  <a key={r.id} className="card" href={`#/rudimento/${r.id}`}>
                    <span className="num">{r.number}</span>
                    <div className="card-body">
                      <strong>{r.nameEs}</strong>
                      {r.nameEs !== r.name && <span className="muted">{r.name}</span>}
                      <code className="sticking">{stickingText(parsePattern(r.pattern, r.beatsPerBar))}</code>
                    </div>
                    {best && (
                      <span className={`badge ${best.masteredBpm ? 'ok' : ''}`}>
                        {best.masteredBpm ? `${best.masteredBpm} BPM` : `${Math.round(best.bestAccuracy)}%`}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
