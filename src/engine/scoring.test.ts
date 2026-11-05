import { describe, expect, it } from 'vitest';
import { parsePattern } from '../rudiments/dsl';
import { buildTimeline, type ExpectedNote } from './timeline';
import { scoreSession, type Hit } from './scoring';

const opts = { accentRatio: 1.25, checkSticking: false };

function expected(src: string, bpm = 60, beatsPerBar = 2): ExpectedNote[] {
  return buildTimeline({ pattern: parsePattern(src, beatsPerBar), bars: 2, tempo: { bpm }, countInBeats: 0 }).notes;
}

/** Plays every note exactly, with velocity 100 on accents and 60 otherwise. */
const play = (notes: ExpectedNote[], shift = 0): Hit[] =>
  notes.map((n) => ({ time: n.time + shift, velocity: n.accent ? 100 : 60, hand: n.hand }));

describe('scoreSession', () => {
  it('gives 100% for perfect playing', () => {
    const notes = expected('@4 >R L R R >L R L L');
    const s = scoreSession(notes, play(notes), opts);
    expect(s.accuracy).toBe(100);
    expect(s.counts.perfect).toBe(notes.length);
    expect(s.accentPct).toBe(100);
    expect(s.extras).toHaveLength(0);
  });

  it('measures a constant 20 ms delay', () => {
    const notes = expected('@4 R L R L R L R L');
    const s = scoreSession(notes, play(notes, 20), opts);
    expect(s.meanOffset).toBeCloseTo(20);
    expect(s.stdDev).toBeCloseTo(0);
    expect(s.counts.good).toBe(notes.length);
  });

  it('counts missed and extra strokes', () => {
    const notes = expected('@4 R L R L R L R L');
    const hits = play(notes).filter((_, i) => i !== 3);
    hits.push({ time: notes[5].time + 125, velocity: 60 });
    const s = scoreSession(notes, hits, opts);
    expect(s.counts.miss).toBe(1);
    expect(s.extras).toHaveLength(1);
    expect(s.accuracy).toBeLessThan(100);
  });

  it('does not judge notes still in the future (live mode)', () => {
    const notes = expected('@4 R L R L R L R L');
    const s = scoreSession(notes, play(notes).slice(0, 4), { ...opts, judgeUntil: notes[3].time + 100 });
    expect(s.results).toHaveLength(4);
    expect(s.counts.miss).toBe(0);
  });

  it('detects missing accents', () => {
    const notes = expected('@4 >R L R R >L R L L');
    const hits = notes.map((n) => ({ time: n.time, velocity: 60 }));
    const s = scoreSession(notes, hits, opts);
    expect(s.results.filter((r) => r.note.accent).every((r) => r.accentOk === false)).toBe(true);
    expect(s.accentPct).toBe(75);
  });

  it('recognises flams with and without a grace note', () => {
    const notes = expected('@2 fR fL fR fL');
    const withGrace = notes.flatMap((n) => [
      { time: n.time - 30, velocity: 40 },
      { time: n.time, velocity: 90 },
    ]);
    const good = scoreSession(notes, withGrace, opts);
    expect(good.gracePct).toBe(100);
    expect(good.counts.perfect).toBe(notes.length);
    expect(good.extras).toHaveLength(0);

    const bare = scoreSession(notes, play(notes), opts);
    expect(bare.gracePct).toBe(0);

    const flat = notes.flatMap((n) => [
      { time: n.time, velocity: 80 },
      { time: n.time + 2, velocity: 80 },
    ]);
    const f = scoreSession(notes, flat, opts);
    expect(f.gracePct).toBe(0);
    expect(f.results.every((r) => r.graceFlat)).toBe(true);
  });

  it('takes the louder late stroke as the main note when the grace lands on the beat', () => {
    const notes = expected('@2 fR fL fR fL');
    const hits = notes.flatMap((n) => [
      { time: n.time, velocity: 40 },
      { time: n.time + 35, velocity: 90 },
    ]);
    const s = scoreSession(notes, hits, opts);
    expect(s.meanOffset).toBeCloseTo(35);
    expect(s.gracePct).toBe(100);
  });

  it('checks drags need two grace notes', () => {
    const notes = expected('@2 dR dL dR dL');
    const hits = notes.flatMap((n) => [
      { time: n.time - 50, velocity: 40 },
      { time: n.time - 25, velocity: 40 },
      { time: n.time, velocity: 90 },
    ]);
    expect(scoreSession(notes, hits, opts).gracePct).toBe(100);
  });

  it('absorbs buzz bounces instead of counting them as extras', () => {
    const notes = expected('@4 R~ L~ R~ L~ R~ L~ R~ L~');
    const hits = notes.flatMap((n) => [0, 40, 80, 120].map((d) => ({ time: n.time + d, velocity: 50 })));
    const s = scoreSession(notes, hits, opts);
    expect(s.extras).toHaveLength(0);
    expect(s.counts.perfect).toBe(notes.length);
  });

  it('checks sticking in two-pad mode', () => {
    const notes = expected('@4 R L R R L R L L');
    const swapped = notes.map((n) => ({ time: n.time, velocity: 60, hand: n.hand === 'R' ? ('L' as const) : ('R' as const) }));
    expect(scoreSession(notes, play(notes), { ...opts, checkSticking: true }).stickingPct).toBe(100);
    expect(scoreSession(notes, swapped, { ...opts, checkSticking: true }).stickingPct).toBe(0);
    expect(scoreSession(notes, swapped, opts).stickingPct).toBeNull();
  });

  it('narrows the window for fast notes so neighbours are not stolen', () => {
    const notes = expected('@8 R R L L R R L L', 120, 1);
    const s = scoreSession(notes, play(notes), opts);
    expect(s.accuracy).toBe(100);
  });
});
