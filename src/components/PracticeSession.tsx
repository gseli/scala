import { useEffect, useMemo, useRef, useState } from 'react';
import { contextToPerfOffset, resumeAudio } from '../audio/clock';
import { ClickScheduler, beatClicks, guideStrokes, type Click } from '../audio/scheduler';
import { perPatternNote, scoreSession, suggestions, type Hit, type Rating, type Score } from '../engine/scoring';
import { buildTimeline, totalBars, type ExpectedNote, type SessionPlan, type Timeline } from '../engine/timeline';
import { blockStarts, figureName, type Block } from '../exercises/rhythmChange';
import { inputHub, useInputState, type RawHit } from '../midi/inputHub';
import { playOnDevice } from '../midi/midiOut';
import { FOOT_NOTES, padName } from '../midi/padMap';
import { Staff } from '../notation/Staff';
import { patternBars, type Hand, type Pattern } from '../rudiments/types';
import { bestFor, saveSession, useProgress, type SessionRecord } from '../store/progress';
import { settingsStore, useSettings } from '../store/settings';
import { BeatCounter } from './BeatCounter';
import { OffsetMeter } from './OffsetMeter';
import { ScoreStats } from './ScoreStats';

interface Props {
  exerciseId: string;
  exerciseName: string;
  pattern: Pattern;
  defaultBpm: number;
  /** Rhythm-change blocks, to announce the next figure. */
  blocks?: Block[];
}

/** `listening`: the app plays the exercise by itself, nothing is judged. `replaying`: plays back your last take. */
type Phase = 'idle' | 'running' | 'listening' | 'replaying' | 'done';

/** Everything you played in a session, for playback. */
interface Take {
  tl: Timeline;
  /** `t`: ms from the session start, latency-corrected so it lines up with the click. */
  hits: { t: number; note: number; velocity: number; hand?: Hand }[];
  /** ms from the session start where the take ends (earlier if you stopped). */
  end: number;
  subdiv: number;
}

interface Run {
  tl: Timeline;
  expected: ExpectedNote[];
  perfStart: number;
  hits: Hit[];
  take: Take['hits'];
  sources: Set<RawHit['source']>;
  latency: number;
  twoPads: boolean;
  accentRatio: number;
  listen: boolean;
  stop: () => void;
}

interface Live {
  score: Score | null;
  recent: { offset: number; rating: Rating }[];
}

const BAR_OPTIONS = [4, 8, 16, 32, 64];
const CLICK_OPTIONS = [
  { n: 1, name: 'Negras' },
  { n: 2, name: 'Corcheas' },
  { n: 3, name: 'Tresillos' },
  { n: 4, name: 'Semicorcheas' },
];

export function PracticeSession({ exerciseId, exerciseName, pattern, defaultBpm, blocks }: Props) {
  const settings = useSettings();
  const input = useInputState();
  const { sessions } = useProgress();
  const best = bestFor(sessions, exerciseId);

  const [bpm, setBpm] = useState(settings.lastBpm[exerciseId] ?? defaultBpm);
  const [progressive, setProgressive] = useState(false);
  const [bars, setBars] = useState(blocks ? 0 : 8);
  const [target, setTarget] = useState(bpm + 20);
  const [step, setStep] = useState(5);
  const [every, setEvery] = useState(4);
  const [twoPads, setTwoPads] = useState(false);
  const [countInBars, setCountInBars] = useState(pattern.beatsPerBar >= 4 ? 1 : 2);
  const [subdiv, setSubdiv] = useState(1);

  const [phase, setPhase] = useState<Phase>('idle');
  const [live, setLive] = useState<Live | null>(null);
  const [highlight, setHighlight] = useState<number>();
  /** Index into the timeline beats of the click currently sounding, -1 before the first. */
  const [beatIdx, setBeatIdx] = useState(-1);
  const [result, setResult] = useState<{ score: Score; record: SessionRecord | null; bpm: number; take: Take } | null>(null);
  /** Timeline of whatever is playing (practice, listen or replay). */
  const [activeTl, setActiveTl] = useState<Timeline | null>(null);
  const run = useRef<Run | null>(null);
  const stopReplay = useRef<(() => void) | null>(null);
  const [comparing, setComparing] = useState(false);
  const scheduler = useRef(new ClickScheduler());

  const pBars = patternBars(pattern);
  const plan: SessionPlan = {
    pattern,
    bars: blocks ? Math.max(pBars, bars || pBars) : bars,
    tempo: { bpm, progressive: progressive ? { target: Math.max(target, bpm), step, everyBars: every } : undefined },
    countInBeats: countInBars * pattern.beatsPerBar,
  };
  const plannedBars = totalBars(plan);
  const padsReady = settings.rightNotes.length > 0 && settings.leftNotes.length > 0;

  useEffect(
    () => () => {
      run.current?.stop();
      stopReplay.current?.();
    },
    [],
  );
  useEffect(() => {
    setPhase('idle');
    setResult(null);
    setLive(null);
  }, [pattern]);

  /** `listen`: play the rhythm by itself (two passes of short patterns) without judging. */
  async function start(listen = false) {
    stopReplay.current?.();
    run.current?.stop();
    const ctx = await resumeAudio();
    const s = settingsStore.get();
    settingsStore.set({ lastBpm: { ...s.lastBpm, [exerciseId]: bpm } });
    scheduler.current.setVolume(s.clickVolume);
    scheduler.current.setGuideVolume(s.guideVolume);

    const tl = buildTimeline(listen ? { ...plan, bars: pBars >= 4 ? pBars : pBars * 2, tempo: { bpm } } : plan);
    const t0 = ctx.currentTime + 0.4;
    const perfStart = t0 * 1000 + contextToPerfOffset(ctx);
    const clicks = beatClicks(tl.beats, t0, subdiv);
    if (listen || s.guide) clicks.push(...guideStrokes(tl.notes, t0));
    scheduler.current.start(clicks.sort((a, b) => a.time - b.time));

    const r: Run = {
      tl,
      expected: tl.notes.map((n) => ({ ...n, time: n.time + perfStart })),
      perfStart,
      hits: [],
      take: [],
      sources: new Set(),
      latency: s.latencyMs,
      twoPads: twoPads && padsReady,
      accentRatio: s.accentRatio,
      listen,
      stop: () => {},
    };

    const unsub = listen ? () => {} : inputHub.onHit((h) => {
      let hand = h.hand;
      if (h.source === 'midi' && r.twoPads) hand = s.rightNotes.includes(h.note) ? 'R' : s.leftNotes.includes(h.note) ? 'L' : undefined;
      // The take keeps every pad (feet too); scoring only the ones that belong to the exercise.
      r.take.push({ t: h.time - r.latency - perfStart, note: h.note, velocity: h.velocity, hand });
      if (h.source === 'midi' && (r.twoPads ? !hand : FOOT_NOTES.has(h.note))) return;
      r.sources.add(h.source);
      r.hits.push({ time: h.time - r.latency, velocity: h.velocity, hand });
    });

    const unfollow = follow(tl, perfStart);

    const interval = window.setInterval(() => {
      const now = performance.now();
      const score = listen ? null : scoreSession(r.expected, r.hits, { accentRatio: r.accentRatio, checkSticking: r.twoPads, judgeUntil: now - r.latency });
      const recent = (score?.results ?? [])
        .filter((x) => x.offset !== undefined)
        .slice(-14)
        .map((x) => ({ offset: x.offset!, rating: x.rating }));
      setLive({ score, recent });
      if (now - perfStart > r.tl.endTime + 800) finish(false);
    }, 100);

    r.stop = () => {
      unsub();
      unfollow();
      window.clearInterval(interval);
      scheduler.current.stop();
    };
    run.current = r;
    setActiveTl(tl);
    setResult(null);
    setLive(null);
    setBeatIdx(-1);
    setPhase(listen ? 'listening' : 'running');
  }

  function finish(early: boolean) {
    const r = run.current;
    if (!r) return;
    r.stop();
    run.current = null;
    setHighlight(undefined);
    if (r.listen) {
      setLive(null);
      setPhase('idle');
      return;
    }
    const take: Take = {
      tl: r.tl,
      hits: r.take.filter((h) => h.t >= -100),
      end: early ? Math.min(r.tl.endTime, performance.now() - r.perfStart) : r.tl.endTime,
      subdiv,
    };
    const until = performance.now() - r.latency;
    const notes = early ? r.expected.filter((n) => n.time <= until) : r.expected;
    const score = scoreSession(notes, r.hits, { accentRatio: r.accentRatio, checkSticking: r.twoPads, judgeUntil: early ? until : undefined });
    const judged = score.results.map((x) => x.note);
    const bpmEnd = judged.length ? judged[judged.length - 1].bpm : bpm;
    let record: SessionRecord | null = null;
    if (score.results.length >= 8 && r.hits.length > 0) {
      record = saveSession({
        exerciseId,
        exerciseName,
        bpmStart: bpm,
        bpmEnd,
        bars: judged.length ? judged[judged.length - 1].bar + 1 : 0,
        accuracy: score.accuracy,
        meanOffset: score.meanOffset,
        stdDev: score.stdDev,
        accentPct: score.accentPct,
        stickingPct: score.stickingPct,
        gracePct: score.gracePct,
        misses: score.counts.miss,
        extras: score.extras.length,
        twoPads: r.twoPads,
        source: r.sources.size > 1 ? 'mixto' : r.sources.has('teclado') ? 'teclado' : 'midi',
      });
    }
    setResult({ score, record, bpm: bpmEnd, take });
    setPhase('done');
  }

  /** Highlights the current note and beat while something plays. Returns a stop function. */
  function follow(tl: Timeline, perfStart: number) {
    let raf = 0;
    const frame = () => {
      const now = performance.now() - perfStart;
      let i = tl.notes.findIndex((n) => n.time > now);
      if (i === -1) i = tl.notes.length;
      setHighlight(i > 0 && now < tl.endTime ? tl.notes[i - 1].patternIndex : undefined);
      let b = tl.beats.findIndex((x) => x.time > now);
      if (b === -1) b = tl.beats.length;
      setBeatIdx(b - 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  /**
   * Plays back your last take with the click. `compare` adds the correct rhythm, so you hear the
   * difference: with the computer's sound yours is on the right and the reference on the left.
   */
  async function replay(compare: boolean) {
    if (!result) return;
    stopReplay.current?.();
    const { tl, hits, end, subdiv: takeSubdiv } = result.take;
    const ctx = await resumeAudio();
    const s = settingsStore.get();
    scheduler.current.setVolume(s.clickVolume);
    scheduler.current.setGuideVolume(s.guideVolume);
    const t0 = ctx.currentTime + 0.4;
    const perfStart = t0 * 1000 + contextToPerfOffset(ctx);
    const device = s.replayVia === 'midi' ? inputHub.output() : null;

    const clicks: Click[] = beatClicks(tl.beats.filter((b) => b.time <= end), t0, takeSubdiv);
    if (compare) {
      const reference = guideStrokes(tl.notes.filter((n) => n.time <= end), t0);
      clicks.push(...reference.map((c) => ({ ...c, stroke: { level: c.stroke!.level * 0.6, pan: device ? c.stroke!.pan : -0.8 } })));
    }
    let stopDevice = () => {};
    if (device) {
      stopDevice = playOnDevice(device, hits.map((h) => ({ time: perfStart + h.t, note: h.note < 0 ? 38 : h.note, velocity: h.velocity })));
    } else {
      for (const h of hits) {
        const pan = compare ? 0.8 : h.hand === 'R' ? 0.5 : h.hand === 'L' ? -0.5 : 0;
        clicks.push({ time: t0 + h.t / 1000, accent: false, countIn: false, stroke: { level: 0.25 + (0.75 * h.velocity) / 127, pan } });
      }
    }
    scheduler.current.start(clicks.sort((a, b) => a.time - b.time));

    const unfollow = follow(tl, perfStart);
    const timer = window.setInterval(() => {
      if (performance.now() - perfStart > end + 800) stopReplay.current?.();
    }, 100);
    stopReplay.current = () => {
      stopReplay.current = null;
      stopDevice();
      unfollow();
      window.clearInterval(timer);
      scheduler.current.stop();
      setHighlight(undefined);
      setPhase('done');
    };
    setActiveTl(tl);
    setBeatIdx(-1);
    setComparing(compare);
    setPhase('replaying');
  }

  // Space bar starts / stops.
  const toggle = useRef<() => void>(() => {});
  toggle.current = () =>
    phase === 'replaying' ? stopReplay.current?.() : phase === 'running' || phase === 'listening' ? finish(true) : void start();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== 'Space' || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
      e.preventDefault();
      toggle.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const quality = useMemo(() => (result ? perPatternNote(result.score.results) : undefined), [result]);
  const playing = phase === 'running' || phase === 'listening' || phase === 'replaying';
  const curBeat = playing && beatIdx >= 0 ? activeTl?.beats[beatIdx] : undefined;
  const blockInfo = blocks && curBeat && curBeat.bar >= 0 ? currentBlock(blocks, curBeat.bar) : null;

  return (
    <div className="practice">
      <Staff pattern={pattern} highlight={highlight} quality={phase === 'done' ? quality : undefined} />

      {!playing && (
        <div className="panel controls">
          <label className="field bpm">
            <span>Tempo</span>
            <div className="bpm-row">
              <button onClick={() => setBpm((b) => Math.max(30, b - 5))}>−5</button>
              <input type="number" min={30} max={260} value={bpm} onChange={(e) => setBpm(clampBpm(+e.target.value))} />
              <button onClick={() => setBpm((b) => Math.min(260, b + 5))}>+5</button>
              <span className="muted">BPM</span>
            </div>
            <input type="range" min={30} max={260} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
          </label>

          <div className="field">
            <span>Modo</span>
            <div className="seg">
              <button className={!progressive ? 'on' : ''} onClick={() => setProgressive(false)}>Fijo</button>
              <button className={progressive ? 'on' : ''} onClick={() => setProgressive(true)}>Progresivo</button>
            </div>
          </div>

          {!progressive && !blocks && (
            <label className="field">
              <span>Duración</span>
              <select value={bars} onChange={(e) => setBars(+e.target.value)}>
                {BAR_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b} compases</option>
                ))}
              </select>
            </label>
          )}
          {!progressive && blocks && (
            <label className="field">
              <span>Repeticiones</span>
              <select value={Math.max(1, Math.round((bars || pBars) / pBars))} onChange={(e) => setBars(+e.target.value * pBars)}>
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>{n}×</option>
                ))}
              </select>
            </label>
          )}
          {progressive && (
            <>
              <label className="field">
                <span>Hasta</span>
                <input type="number" min={bpm} max={260} value={target} onChange={(e) => setTarget(clampBpm(+e.target.value))} />
              </label>
              <label className="field">
                <span>Subir</span>
                <select value={step} onChange={(e) => setStep(+e.target.value)}>
                  {[2, 4, 5, 10].map((n) => (
                    <option key={n} value={n}>+{n} BPM</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cada</span>
                <select value={every} onChange={(e) => setEvery(+e.target.value)}>
                  {[1, 2, 4, 8].map((n) => (
                    <option key={n} value={n}>{n} compás{n > 1 ? 'es' : ''}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="field">
            <span>Click</span>
            <select value={subdiv} onChange={(e) => setSubdiv(+e.target.value)}>
              {CLICK_OPTIONS.map((o) => (
                <option key={o.n} value={o.n}>{o.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Conteo</span>
            <select value={countInBars} onChange={(e) => setCountInBars(+e.target.value)}>
              {[1, 2].map((n) => (
                <option key={n} value={n}>{n} compás{n > 1 ? 'es' : ''}</option>
              ))}
            </select>
          </label>

          <label className={`field check ${padsReady ? '' : 'disabled'}`} title={padsReady ? '' : 'Asigna los pads en Configuración'}>
            <input type="checkbox" checked={twoPads && padsReady} disabled={!padsReady} onChange={(e) => setTwoPads(e.target.checked)} />
            <span>
              Dos pads (sticking)
              <small className="muted">
                {padsReady
                  ? `R: ${settings.rightNotes.map(padName).join(', ')} · L: ${settings.leftNotes.map(padName).join(', ')}`
                  : 'Configura los pads primero'}
              </small>
            </span>
          </label>

          <label className="field check">
            <input type="checkbox" checked={settings.guide} onChange={(e) => settingsStore.set({ guide: e.target.checked })} />
            <span>
              Guía sonora
              <small className="muted">Suena cada nota mientras practicas</small>
            </span>
          </label>

          <div className="start-row">
            <button className="primary big" onClick={() => void start()}>
              ▶ Comenzar <small>(espacio)</small>
            </button>
            <button className="big" onClick={() => void start(true)} title="La app toca el ritmo para que escuches cómo suena">
              🔊 Escuchar
            </button>
            <span className="muted">
              {plannedBars} compases
              {best && ` · Récord: ${best.masteredBpm ? `${best.masteredBpm} BPM dominado` : `${Math.round(best.bestAccuracy)}% máx.`}`}
            </span>
          </div>
        </div>
      )}

      {playing && (
        <div className="panel live">
          <div className="live-head">
            <BeatCounter beatsPerBar={pattern.beatsPerBar} beat={curBeat ? curBeat.beatInBar : null} countIn={!curBeat || curBeat.countIn} />
            {!curBeat || curBeat.countIn ? (
              <div className="live-info">
                <span className="countin-label">Conteo… empieza en el próximo 1</span>
              </div>
            ) : (
              <div className="live-info">
                <span className="live-bpm">{curBeat.bpm} BPM</span>
                <span className="muted">
                  Compás {curBeat.bar + 1} / {activeTl?.bars ?? plannedBars}
                </span>
                {blockInfo && (
                  <span className="block-info">
                    {figureName(blockInfo.current)}
                    {blockInfo.next && blockInfo.barsLeft <= 2 && (
                      <strong className="next">
                        {' '}→ {figureName(blockInfo.next)} en {blockInfo.barsLeft}
                      </strong>
                    )}
                  </span>
                )}
              </div>
            )}
            <button className="danger" onClick={() => (phase === 'replaying' ? stopReplay.current?.() : finish(true))}>■ Detener</button>
          </div>
          {phase === 'replaying' ? (
            <p className="listening">
              {comparing ? '⇆ Comparando tu toma con el ritmo correcto.' : '🔁 Reproduciendo tu toma con el click.'}
            </p>
          ) : phase === 'listening' ? (
            <p className="listening">
              🔊 Escuchando cómo suena el ritmo (no se evalúa). Acentos más fuertes; la mano derecha suena a la derecha y la izquierda a
              la izquierda.
            </p>
          ) : (
            <>
              <OffsetMeter recent={live?.recent ?? []} />
              {live?.score && <ScoreStats score={live.score} />}
            </>
          )}
        </div>
      )}

      {(phase === 'done' || phase === 'replaying') && result && (
        <div className="panel summary">
          <h3>Resultado</h3>
          {result.score.results.length === 0 ? (
            <p className="muted">No se registraron notas. ¿Está conectada la batería? Revisa Configuración, o usa las teclas F / J.</p>
          ) : (
            <>
              <ScoreStats score={result.score} />
              <ul className="tips">
                {suggestions(result.score, result.bpm).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <div className="replay-row">
                <button className="primary" disabled={!result.take.hits.length} onClick={() => void replay(false)}>
                  ▶ Escuchar mi toma
                </button>
                <button disabled={!result.take.hits.length} onClick={() => void replay(true)}>
                  ⇆ Comparar con el ritmo correcto
                </button>
                {input.output && (
                  <select value={settings.replayVia} onChange={(e) => settingsStore.set({ replayVia: e.target.value as 'midi' | 'pc' })}>
                    <option value="midi">Sonido: batería ({input.output})</option>
                    <option value="pc">Sonido: computadora</option>
                  </select>
                )}
                <small className="muted">
                  {input.output && settings.replayVia === 'midi'
                    ? 'Tu toma suena en la batería con sus propios sonidos; al comparar, el ritmo correcto suena en la computadora.'
                    : 'Al comparar, tu toma suena a la derecha y el ritmo correcto a la izquierda.'}
                </small>
              </div>
              <p className="muted legend">
                La partitura muestra en <span className="r-perfect">verde</span> / <span className="r-ok">amarillo</span> /{' '}
                <span className="r-miss">rojo</span> qué notas del patrón te salieron mejor y peor.
                {!result.record && ' (Sesión muy corta: no se guardó en el historial.)'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const clampBpm = (n: number) => Math.max(30, Math.min(260, Math.round(n) || 30));

function currentBlock(blocks: Block[], bar: number) {
  const starts = blockStarts(blocks);
  const seqBars = starts[starts.length - 1] + blocks[blocks.length - 1].bars;
  const b = bar % seqBars;
  let i = starts.length - 1;
  while (starts[i] > b) i--;
  const nextStart = i + 1 < starts.length ? starts[i + 1] : seqBars;
  return { current: blocks[i].figure, next: blocks[(i + 1) % blocks.length].figure, barsLeft: nextStart - b };
}
