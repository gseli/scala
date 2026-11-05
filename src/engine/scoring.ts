import type { Hand } from '../rudiments/types';
import type { ExpectedNote } from './timeline';

export interface Hit {
  /** ms on the same clock as the expected notes. */
  time: number;
  velocity: number;
  /** Hand inferred from the pad (two-pad mode) or key; undefined when unknown. */
  hand?: Hand;
}

export type Rating = 'perfect' | 'good' | 'ok' | 'miss';

export interface NoteResult {
  note: ExpectedNote;
  hit?: Hit;
  /** hit.time - note.time, ms (negative = early). */
  offset?: number;
  rating: Rating;
  accentPlayed?: boolean;
  accentOk?: boolean;
  handOk?: boolean;
  /** Only for flams/drags with a matched main stroke. */
  graceOk?: boolean;
  /** Grace note played at the same time as the main stroke. */
  graceFlat?: boolean;
}

export interface ScoreOptions {
  /** Only notes whose window closed before this time are judged (live mode). */
  judgeUntil?: number;
  /** Velocity ratio over the median soft note to count as an accent. */
  accentRatio: number;
  checkSticking: boolean;
}

export interface Score {
  results: NoteResult[];
  extras: Hit[];
  counts: Record<Rating, number>;
  /** 0–100 */
  accuracy: number;
  meanOffset: number;
  stdDev: number;
  /** null when the exercise has nothing to judge for that aspect. */
  accentPct: number | null;
  stickingPct: number | null;
  gracePct: number | null;
}

const MAX_WINDOW = 60;
const MIN_WINDOW = 12;
const GRACE_RANGE = 100;
const FLAT_RANGE = 6;
const WEIGHT: Record<Rating, number> = { perfect: 1, good: 0.75, ok: 0.4, miss: 0 };

/** Matching window per note: ±60 ms, narrowed to 45% of the gap to its neighbours at fast tempos. */
export function windows(notes: ExpectedNote[]): number[] {
  return notes.map((n, i) => {
    const prev = i > 0 ? n.time - notes[i - 1].time : Infinity;
    const next = i < notes.length - 1 ? notes[i + 1].time - n.time : Infinity;
    return Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, 0.45 * Math.min(prev, next)));
  });
}

export function rate(offset: number, window: number): Rating {
  const a = Math.abs(offset);
  if (a <= Math.min(15, window * 0.3)) return 'perfect';
  if (a <= Math.min(35, window * 0.65)) return 'good';
  if (a <= window) return 'ok';
  return 'miss';
}

/** First index whose hit time is >= t. */
function lowerBound(hits: Hit[], t: number): number {
  let lo = 0;
  let hi = hits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function scoreSession(notes: ExpectedNote[], allHits: Hit[], opts: ScoreOptions): Score {
  const hits = [...allHits].sort((a, b) => a.time - b.time);
  const win = windows(notes);
  const until = opts.judgeUntil ?? Infinity;
  const used = new Array<boolean>(hits.length).fill(false);
  const matchOf = new Array<number>(notes.length).fill(-1);

  // A hit followed closely by a louder one is most likely a grace note, not the main stroke.
  const looksLikeGrace = (h: number) => {
    const next = hits[h + 1];
    return !!next && next.time - hits[h].time > FLAT_RANGE && next.time - hits[h].time <= GRACE_RANGE && next.velocity >= hits[h].velocity * 0.9;
  };

  // Greedy global matching: closest (note, hit) pairs first.
  const pairs: { n: number; h: number; d: number }[] = [];
  let lo = 0;
  notes.forEach((note, n) => {
    while (lo < hits.length && hits[lo].time < note.time - win[n]) lo++;
    for (let h = lo; h < hits.length && hits[h].time <= note.time + win[n]; h++) {
      if (note.grace !== 'none' && looksLikeGrace(h)) continue;
      pairs.push({ n, h, d: Math.abs(hits[h].time - note.time) });
    }
  });
  pairs.sort((a, b) => a.d - b.d);
  for (const p of pairs) {
    if (matchOf[p.n] !== -1 || used[p.h]) continue;
    matchOf[p.n] = p.h;
    used[p.h] = true;
  }

  const results: NoteResult[] = [];
  notes.forEach((note, n) => {
    const h = matchOf[n];
    if (h === -1) {
      if (note.time + win[n] <= until) results.push({ note, rating: 'miss' });
      return;
    }
    const hit = hits[h];
    const offset = hit.time - note.time;
    const r: NoteResult = { note, hit, offset, rating: rate(offset, win[n]) };
    if (opts.checkSticking && hit.hand) r.handOk = hit.hand === note.hand;
    results.push(r);
  });

  // Grace notes: unused hits shortly before the matched main stroke, nearest first.
  for (const r of results) {
    if (!r.hit || r.note.grace === 'none') continue;
    const need = r.note.grace === 'flam' ? 1 : 2;
    const main = r.hit.time;
    let found = 0;
    let flat = false;
    for (let h = lowerBound(hits, main + FLAT_RANGE + 1) - 1; h >= 0 && hits[h].time >= main - GRACE_RANGE; h--) {
      if (used[h]) continue;
      const dt = main - hits[h].time;
      if (dt <= FLAT_RANGE) {
        used[h] = true;
        flat = true;
      } else if (found < need) {
        used[h] = true;
        found++;
      }
    }
    r.graceOk = found >= need;
    r.graceFlat = !r.graceOk && flat;
  }

  // Buzz strokes: every bounce inside the note belongs to it.
  for (const r of results) {
    if (!r.hit || !r.note.buzz) continue;
    const end = r.note.time + r.note.durMs - 10;
    for (let h = lowerBound(hits, r.hit.time); h < hits.length && hits[h].time < end; h++) used[h] = true;
  }

  // Accents: relative to the median velocity of the notes that should be soft.
  const hasAccents = notes.some((n) => n.accent);
  const softVel = median(results.filter((r) => r.hit && !r.note.accent).map((r) => r.hit!.velocity));
  if (hasAccents && !Number.isNaN(softVel)) {
    for (const r of results) {
      if (!r.hit) continue;
      r.accentPlayed = r.hit.velocity >= softVel * opts.accentRatio;
      r.accentOk = r.accentPlayed === r.note.accent;
    }
  }

  const first = notes.length ? notes[0].time - win[0] : 0;
  const last = Math.min(until, notes.length ? notes[notes.length - 1].time + notes[notes.length - 1].durMs : 0);
  const extras = hits.filter((x, h) => !used[h] && x.time >= first && x.time <= last);

  const counts: Record<Rating, number> = { perfect: 0, good: 0, ok: 0, miss: 0 };
  results.forEach((r) => counts[r.rating]++);
  const offsets = results.filter((r) => r.offset !== undefined).map((r) => r.offset!);
  const meanOffset = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;
  const stdDev = offsets.length ? Math.sqrt(offsets.reduce((a, b) => a + (b - meanOffset) ** 2, 0) / offsets.length) : 0;
  const weighted = results.reduce((a, r) => a + WEIGHT[r.rating], 0);
  const denom = results.length + extras.length * 0.5;

  const pct = (xs: (boolean | undefined)[]) => {
    const judged = xs.filter((x) => x !== undefined);
    return judged.length ? (100 * judged.filter(Boolean).length) / judged.length : null;
  };

  return {
    results,
    extras,
    counts,
    accuracy: denom ? (100 * weighted) / denom : 0,
    meanOffset,
    stdDev,
    accentPct: pct(results.map((r) => r.accentOk)),
    stickingPct: pct(results.map((r) => r.handOk)),
    gracePct: pct(results.map((r) => r.graceOk)),
  };
}

/** Average weight per pattern note (0–1), to colour the score after a session. */
export function perPatternNote(results: NoteResult[]): Map<number, number> {
  const acc = new Map<number, { s: number; n: number }>();
  for (const r of results) {
    const a = acc.get(r.note.patternIndex) ?? { s: 0, n: 0 };
    let w = WEIGHT[r.rating];
    if (r.accentOk === false || r.handOk === false || r.graceOk === false) w *= 0.5;
    a.s += w;
    a.n++;
    acc.set(r.note.patternIndex, a);
  }
  return new Map([...acc].map(([k, v]) => [k, v.s / v.n]));
}

export function suggestions(s: Score, bpm: number): string[] {
  const out: string[] = [];
  if (s.accuracy >= 90) out.push(`¡Muy bien! Prueba a ${bpm + 5} BPM.`);
  else if (s.accuracy >= 75) out.push(`Buen trabajo. Repite a ${bpm} BPM hasta superar el 90%.`);
  else out.push(`Baja a ${Math.max(30, bpm - 10)} BPM y consolida la precisión antes de subir.`);
  if (s.meanOffset > 10) out.push(`Tiendes a tocar tarde (+${s.meanOffset.toFixed(0)} ms): anticipa un poco el golpe.`);
  if (s.meanOffset < -10) out.push(`Tiendes a apurarte (${s.meanOffset.toFixed(0)} ms): relaja y espera el click.`);
  if (s.stdDev > 25) out.push(`Tus golpes varían bastante (±${s.stdDev.toFixed(0)} ms): busca un movimiento más relajado y constante.`);
  if (s.accentPct !== null && s.accentPct < 80) out.push('Marca más la diferencia entre acentos (altos) y notas suaves (bajas).');
  if (s.gracePct !== null && s.gracePct < 80) {
    const flat = s.results.filter((r) => r.graceFlat).length;
    out.push(flat ? 'Algunas notas de adorno suenan a la vez que la principal: sepáralas un poco.' : 'Faltan notas de adorno: tócalas suaves y pegadas a la nota principal.');
  }
  if (s.stickingPct !== null && s.stickingPct < 90) out.push('Revisa el sticking: varias notas se tocaron con la mano contraria.');
  if (s.extras.length > s.results.length * 0.1) out.push(`Hubo ${s.extras.length} golpes de más.`);
  return out;
}
