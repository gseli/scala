import { useSyncExternalStore } from 'react';
import { persistentStore } from './persist';

export interface Settings {
  /** Selected MIDI input id, or 'all'. */
  midiInput: string;
  /** Measured delay between the click and your stroke being registered, ms. */
  latencyMs: number;
  accentRatio: number;
  rightNotes: number[];
  leftNotes: number[];
  clickVolume: number;
  keyboardInput: boolean;
  /** Play every note of the exercise while practising. */
  guide: boolean;
  guideVolume: number;
  /** Where to replay your take: on the kit over MIDI, or with the computer's sound. */
  replayVia: 'midi' | 'pc';
  /** Last tempo used per exercise. */
  lastBpm: Record<string, number>;
}

export const settingsStore = persistentStore<Settings>('bateria.v1.settings', {
  midiInput: 'all',
  latencyMs: 0,
  accentRatio: 1.25,
  rightNotes: [38],
  leftNotes: [48],
  clickVolume: 0.7,
  keyboardInput: true,
  guide: true,
  guideVolume: 0.8,
  replayVia: 'midi',
  lastBpm: {},
});

export const useSettings = () => useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
