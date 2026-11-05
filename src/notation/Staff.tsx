import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Annotation,
  AnnotationVerticalJustify,
  Articulation,
  Beam,
  Dot,
  Formatter,
  GraceNote,
  GraceNoteGroup,
  Modifier,
  Renderer,
  Stave,
  StaveNote,
  Tuplet,
  Voice,
} from 'vexflow/bravura';
import { PPQ, type Pattern, type PatternNote } from '../rudiments/types';

const PLAIN: Record<number, [string, number]> = {
  192: ['w', 0], 144: ['h', 1], 96: ['h', 0], 72: ['q', 1], 48: ['q', 0],
  36: ['8', 1], 24: ['8', 0], 18: ['16', 1], 12: ['16', 0], 6: ['32', 0], 3: ['64', 0],
};

/** Notated duration of a tick length; tuplet notes are written as the next plain value (x 3/2). */
function notated(ticks: number): { d: string; dots: number; tuplet: boolean } {
  if (PLAIN[ticks]) return { d: PLAIN[ticks][0], dots: PLAIN[ticks][1], tuplet: false };
  const t = PLAIN[(ticks * 3) / 2];
  if (!t) throw new Error(`Duración no representable: ${ticks} ticks`);
  return { d: t[0], dots: t[1], tuplet: true };
}

const ROW_H = 150;
const CLEF_W = 70;

function minBarWidth(notes: PatternNote[]) {
  return 40 + notes.reduce((w, n) => w + 26 + (n.grace === 'flam' ? 14 : n.grace === 'drag' ? 22 : 0), 0);
}

function buildNote(n: PatternNote): StaveNote {
  const { d, dots } = notated(n.dur);
  const note = new StaveNote({
    keys: [n.rest ? 'b/4' : 'c/5'],
    duration: d + (n.rest ? 'r' : ''),
    dots,
    stem_direction: 1,
    clef: 'percussion',
  });
  if (dots) Dot.buildAndAttach([note], { all: true });
  if (n.rest) return note;
  if (n.grace !== 'none') {
    const count = n.grace === 'flam' ? 1 : 2;
    const graces = Array.from({ length: count }, () => new GraceNote({ keys: ['c/5'], duration: count === 1 ? '8' : '16', slash: count === 1, stem_direction: 1 }));
    const group = new GraceNoteGroup(graces, false);
    if (count > 1) group.beamNotes();
    note.addModifier(group, 0);
  }
  if (n.accent) note.addModifier(new Articulation('a>').setPosition(Modifier.Position.ABOVE), 0);
  if (n.buzz) note.addModifier(new Annotation('z').setVerticalJustification(AnnotationVerticalJustify.TOP), 0);
  const sticking = new Annotation(n.hand).setVerticalJustification(AnnotationVerticalJustify.BOTTOM);
  sticking.setFont('sans-serif', 13, 'bold');
  note.addModifier(sticking, 0);
  return note;
}

function tuplets(notes: PatternNote[], vf: StaveNote[]): Tuplet[] {
  const out: Tuplet[] = [];
  let chunk: number[] = [];
  const flush = () => {
    if (!chunk.length) return;
    const durs = chunk.map((i) => notes[i].dur);
    const total = durs.reduce((a, b) => a + b, 0);
    let num = total / Math.max(...durs);
    if (!Number.isInteger(num) || num % 3) num = total / Math.min(...durs);
    out.push(new Tuplet(chunk.map((i) => vf[i]), { num_notes: num, notes_occupied: (num * 2) / 3, bracketed: true, ratioed: false }));
    chunk = [];
  };
  notes.forEach((n, i) => {
    if (!notated(n.dur).tuplet) return flush();
    chunk.push(i);
    if ((n.tick + n.dur) % PPQ === 0) flush();
  });
  flush();
  return out;
}

function beams(notes: PatternNote[], vf: StaveNote[]): Beam[] {
  const out: Beam[] = [];
  let group: number[] = [];
  const flush = () => {
    if (group.length > 1) out.push(new Beam(group.map((i) => vf[i])));
    group = [];
  };
  notes.forEach((n, i) => {
    const beat = Math.floor(n.tick / PPQ);
    if (n.rest || n.dur >= PPQ) return flush();
    if (group.length && Math.floor(notes[group[0]].tick / PPQ) !== beat) flush();
    group.push(i);
  });
  flush();
  return out;
}

interface Props {
  pattern: Pattern;
  /** Pattern note index currently playing. */
  highlight?: number;
  /** Per pattern note score 0–1, shown as colours after a session. */
  quality?: Map<number, number>;
}

export function Staff({ pattern, highlight, quality }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<number, SVGElement>());
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || width < 100) return;
    el.innerHTML = '';
    els.current.clear();
    try {
      const barTicks = pattern.beatsPerBar * PPQ;
      const bars: { notes: PatternNote[]; first: number }[] = [];
      pattern.notes.forEach((n, i) => {
        const b = Math.floor(n.tick / barTicks);
        bars[b] ??= { notes: [], first: i };
        bars[b].notes.push(n);
      });

      // Lay bars out in rows that fit the width.
      const avail = width - 10;
      const rows: number[][] = [[]];
      let used = CLEF_W;
      bars.forEach((bar, i) => {
        const w = minBarWidth(bar.notes);
        if (rows[rows.length - 1].length && used + w > avail) {
          rows.push([]);
          used = CLEF_W;
        }
        rows[rows.length - 1].push(i);
        used += w;
      });

      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, rows.length * ROW_H + 10);
      const ctx = renderer.getContext();

      rows.forEach((row, r) => {
        const total = row.reduce((a, i) => a + minBarWidth(bars[i].notes), 0);
        const scale = (avail - CLEF_W) / total;
        let x = 5;
        row.forEach((barIdx, k) => {
          const bar = bars[barIdx];
          const w = minBarWidth(bar.notes) * Math.min(scale, 3) + (k === 0 ? CLEF_W : 0);
          const stave = new Stave(x, r * ROW_H + 20, w);
          if (k === 0) stave.addClef('percussion');
          if (barIdx === 0) stave.addTimeSignature(`${pattern.beatsPerBar}/4`);
          stave.setContext(ctx).draw();

          const vf = bar.notes.map(buildNote);
          const tps = tuplets(bar.notes, vf);
          const bms = beams(bar.notes, vf);
          const voice = new Voice({ num_beats: pattern.beatsPerBar, beat_value: 4 }).setMode(Voice.Mode.SOFT);
          voice.addTickables(vf);
          new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 12);
          voice.draw(ctx, stave);
          bms.forEach((b) => b.setContext(ctx).draw());
          tps.forEach((t) => t.setContext(ctx).draw());

          vf.forEach((n, j) => {
            const svg = n.getSVGElement();
            if (svg) els.current.set(bar.first + j, svg);
          });
          x += w;
        });
      });
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [pattern, width]);

  useEffect(() => {
    els.current.forEach((svg, i) => {
      svg.classList.toggle('vf-hl', i === highlight);
      const q = quality?.get(i);
      svg.classList.toggle('vf-good', q !== undefined && q >= 0.85);
      svg.classList.toggle('vf-mid', q !== undefined && q >= 0.6 && q < 0.85);
      svg.classList.toggle('vf-bad', q !== undefined && q < 0.6);
    });
  }, [highlight, quality, pattern, width]);

  return (
    <div className="staff">
      <div ref={ref} />
      {error && <p className="error">Error al dibujar la partitura: {error}</p>}
    </div>
  );
}
