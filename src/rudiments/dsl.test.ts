import { describe, expect, it } from 'vitest';
import { RUDIMENTS } from './data';
import { parsePattern, stickingText, strokeCount } from './dsl';
import { PPQ } from './types';

describe('parsePattern', () => {
  it('parses accents, flams, drags, buzz and rests', () => {
    const p = parsePattern('@4 >R fL dR L~ | @2 R -', 1);
    expect(p.lengthTicks).toBe(2 * PPQ);
    expect(p.notes.map((n) => [n.tick, n.dur, n.hand, n.accent, n.grace, n.buzz, n.rest])).toEqual([
      [0, 12, 'R', true, 'none', false, false],
      [12, 12, 'L', false, 'flam', false, false],
      [24, 12, 'R', false, 'drag', false, false],
      [36, 12, 'L', false, 'none', true, false],
      [48, 24, 'R', false, 'none', false, false],
      [72, 24, 'R', false, 'none', false, true],
    ]);
  });

  it('rejects patterns that do not fill whole bars', () => {
    expect(() => parsePattern('@4 R L R', 2)).toThrow();
    expect(() => parsePattern('@4 R L | R L', 2)).toThrow();
    expect(() => parsePattern('@4 X', 1)).toThrow();
  });
});

describe('the 40 PAS rudiments', () => {
  it('has 40 unique, numbered rudiments', () => {
    expect(RUDIMENTS).toHaveLength(40);
    expect(RUDIMENTS.map((r) => r.number)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(new Set(RUDIMENTS.map((r) => r.id)).size).toBe(40);
  });

  it.each(RUDIMENTS.map((r) => [r.number, r.name, r] as const))('%i %s parses', (_n, _name, r) => {
    const p = parsePattern(r.pattern, r.beatsPerBar);
    expect(p.notes.length).toBeGreaterThan(0);
  });

  const strokes: Record<string, number> = {
    'single-stroke-four': 8,
    'single-stroke-seven': 14,
    'five-stroke-roll': 10,
    'six-stroke-roll': 12,
    'seven-stroke-roll': 14,
    'nine-stroke-roll': 18,
    'ten-stroke-roll': 10,
    'eleven-stroke-roll': 11,
    'thirteen-stroke-roll': 13,
    'fifteen-stroke-roll': 15,
    'seventeen-stroke-roll': 17,
    'single-paradiddle': 8,
    'double-paradiddle': 12,
    'triple-paradiddle': 16,
    'flam': 8,
    'flam-accent': 8,
    'single-ratamacue': 12,
  };
  it.each(Object.entries(strokes))('%s has %i strokes per pattern', (id, n) => {
    const r = RUDIMENTS.find((x) => x.id === id)!;
    expect(strokeCount(parsePattern(r.pattern, r.beatsPerBar))).toBe(n);
  });

  it('writes sticking with grace notes', () => {
    const r = RUDIMENTS.find((x) => x.id === 'flam-paradiddle')!;
    expect(stickingText(parsePattern(r.pattern, r.beatsPerBar))).toBe('>lR L R R >rL R L L');
  });
});
