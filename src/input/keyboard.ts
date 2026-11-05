import { inputHub } from '../midi/inputHub';
import { settingsStore } from '../store/settings';

const KEYS: Record<string, 'R' | 'L'> = { f: 'R', j: 'L' };

/** F = right hand, J = left hand, Shift = accent. Lets you try everything without the kit. */
export function installKeyboardInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !settingsStore.get().keyboardInput) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    const hand = KEYS[e.key.toLowerCase()];
    if (!hand) return;
    e.preventDefault();
    inputHub.emit({ time: e.timeStamp, note: -1, velocity: e.shiftKey ? 110 : 64, source: 'teclado', hand });
  });
}
