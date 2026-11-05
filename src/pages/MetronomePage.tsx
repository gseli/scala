import { useEffect, useRef, useState } from 'react';
import { contextToPerfOffset, resumeAudio } from '../audio/clock';
import { ClickScheduler } from '../audio/scheduler';
import { BeatCounter } from '../components/BeatCounter';
import { settingsStore, useSettings } from '../store/settings';

const SUBDIVS = [
  { n: 1, name: 'Negras' },
  { n: 2, name: 'Corcheas' },
  { n: 3, name: 'Tresillos' },
  { n: 4, name: 'Semicorcheas' },
  { n: 6, name: 'Sextillos' },
];

const clamp = (n: number) => Math.max(30, Math.min(260, Math.round(n) || 30));
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function MetronomePage() {
  const settings = useSettings();
  const [bpm, setBpm] = useState(settings.lastBpm.metronomo ?? 80);
  const [beats, setBeats] = useState(4);
  const [subdiv, setSubdiv] = useState(1);
  const [accentOne, setAccentOne] = useState(true);
  const [running, setRunning] = useState(false);
  /** Beats elapsed since start, -1 before the first click. */
  const [beat, setBeat] = useState(-1);
  const scheduler = useRef(new ClickScheduler());
  const timing = useRef<{ perfStart: number; beatMs: number } | null>(null);
  const taps = useRef<number[]>([]);

  async function start() {
    const ctx = await resumeAudio();
    scheduler.current.setVolume(settingsStore.get().clickVolume);
    settingsStore.set({ lastBpm: { ...settingsStore.get().lastBpm, metronomo: bpm } });
    const t0 = ctx.currentTime + 0.1;
    const beatS = 60 / bpm;
    scheduler.current.stream((i) => {
      const b = Math.floor(i / subdiv);
      const k = i % subdiv;
      return { time: t0 + (b + k / subdiv) * beatS, accent: accentOne && k === 0 && b % beats === 0, countIn: false, sub: k > 0 };
    });
    timing.current = { perfStart: t0 * 1000 + contextToPerfOffset(ctx), beatMs: beatS * 1000 };
    setBeat(-1);
    setRunning(true);
  }

  function stop() {
    scheduler.current.stop();
    timing.current = null;
    setRunning(false);
    setBeat(-1);
  }

  // Apply changes immediately while playing.
  useEffect(() => {
    if (running) void start();
  }, [bpm, beats, subdiv, accentOne]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const frame = () => {
      const t = timing.current;
      if (t) setBeat(Math.floor((performance.now() - t.perfStart) / t.beatMs));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => () => scheduler.current.stop(), []);

  function tap() {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now].slice(-6);
    const ts = taps.current;
    if (ts.length >= 3) setBpm(clamp((60000 * (ts.length - 1)) / (ts[ts.length - 1] - ts[0])));
  }

  const toggle = useRef<() => void>(() => {});
  toggle.current = () => (running ? stop() : void start());
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle.current();
      } else if (e.key.toLowerCase() === 't') tapRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inBar = beat >= 0 ? beat % beats : null;
  const bar = beat >= 0 ? Math.floor(beat / beats) + 1 : 0;
  const elapsed = beat >= 0 && timing.current ? performance.now() - timing.current.perfStart : 0;

  return (
    <div>
      <div className="page-head">
        <h2>Metrónomo</h2>
      </div>

      <div className="panel metronome">
        <div className="metro-display">
          <BeatCounter beatsPerBar={beats} beat={inBar} />
          <div className="metro-meta">
            <span className="live-bpm">{bpm} BPM</span>
            <span className="muted">
              Compás {bar} · {mmss(elapsed)}
            </span>
          </div>
        </div>

        <div className="controls">
          <label className="field bpm">
            <span>Tempo</span>
            <div className="bpm-row">
              <button onClick={() => setBpm((b) => clamp(b - 1))}>−1</button>
              <button onClick={() => setBpm((b) => clamp(b - 5))}>−5</button>
              <input type="number" min={30} max={260} value={bpm} onChange={(e) => setBpm(clamp(+e.target.value))} />
              <button onClick={() => setBpm((b) => clamp(b + 5))}>+5</button>
              <button onClick={() => setBpm((b) => clamp(b + 1))}>+1</button>
            </div>
            <input type="range" min={30} max={260} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
          </label>

          <label className="field">
            <span>Compás</span>
            <select value={beats} onChange={(e) => setBeats(+e.target.value)}>
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n}/4</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Subdivisión</span>
            <select value={subdiv} onChange={(e) => setSubdiv(+e.target.value)}>
              {SUBDIVS.map((s) => (
                <option key={s.n} value={s.n}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="field check">
            <input type="checkbox" checked={accentOne} onChange={(e) => setAccentOne(e.target.checked)} />
            <span>Acentuar el 1</span>
          </label>

          <label className="field">
            <span>Volumen</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.clickVolume}
              onChange={(e) => {
                settingsStore.set({ clickVolume: +e.target.value });
                scheduler.current.setVolume(+e.target.value);
              }}
            />
          </label>

          <div className="start-row">
            {running ? (
              <button className="danger big" onClick={stop}>■ Detener <small>(espacio)</small></button>
            ) : (
              <button className="primary big" onClick={() => void start()}>▶ Iniciar <small>(espacio)</small></button>
            )}
            <button className="big" onClick={tap}>Tap <small>(T)</small></button>
          </div>
        </div>
      </div>
    </div>
  );
}
