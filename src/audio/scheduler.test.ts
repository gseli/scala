import { describe, expect, it } from 'vitest';
import type { ExpectedNote } from '../engine/timeline';
import { beatClicks, guideStrokes } from './scheduler';

describe('beatClicks', () => {
  it('adds softer subdivision clicks between beats', () => {
    const beats = [
      { time: 0, bpm: 60, downbeat: true, countIn: false },
      { time: 1000, bpm: 60, downbeat: false, countIn: false },
    ];
    const clicks = beatClicks(beats, 10, 3);
    expect(clicks.map((c) => +(c.time - 10).toFixed(3))).toEqual([0, 0.333, 0.667, 1, 1.333, 1.667]);
    expect(clicks.map((c) => c.accent)).toEqual([true, false, false, false, false, false]);
    expect(clicks.map((c) => !!c.sub)).toEqual([false, true, true, false, true, true]);
  });
});

describe('guideStrokes', () => {
  const note = (time: number, extra: Partial<ExpectedNote> = {}): ExpectedNote => ({
    id: 0, time, durMs: 250, hand: 'R', accent: false, grace: 'none', buzz: false, patternIndex: 0, bar: 0, bpm: 60, ...extra,
  });

  it('plays accents louder and pans by hand', () => {
    const [a, b] = guideStrokes([note(0, { accent: true }), note(250, { hand: 'L' })], 1);
    expect(a.time).toBe(1);
    expect(a.stroke!.level).toBeGreaterThan(b.stroke!.level);
    expect(a.stroke!.pan).toBeGreaterThan(0);
    expect(b.stroke!.pan).toBeLessThan(0);
  });

  it('adds grace notes from the other hand before flams and drags', () => {
    const flam = guideStrokes([note(1000, { grace: 'flam' })], 0);
    expect(flam).toHaveLength(2);
    expect(flam[0].time).toBeLessThan(flam[1].time);
    expect(flam[0].stroke!.pan).toBeLessThan(0);
    expect(guideStrokes([note(1000, { grace: 'drag' })], 0)).toHaveLength(3);
  });

  it('turns buzz strokes into several soft bounces', () => {
    expect(guideStrokes([note(0, { buzz: true })], 0).length).toBeGreaterThan(4);
  });
});
