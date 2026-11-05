import { PPQ, patternBars, type Grace, type Hand, type Pattern } from '../rudiments/types';

export interface TempoPlan {
  bpm: number;
  /** Speed ladder: add `step` BPM every `everyBars` bars until reaching `target`. */
  progressive?: { target: number; step: number; everyBars: number };
}

export interface SessionPlan {
  pattern: Pattern;
  /** Requested length in bars (ignored in progressive mode). */
  bars: number;
  tempo: TempoPlan;
  countInBeats: number;
}

export interface Beat {
  /** ms from the session start. */
  time: number;
  bpm: number;
  countIn: boolean;
  downbeat: boolean;
  /** Exercise bar index, -1 during the count-in. */
  bar: number;
  /** 0-based position inside the bar. */
  beatInBar: number;
}

export interface ExpectedNote {
  id: number;
  /** ms from the session start. */
  time: number;
  durMs: number;
  hand: Hand;
  accent: boolean;
  grace: Grace;
  buzz: boolean;
  /** Index into `pattern.notes`, to map results back onto the score. */
  patternIndex: number;
  bar: number;
  bpm: number;
}

export interface Timeline {
  beats: Beat[];
  notes: ExpectedNote[];
  bars: number;
  /** ms from the session start when the last bar ends. */
  endTime: number;
}

export function totalBars(plan: SessionPlan): number {
  const pb = patternBars(plan.pattern);
  let bars = plan.bars;
  const prog = plan.tempo.progressive;
  if (prog) {
    const steps = Math.max(0, Math.ceil((prog.target - plan.tempo.bpm) / prog.step));
    bars = (steps + 1) * prog.everyBars;
  }
  return Math.max(pb, Math.ceil(bars / pb) * pb);
}

export function bpmForBar(tempo: TempoPlan, bar: number): number {
  const prog = tempo.progressive;
  if (!prog) return tempo.bpm;
  return Math.min(prog.target, tempo.bpm + prog.step * Math.floor(bar / prog.everyBars));
}

export function buildTimeline(plan: SessionPlan): Timeline {
  const { pattern, countInBeats, tempo } = plan;
  const bars = totalBars(plan);
  const beats: Beat[] = [];
  let t = 0;

  const startBpm = bpmForBar(tempo, 0);
  for (let i = 0; i < countInBeats; i++) {
    beats.push({ time: t, bpm: startBpm, countIn: true, downbeat: i % pattern.beatsPerBar === 0, bar: -1, beatInBar: i % pattern.beatsPerBar });
    t += 60000 / startBpm;
  }
  for (let bar = 0; bar < bars; bar++) {
    const bpm = bpmForBar(tempo, bar);
    for (let b = 0; b < pattern.beatsPerBar; b++) {
      beats.push({ time: t, bpm, countIn: false, downbeat: b === 0, bar, beatInBar: b });
      t += 60000 / bpm;
    }
  }

  const exerciseBeats = beats.slice(countInBeats);
  const reps = bars / patternBars(pattern);
  const notes: ExpectedNote[] = [];
  for (let r = 0; r < reps; r++) {
    pattern.notes.forEach((n, patternIndex) => {
      if (n.rest) return;
      const tick = r * pattern.lengthTicks + n.tick;
      const beat = exerciseBeats[Math.floor(tick / PPQ)];
      const msPerTick = 60000 / beat.bpm / PPQ;
      notes.push({
        id: notes.length,
        time: beat.time + (tick % PPQ) * msPerTick,
        durMs: n.dur * msPerTick,
        hand: n.hand,
        accent: n.accent,
        grace: n.grace,
        buzz: n.buzz,
        patternIndex,
        bar: beat.bar,
        bpm: beat.bpm,
      });
    });
  }

  return { beats, notes, bars, endTime: t };
}
