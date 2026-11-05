import { describe, expect, it } from 'vitest';
import { parsePattern } from '../rudiments/dsl';
import { blocksToPattern } from '../exercises/rhythmChange';
import { buildTimeline, totalBars } from './timeline';

describe('buildTimeline', () => {
  it('places sixteenths at 60 BPM every 250 ms after the count-in', () => {
    const pattern = parsePattern('@4 R L R L R L R L', 2);
    const tl = buildTimeline({ pattern, bars: 2, tempo: { bpm: 60 }, countInBeats: 4 });
    expect(tl.beats).toHaveLength(8);
    expect(tl.notes).toHaveLength(16);
    expect(tl.notes[0].time).toBe(4000);
    expect(tl.notes[1].time).toBe(4250);
    expect(tl.notes[15].time).toBe(7750);
    expect(tl.endTime).toBe(8000);
  });

  it('handles triplets at 120 BPM', () => {
    const pattern = parsePattern('@3 R L R L R L', 2);
    const tl = buildTimeline({ pattern, bars: 1, tempo: { bpm: 120 }, countInBeats: 0 });
    expect(tl.notes.map((n) => Math.round(n.time))).toEqual([0, 167, 333, 500, 667, 833]);
  });

  it('rounds the length up to whole patterns', () => {
    const pattern = parsePattern('@4 R L R L | R L R L', 1);
    expect(totalBars({ pattern, bars: 3, tempo: { bpm: 60 }, countInBeats: 0 })).toBe(4);
  });

  it('ramps the tempo in progressive mode', () => {
    const pattern = parsePattern('@1 R', 1);
    const plan = { pattern, bars: 0, tempo: { bpm: 60, progressive: { target: 80, step: 10, everyBars: 2 } }, countInBeats: 0 };
    const tl = buildTimeline(plan);
    expect(tl.bars).toBe(6);
    expect(tl.notes.map((n) => n.bpm)).toEqual([60, 60, 70, 70, 80, 80]);
    expect(tl.notes[3].time - tl.notes[2].time).toBeCloseTo(60000 / 70);
  });

  it('builds rhythm-change sequences', () => {
    const pattern = blocksToPattern([{ figure: 'quarter', bars: 1 }, { figure: 'triplet', bars: 1 }]);
    const tl = buildTimeline({ pattern, bars: 2, tempo: { bpm: 60 }, countInBeats: 0 });
    expect(tl.notes).toHaveLength(4 + 12);
    expect(tl.notes[5].time).toBeCloseTo(4000 + 1000 / 3);
    expect(tl.notes.slice(0, 4).map((n) => n.hand).join('')).toBe('RLRL');
  });
});
