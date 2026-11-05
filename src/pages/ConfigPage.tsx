import { useEffect, useRef, useState } from 'react';
import { contextToPerfOffset, resumeAudio } from '../audio/clock';
import { ClickScheduler } from '../audio/scheduler';
import { inputHub, useInputState, type RawHit } from '../midi/inputHub';
import { FOOT_NOTES, padName } from '../midi/padMap';
import type { Hand } from '../rudiments/types';
import { settingsStore, useSettings } from '../store/settings';

export function ConfigPage() {
  const settings = useSettings();
  const input = useInputState();
  const [hits, setHits] = useState<RawHit[]>([]);
  const [learning, setLearning] = useState<Hand | null>(null);
  const learningRef = useRef(learning);
  learningRef.current = learning;

  useEffect(
    () =>
      inputHub.onHit((h) => {
        setHits((hs) => [h, ...hs].slice(0, 10));
        const hand = learningRef.current;
        if (hand && h.source === 'midi') {
          const s = settingsStore.get();
          const mine = hand === 'R' ? s.rightNotes : s.leftNotes;
          const other = hand === 'R' ? s.leftNotes : s.rightNotes;
          const nextMine = mine.includes(h.note) ? mine : [...mine, h.note];
          const nextOther = other.filter((n) => n !== h.note);
          settingsStore.set(hand === 'R' ? { rightNotes: nextMine, leftNotes: nextOther } : { leftNotes: nextMine, rightNotes: nextOther });
          setLearning(null);
        }
      }),
    [],
  );

  return (
    <div className="config">
      <h2>Configuración</h2>

      <section className="panel">
        <h3>Batería (MIDI)</h3>
        {input.status === 'unsupported' && <p className="error">Este navegador no soporta Web MIDI. Usa Google Chrome o Chromium.</p>}
        {input.status === 'denied' && (
          <p className="error">
            Permiso de MIDI denegado. Habilítalo en la configuración del sitio de Chrome (icono a la izquierda de la URL) y{' '}
            <button onClick={() => void inputHub.init()}>Reintentar</button>
          </p>
        )}
        {input.status === 'pending' && <p className="muted">Pidiendo acceso MIDI…</p>}
        {input.status === 'ready' && (
          <>
            <label className="field">
              <span>Entrada</span>
              <select value={settings.midiInput} onChange={(e) => settingsStore.set({ midiInput: e.target.value })}>
                <option value="all">Todas las entradas ({input.devices.length})</option>
                {input.devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            {input.devices.length === 0 && (
              <p className="warn">No se detecta ningún dispositivo MIDI. Revisa la guía de conexión más abajo.</p>
            )}
          </>
        )}
        <label className="field check">
          <input type="checkbox" checked={settings.keyboardInput} onChange={(e) => settingsStore.set({ keyboardInput: e.target.checked })} />
          <span>Teclado como batería: <kbd>F</kbd> = R, <kbd>J</kbd> = L, <kbd>Shift</kbd> = acento</span>
        </label>

        <h4>Monitor de golpes</h4>
        <p className="muted small">Golpea un pad: deberías verlo aquí con su velocidad.</p>
        <ul className="monitor">
          {hits.length === 0 && <li className="muted">Sin golpes todavía.</li>}
          {hits.map((h, i) => (
            <li key={`${h.time}-${i}`}>
              <span className="pad">{h.source === 'teclado' ? `Teclado (${h.hand})` : padName(h.note)}</span>
              <span className="muted">{h.source === 'midi' ? `nota ${h.note}` : ''}</span>
              <span className="vel">
                <span style={{ width: `${(h.velocity / 127) * 100}%` }} />
              </span>
              <span className="muted">{h.velocity}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Modo dos pads (verificar sticking)</h3>
        <p className="muted small">
          Asigna un pad a cada mano, por ejemplo caja = derecha y tom 1 = izquierda. Puedes asignar varios pads por mano (p. ej. parche y aro).
        </p>
        {(['R', 'L'] as Hand[]).map((hand) => {
          const notes = hand === 'R' ? settings.rightNotes : settings.leftNotes;
          return (
            <div key={hand} className="pad-assign">
              <strong>{hand === 'R' ? 'Mano derecha (R)' : 'Mano izquierda (L)'}</strong>
              <span className="chips">
                {notes.length ? notes.map((n) => <span key={n} className="chip">{padName(n)}</span>) : <span className="muted">sin asignar</span>}
              </span>
              <button className={learning === hand ? 'primary' : ''} onClick={() => setLearning(learning === hand ? null : hand)}>
                {learning === hand ? 'Golpea el pad…' : '+ Asignar pad'}
              </button>
              <button onClick={() => settingsStore.set(hand === 'R' ? { rightNotes: [] } : { leftNotes: [] })}>Limpiar</button>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h3>Latencia</h3>
        <p className="muted small">
          Bluetooth y la salida de audio agregan un retraso. Tocas 16 golpes junto al click y la app mide cuánto llega tarde tu golpe en
          promedio, para descontarlo al evaluar.
        </p>
        <Calibration />
      </section>

      <section className="panel">
        <h3>Ajustes</h3>
        <label className="field">
          <span>Volumen del click</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.clickVolume} onChange={(e) => settingsStore.set({ clickVolume: +e.target.value })} />
        </label>
        <label className="field">
          <span>Volumen de la guía (notas del ritmo)</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.guideVolume} onChange={(e) => settingsStore.set({ guideVolume: +e.target.value })} />
        </label>
        <label className="field">
          <span>Sensibilidad de acentos</span>
          <input type="range" min={1.1} max={2} step={0.05} value={settings.accentRatio} onChange={(e) => settingsStore.set({ accentRatio: +e.target.value })} />
          <small className="muted">
            Un golpe cuenta como acento si es {Math.round((settings.accentRatio - 1) * 100)}% más fuerte que tus notas suaves.
          </small>
        </label>
      </section>

      <section className="panel help">
        <h3>Cómo conectar la Roland TD-07 en Linux</h3>
        <h4>Opción A: Bluetooth MIDI</h4>
        <ol>
          <li>En el módulo TD-07, activa el emparejamiento Bluetooth (consulta la sección “Bluetooth” del manual).</li>
          <li>
            En una terminal: <code>bluetoothctl</code>, luego <code>scan on</code>, espera a ver la TD-07 y ejecuta{' '}
            <code>pair XX:XX:…</code>, <code>trust XX:XX:…</code> y <code>connect XX:XX:…</code>.
          </li>
          <li>
            Comprueba que apareció como puerto MIDI con <code>aconnect -l</code>. Si no aparece, tu BlueZ puede no tener soporte MIDI
            activado; usa la opción B.
          </li>
          <li>Recarga esta página: la TD-07 debería aparecer en “Entrada”.</li>
        </ol>
        <h4>Opción B: cable USB (recomendada para menor latencia)</h4>
        <ol>
          <li>Conecta el puerto USB COMPUTER de la TD-07 a la laptop.</li>
          <li>Recarga la página y elige la TD-07 en “Entrada”.</li>
        </ol>
        <p className="muted small">
          Consejo: escucha el click por los parlantes o auriculares con cable de la laptop. Si el audio va por Bluetooth el retraso es
          grande (150–250 ms); la calibración lo compensa, pero se siente menos natural.
        </p>
      </section>
    </div>
  );
}

const CAL_BPM = 80;
const CAL_COUNT_IN = 4;
const CAL_BEATS = 16;

function Calibration() {
  const { latencyMs } = useSettings();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [beat, setBeat] = useState(0);
  const [res, setRes] = useState<{ median: number; std: number; n: number } | null>(null);
  const scheduler = useRef(new ClickScheduler());
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  async function run() {
    const ctx = await resumeAudio();
    scheduler.current.setVolume(settingsStore.get().clickVolume);
    const beatS = 60 / CAL_BPM;
    const t0 = ctx.currentTime + 0.4;
    const total = CAL_COUNT_IN + CAL_BEATS;
    const clicks = Array.from({ length: total }, (_, i) => ({ time: t0 + i * beatS, accent: i % 4 === 0, countIn: i < CAL_COUNT_IN }));
    const offset = contextToPerfOffset(ctx);
    const beatPerf = clicks.map((c) => c.time * 1000 + offset);
    const hits: number[] = [];
    const unsub = inputHub.onHit((h) => {
      if (h.source === 'midi' && FOOT_NOTES.has(h.note)) return;
      hits.push(h.time);
    });
    scheduler.current.start(clicks);
    setPhase('running');
    setRes(null);

    const timer = window.setInterval(() => {
      const now = performance.now();
      setBeat(beatPerf.filter((t) => t <= now).length);
      if (now < beatPerf[total - 1] + 600) return;
      cleanup.current();
      const offsets: number[] = [];
      for (const t of beatPerf.slice(CAL_COUNT_IN)) {
        const near = hits.filter((h) => Math.abs(h - t) < (beatS * 1000) / 2);
        if (near.length) offsets.push(near.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a)) - t);
      }
      offsets.sort((a, b) => a - b);
      const median = offsets.length ? offsets[offsets.length >> 1] : 0;
      const mean = offsets.reduce((a, b) => a + b, 0) / (offsets.length || 1);
      const std = Math.sqrt(offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / (offsets.length || 1));
      setRes({ median, std, n: offsets.length });
      setPhase('done');
    }, 50);

    cleanup.current = () => {
      unsub();
      window.clearInterval(timer);
      scheduler.current.stop();
    };
  }

  return (
    <div className="calibration">
      <p>
        Latencia actual: <strong>{latencyMs.toFixed(0)} ms</strong>
      </p>
      {phase === 'running' ? (
        <p className="countin small-countin">
          {beat <= CAL_COUNT_IN ? `Escucha… ${beat}` : `Toca con el click: ${beat - CAL_COUNT_IN} / ${CAL_BEATS}`}
        </p>
      ) : (
        <div className="row">
          <button className="primary" onClick={() => void run()}>Calibrar</button>
          <button onClick={() => settingsStore.set({ latencyMs: 0 })}>Poner en 0</button>
        </div>
      )}
      {phase === 'done' && res && (
        <div className="cal-result">
          {res.n < 8 ? (
            <p className="warn">Solo se detectaron {res.n} golpes. Vuelve a intentarlo tocando en cada click.</p>
          ) : (
            <>
              <p>
                Medido: <strong>{res.median.toFixed(0)} ms</strong> (variación ±{res.std.toFixed(0)} ms con {res.n} golpes).
                {res.std > 25 && ' La variación es alta: repite la calibración tocando lo más parejo posible.'}
              </p>
              <button className="primary" onClick={() => settingsStore.set({ latencyMs: Math.round(res.median) })}>
                Usar {res.median.toFixed(0)} ms
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
