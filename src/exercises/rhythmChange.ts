import { PPQ, type Hand, type Pattern, type PatternNote } from '../rudiments/types';

export type Figure = 'half' | 'quarter' | 'eighth' | 'triplet' | 'sixteenth' | 'sextuplet';

export const FIGURES: { id: Figure; name: string; perBeat: number }[] = [
  { id: 'half', name: 'Blancas', perBeat: 0.5 },
  { id: 'quarter', name: 'Negras', perBeat: 1 },
  { id: 'eighth', name: 'Corcheas', perBeat: 2 },
  { id: 'triplet', name: 'Tresillos', perBeat: 3 },
  { id: 'sixteenth', name: 'Semicorcheas', perBeat: 4 },
  { id: 'sextuplet', name: 'Sextillos', perBeat: 6 },
];

export const figureName = (f: Figure) => FIGURES.find((x) => x.id === f)!.name;

export interface Block {
  figure: Figure;
  bars: number;
}

export const BEATS_PER_BAR = 4;

export const PRESETS: { name: string; blocks: Block[] }[] = [
  {
    name: 'Escalera (sube y baja)',
    blocks: ['half', 'quarter', 'eighth', 'triplet', 'sixteenth', 'triplet', 'eighth', 'quarter'].map((f) => ({ figure: f as Figure, bars: 1 })),
  },
  {
    name: 'Corcheas ↔ tresillos',
    blocks: [{ figure: 'eighth', bars: 1 }, { figure: 'triplet', bars: 1 }, { figure: 'eighth', bars: 1 }, { figure: 'triplet', bars: 1 }],
  },
  {
    name: 'Tresillos ↔ semicorcheas',
    blocks: [{ figure: 'triplet', bars: 1 }, { figure: 'sixteenth', bars: 1 }, { figure: 'triplet', bars: 1 }, { figure: 'sixteenth', bars: 1 }],
  },
  {
    name: 'Pirámide completa',
    blocks: ['quarter', 'eighth', 'triplet', 'sixteenth', 'sextuplet', 'sixteenth', 'triplet', 'eighth', 'quarter'].map((f) => ({ figure: f as Figure, bars: 2 })),
  },
];

/** Random sequence: never repeats the same figure twice in a row. */
export function randomBlocks(count: number, barsEach: number, pool: Figure[], rand = Math.random): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < count; i++) {
    const options = pool.length > 1 ? pool.filter((f) => f !== blocks[i - 1]?.figure) : pool;
    blocks.push({ figure: options[Math.floor(rand() * options.length)], bars: barsEach });
  }
  return blocks;
}

/** Alternating sticking (R L R L ...) across the whole sequence, no accents. */
export function blocksToPattern(blocks: Block[]): Pattern {
  const notes: PatternNote[] = [];
  let tick = 0;
  let hand: Hand = 'R';
  for (const b of blocks) {
    const perBeat = FIGURES.find((f) => f.id === b.figure)!.perBeat;
    const dur = PPQ / perBeat;
    const count = (b.bars * BEATS_PER_BAR * PPQ) / dur;
    for (let i = 0; i < count; i++) {
      notes.push({ tick, dur, rest: false, hand, accent: false, grace: 'none', buzz: false });
      tick += dur;
      hand = hand === 'R' ? 'L' : 'R';
    }
  }
  return { notes, beatsPerBar: BEATS_PER_BAR, lengthTicks: tick };
}

/** Bar index where each block starts, used to announce the next change. */
export function blockStarts(blocks: Block[]): number[] {
  const starts: number[] = [];
  let bar = 0;
  for (const b of blocks) {
    starts.push(bar);
    bar += b.bars;
  }
  return starts;
}
