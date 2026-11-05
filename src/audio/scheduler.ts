import type { ExpectedNote } from '../engine/timeline';
import { audioContext } from './clock';

export interface Click {
  /** AudioContext time in seconds. */
  time: number;
  accent: boolean;
  countIn: boolean;
  /** Subdivision click between beats (softer). */
  sub?: boolean;
  /** A guide drum stroke instead of a metronome click. Pan: -1 left hand … 1 right hand. */
  stroke?: { level: number; pan: number };
}

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

/**
 * Lookahead scheduler: a coarse timer queues clicks slightly ahead on the audio clock, so the
 * sound itself is sample-accurate even if the main thread is busy.
 */
export class ClickScheduler {
  private source: (i: number) => Click | undefined = () => undefined;
  private next = 0;
  private timer: number | undefined;
  private sources: AudioScheduledSourceNode[] = [];
  private noise: AudioBuffer | null = null;
  private guideVolume = 0.8;

  constructor(private volume = 0.7) {}

  setVolume(v: number) {
    this.volume = v;
  }

  setGuideVolume(v: number) {
    this.guideVolume = v;
  }

  start(clicks: Click[]) {
    this.stream((i) => clicks[i]);
  }

  /** Endless (or finite) click source: `next(i)` returns the i-th click, undefined to end. */
  stream(next: (i: number) => Click | undefined) {
    this.stop();
    this.source = next;
    this.next = 0;
    this.pump();
    this.timer = window.setInterval(() => this.pump(), TICK_MS);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources = [];
  }

  private pump() {
    const ctx = audioContext();
    let c = this.source(this.next);
    while (c && c.time < ctx.currentTime + LOOKAHEAD_S) {
      this.play(c);
      c = this.source(++this.next);
    }
    if (!c) window.clearInterval(this.timer);
  }

  private track(node: AudioScheduledSourceNode) {
    this.sources.push(node);
    node.onended = () => {
      this.sources = this.sources.filter((s) => s !== node);
    };
  }

  private play(c: Click) {
    if (c.stroke) return this.playStroke(c.time, c.stroke.level, c.stroke.pan);
    const ctx = audioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = c.sub ? 2350 : c.accent ? 1760 : c.countIn ? 880 : 1175;
    const peak = this.volume * (c.sub ? 0.22 : c.accent ? 1 : 0.6);
    gain.gain.setValueAtTime(0.0001, c.time);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), c.time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.time + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(c.time);
    osc.stop(c.time + 0.07);
    this.track(osc);
  }

  /** Short snare-like hit: band-passed noise plus a falling sine for the body. */
  private playStroke(t: number, level: number, panValue: number) {
    const ctx = audioContext();
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.15), ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const peak = Math.max(this.guideVolume * level, 0.0002);
    const pan = ctx.createStereoPanner();
    pan.pan.value = panValue;
    pan.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    src.connect(bp).connect(ng).connect(pan);
    src.start(t);
    src.stop(t + 0.12);
    this.track(src);

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(og).connect(pan);
    osc.start(t);
    osc.stop(t + 0.08);
    this.track(osc);
  }
}

/** One click per beat plus `subdiv - 1` softer clicks in between. Beat times in ms from `t0` (seconds). */
export function beatClicks(beats: { time: number; bpm: number; downbeat: boolean; countIn: boolean }[], t0: number, subdiv: number): Click[] {
  return beats.flatMap((b) => {
    const step = 60000 / b.bpm / subdiv;
    return Array.from({ length: subdiv }, (_, k) => ({
      time: t0 + (b.time + k * step) / 1000,
      accent: k === 0 && b.downbeat,
      countIn: b.countIn,
      sub: k > 0,
    }));
  });
}

/**
 * Guide strokes for every expected note (ms from `t0` seconds): accents louder, grace notes just
 * before the main stroke from the other hand, buzz strokes as quick soft bounces.
 */
export function guideStrokes(notes: ExpectedNote[], t0: number): Click[] {
  const hasAccents = notes.some((n) => n.accent);
  const out: Click[] = [];
  const stroke = (time: number, level: number, pan: number): Click => ({ time, accent: false, countIn: false, stroke: { level, pan } });
  for (const n of notes) {
    const t = t0 + n.time / 1000;
    const pan = n.hand === 'R' ? 0.5 : -0.5;
    const graces = n.grace === 'flam' ? [0.03] : n.grace === 'drag' ? [0.05, 0.025] : [];
    for (const g of graces) out.push(stroke(t - g, 0.2, -pan));
    out.push(stroke(t, hasAccents ? (n.accent ? 1 : 0.4) : 0.7, pan));
    if (n.buzz) for (let d = 0.03; d < (n.durMs / 1000) * 0.85; d += 0.03) out.push(stroke(t + d, 0.2, pan));
  }
  return out;
}
