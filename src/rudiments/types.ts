/** Ticks per quarter note. Divisible by 2, 3, 4, 6, 8 and 16 so every subdivision is exact. */
export const PPQ = 48;

export type Hand = 'R' | 'L';
export type Grace = 'none' | 'flam' | 'drag';

export interface PatternNote {
  /** Start position in ticks from the beginning of the pattern. */
  tick: number;
  /** Duration in ticks (also used for notation). */
  dur: number;
  rest: boolean;
  hand: Hand;
  accent: boolean;
  grace: Grace;
  buzz: boolean;
}

export interface Pattern {
  notes: PatternNote[];
  /** Beats (quarter notes) per bar. */
  beatsPerBar: number;
  /** Total length in ticks; always a whole number of bars. */
  lengthTicks: number;
}

export type RudimentCategory = 'roll' | 'diddle' | 'flam' | 'drag';

export interface Rudiment {
  /** PAS number, 1–40. */
  number: number;
  id: string;
  name: string;
  nameEs: string;
  category: RudimentCategory;
  beatsPerBar: number;
  /** Pattern in the DSL understood by `parsePattern`. */
  pattern: string;
  defaultBpm: number;
  tip?: string;
}

export const patternBars = (p: Pattern) => p.lengthTicks / (p.beatsPerBar * PPQ);
