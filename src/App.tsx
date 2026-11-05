import { useEffect, useState } from 'react';
import { useInputState } from './midi/inputHub';
import { ConfigPage } from './pages/ConfigPage';
import { HistoryPage } from './pages/HistoryPage';
import { MetronomePage } from './pages/MetronomePage';
import { RhythmChangePage } from './pages/RhythmChangePage';
import { RudimentPage } from './pages/RudimentPage';
import { RudimentsPage } from './pages/RudimentsPage';
import { useSettings } from './store/settings';

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.replace(/^#\/?/, '');
}

const NAV = [
  { path: '', label: 'Rudimentos' },
  { path: 'cambios', label: 'Cambios de figura' },
  { path: 'metronomo', label: 'Metrónomo' },
  { path: 'historial', label: 'Historial' },
  { path: 'config', label: 'Configuración' },
];

export function App() {
  const route = useHash();
  const [section, arg] = route.split('/');
  const input = useInputState();
  const settings = useSettings();
  const device = input.devices.find((d) => d.id === settings.midiInput)?.name ?? input.devices[0]?.name;

  let page;
  if (section === 'rudimento' && arg) page = <RudimentPage id={arg} />;
  else if (section === 'cambios') page = <RhythmChangePage />;
  else if (section === 'metronomo') page = <MetronomePage />;
  else if (section === 'historial') page = <HistoryPage />;
  else if (section === 'config') page = <ConfigPage />;
  else page = <RudimentsPage />;

  const active = section === 'rudimento' ? '' : section;
  return (
    <>
      <header className="top">
        <a href="#/" className="logo">
          <span className="logo-mark">◉</span> Rudimentos
        </a>
        <nav>
          {NAV.map((n) => (
            <a key={n.path} href={`#/${n.path}`} className={active === n.path ? 'on' : ''}>{n.label}</a>
          ))}
        </nav>
        <a href="#/config" className={`status ${input.devices.length ? 'ok' : ''}`} title="Estado de la conexión MIDI">
          {input.devices.length ? `● ${settings.midiInput === 'all' && input.devices.length > 1 ? `${input.devices.length} entradas MIDI` : device}` : '○ Sin batería'}
          {settings.keyboardInput && <span className="muted"> · F/J</span>}
        </a>
      </header>
      <main>{page}</main>
    </>
  );
}
