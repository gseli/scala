import { useMemo } from 'react';
import { PracticeSession } from '../components/PracticeSession';
import { CATEGORY_NAMES, RUDIMENTS, rudimentById } from '../rudiments/data';
import { parsePattern, stickingText } from '../rudiments/dsl';

export function RudimentPage({ id }: { id: string }) {
  const r = rudimentById(id);
  const pattern = useMemo(() => (r ? parsePattern(r.pattern, r.beatsPerBar) : null), [r]);
  if (!r || !pattern) return <p>Rudimento no encontrado. <a href="#/">Volver</a></p>;

  const prev = RUDIMENTS[r.number - 2];
  const next = RUDIMENTS[r.number];
  return (
    <div>
      <div className="page-head">
        <div>
          <a href="#/" className="muted">← Rudimentos</a>
          <h2>
            <span className="num inline">{r.number}</span> {r.nameEs}
            {r.nameEs !== r.name && <small className="muted"> · {r.name}</small>}
          </h2>
          <p className="muted">
            {CATEGORY_NAMES[r.category]} · <code>{stickingText(pattern)}</code>
          </p>
          {r.tip && <p className="tip">💡 {r.tip}</p>}
        </div>
        <div className="prevnext">
          {prev && <a href={`#/rudimento/${prev.id}`}>← {prev.number}</a>}
          {next && <a href={`#/rudimento/${next.id}`}>{next.number} →</a>}
        </div>
      </div>
      <PracticeSession key={r.id} exerciseId={r.id} exerciseName={`${r.number}. ${r.nameEs}`} pattern={pattern} defaultBpm={r.defaultBpm} />
    </div>
  );
}
