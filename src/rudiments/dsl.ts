import { PPQ, type Grace, type Hand, type Pattern, type PatternNote } from './types';

/**
 * Pattern mini-language. Tokens are separated by whitespace:
 *
 *   @n     set the subdivision to n notes per quarter (1, 2, 3, 4, 6, 8)
 *   R, L   a stroke with the right / left hand, lasting one subdivision
 *   >      prefix: accent                      e.g. >R
 *   f      prefix: flam (one grace note)       e.g. fR, >fL
 *   d      prefix: drag (two grace notes)      e.g. dR
 *   ~      suffix: buzz stroke                 e.g. R~
 *   -      rest of one subdivision
 *   |      bar line (only checked, never required)
 *
 * The default subdivision is @4 (sixteenth notes).
 */
export function parsePattern(src: string, beatsPerBar: number): Pattern {
  const barTicks = beatsPerBar * PPQ;
  const notes: PatternNote[] = [];
  let unit = PPQ / 4;
  let tick = 0;

  for (const raw of src.trim().split(/\s+/)) {
    if (raw === '|') {
      if (tick % barTicks !== 0) throw new Error(`Barra fuera de lugar en tick ${tick}: "${src}"`);
      continue;
    }
    if (raw.startsWith('@')) {
      const div = Number(raw.slice(1));
      if (!Number.isInteger(PPQ / div)) throw new Error(`Subdivisión inválida ${raw}`);
      unit = PPQ / div;
      continue;
    }
    if (raw === '-') {
      notes.push({ tick, dur: unit, rest: true, hand: 'R', accent: false, grace: 'none', buzz: false });
      tick += unit;
      continue;
    }
    const m = /^(>?)([fd]?)([RL])(~?)$/.exec(raw);
    if (!m) throw new Error(`Token inválido "${raw}" en "${src}"`);
    const grace: Grace = m[2] === 'f' ? 'flam' : m[2] === 'd' ? 'drag' : 'none';
    notes.push({
      tick,
      dur: unit,
      rest: false,
      hand: m[3] as Hand,
      accent: m[1] === '>',
      grace,
      buzz: m[4] === '~',
    });
    tick += unit;
  }

  if (tick === 0 || tick % barTicks !== 0) {
    throw new Error(`El patrón dura ${tick / PPQ} tiempos, no es múltiplo de ${beatsPerBar}: "${src}"`);
  }
  return { notes, beatsPerBar, lengthTicks: tick };
}

export const opposite = (h: Hand): Hand => (h === 'R' ? 'L' : 'R');

/** Strokes in the pattern including grace notes (what you actually hit). */
export function strokeCount(p: Pattern): number {
  return p.notes.reduce((n, x) => (x.rest ? n : n + 1 + (x.grace === 'flam' ? 1 : x.grace === 'drag' ? 2 : 0)), 0);
}

/** Sticking as text, e.g. "lR L R R" (grace notes in lowercase). */
export function stickingText(p: Pattern): string {
  return p.notes
    .filter((n) => !n.rest)
    .map((n) => {
      const g = opposite(n.hand).toLowerCase();
      const pre = n.grace === 'flam' ? g : n.grace === 'drag' ? g + g : '';
      return (n.accent ? '>' : '') + pre + n.hand;
    })
    .join(' ');
}
