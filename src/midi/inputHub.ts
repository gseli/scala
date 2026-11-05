import { useSyncExternalStore } from 'react';
import type { Hand } from '../rudiments/types';
import { settingsStore } from '../store/settings';

export interface RawHit {
  /** performance.now() clock, ms. */
  time: number;
  /** MIDI note; -1 for the keyboard. */
  note: number;
  velocity: number;
  source: 'midi' | 'teclado';
  /** Set by keyboard input (F = R, J = L). */
  hand?: Hand;
}

export interface InputState {
  status: 'idle' | 'pending' | 'ready' | 'unsupported' | 'denied';
  devices: { id: string; name: string }[];
  /** Name of the MIDI output of the selected kit (to play notes back on it), if any. */
  output: string | null;
}

type Listener = (h: RawHit) => void;

class InputHub {
  private access: MIDIAccess | null = null;
  private hitListeners = new Set<Listener>();
  private stateListeners = new Set<() => void>();
  private state: InputState = { status: 'idle', devices: [], output: null };

  getState = () => this.state;

  subscribeState = (l: () => void) => {
    this.stateListeners.add(l);
    return () => {
      this.stateListeners.delete(l);
    };
  };

  onHit(l: Listener) {
    this.hitListeners.add(l);
    return () => {
      this.hitListeners.delete(l);
    };
  }

  emit(h: RawHit) {
    this.hitListeners.forEach((l) => l(h));
  }

  async init() {
    if (this.access || this.state.status === 'pending') return;
    if (!navigator.requestMIDIAccess) {
      this.setState({ status: 'unsupported', devices: [], output: null });
      return;
    }
    this.setState({ ...this.state, status: 'pending' });
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => this.bind();
      settingsStore.subscribe(() => this.bind());
      this.bind();
    } catch {
      this.setState({ status: 'denied', devices: [], output: null });
    }
  }

  private bind() {
    if (!this.access) return;
    const wanted = settingsStore.get().midiInput;
    const devices: InputState['devices'] = [];
    this.access.inputs.forEach((input) => {
      devices.push({ id: input.id, name: input.name ?? input.id });
      input.onmidimessage = wanted === 'all' || wanted === input.id ? this.handleMessage : null;
    });
    const output = this.output()?.name ?? null;
    const same =
      devices.length === this.state.devices.length && devices.every((d, i) => d.id === this.state.devices[i].id) && output === this.state.output;
    if (!same || this.state.status !== 'ready') this.setState({ status: 'ready', devices, output });
  }

  /** The output port of the selected kit: same name as its input (e.g. "TD-07 MIDI 1"). */
  output(): MIDIOutput | null {
    if (!this.access) return null;
    const wanted = settingsStore.get().midiInput;
    const names = new Set<string>();
    this.access.inputs.forEach((i) => {
      if ((wanted === 'all' || wanted === i.id) && i.name && !/midi through/i.test(i.name)) names.add(i.name);
    });
    for (const o of this.access.outputs.values()) if (o.name && names.has(o.name)) return o;
    return null;
  }

  private handleMessage = (e: MIDIMessageEvent) => {
    const d = e.data;
    if (!d || d.length < 3) return;
    if ((d[0] & 0xf0) === 0x90 && d[2] > 0) {
      this.emit({ time: e.timeStamp, note: d[1], velocity: d[2], source: 'midi' });
    }
  };

  private setState(s: InputState) {
    this.state = s;
    this.stateListeners.forEach((l) => l());
  }
}

export const inputHub = new InputHub();

export const useInputState = () => useSyncExternalStore(inputHub.subscribeState, inputHub.getState);
