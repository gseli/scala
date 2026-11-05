import { useMemo, useState } from 'react';
import { PracticeSession } from '../components/PracticeSession';
import { BEATS_PER_BAR, FIGURES, PRESETS, blocksToPattern, figureName, randomBlocks, type Block, type Figure } from '../exercises/rhythmChange';

const SHORT: Record<Figure, string> = { half: 'h', quarter: 'q', eighth: '8', triplet: '3', sixteenth: '16', sextuplet: '6' };

export function RhythmChangePage() {
  const [blocks, setBlocks] = useState<Block[]>(PRESETS[0].blocks);
  const [count, setCount] = useState(6);
  const [barsEach, setBarsEach] = useState(1);
  const [pool, setPool] = useState<Figure[]>(['quarter', 'eighth', 'triplet', 'sixteenth']);

  const pattern = useMemo(() => blocksToPattern(blocks), [blocks]);
  const id = `cambios:${blocks.map((b) => `${SHORT[b.figure]}x${b.bars}`).join('-')}`;
  const name = `Cambios: ${blocks.map((b) => figureName(b.figure)).join(' → ')}`;

  const update = (i: number, patch: Partial<Block>) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const c = [...bs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Cambios de figura</h2>
          <p className="muted">
            Arma una secuencia de figuras (en 4/4, golpes alternados R L) y practica los cambios sin perder el pulso.
          </p>
        </div>
      </div>

      <div className="panel builder">
        <div className="builder-row">
          <span className="muted">Presets:</span>
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => setBlocks(p.blocks)}>{p.name}</button>
          ))}
        </div>

        <div className="blocks">
          {blocks.map((b, i) => (
            <div key={i} className="block">
              <select value={b.figure} onChange={(e) => update(i, { figure: e.target.value as Figure })}>
                {FIGURES.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select value={b.bars} onChange={(e) => update(i, { bars: +e.target.value })}>
                {[1, 2, 4].map((n) => (
                  <option key={n} value={n}>{n} c.</option>
                ))}
              </select>
              <div className="block-actions">
                <button title="Mover a la izquierda" onClick={() => move(i, -1)}>‹</button>
                <button title="Mover a la derecha" onClick={() => move(i, 1)}>›</button>
                <button title="Quitar" disabled={blocks.length === 1} onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
          <button className="add" onClick={() => setBlocks((bs) => [...bs, { figure: 'quarter', bars: 1 }])}>+ Agregar</button>
        </div>

        <div className="builder-row random">
          <span className="muted">Aleatorio:</span>
          {FIGURES.map((f) => (
            <label key={f.id} className="chip">
              <input
                type="checkbox"
                checked={pool.includes(f.id)}
                onChange={(e) => setPool((p) => (e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id)))}
              />
              {f.name}
            </label>
          ))}
          <select value={count} onChange={(e) => setCount(+e.target.value)}>
            {[4, 6, 8, 12, 16].map((n) => (
              <option key={n} value={n}>{n} cambios</option>
            ))}
          </select>
          <select value={barsEach} onChange={(e) => setBarsEach(+e.target.value)}>
            {[1, 2, 4].map((n) => (
              <option key={n} value={n}>{n} compás{n > 1 ? 'es' : ''} c/u</option>
            ))}
          </select>
          <button className="primary" disabled={pool.length === 0} onClick={() => setBlocks(randomBlocks(count, barsEach, pool))}>
            🎲 Generar
          </button>
        </div>
        <p className="muted small">
          {blocks.reduce((a, b) => a + b.bars, 0)} compases de {BEATS_PER_BAR}/4 por vuelta.
        </p>
      </div>

      <PracticeSession key={id} exerciseId={id} exerciseName={name} pattern={pattern} defaultBpm={70} blocks={blocks} />
    </div>
  );
}
