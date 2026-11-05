import { useSyncExternalStore } from 'react';
import { persistentStore } from './persist';

export interface SessionRecord {
  id: string;
  date: number;
  exerciseId: string;
  exerciseName: string;
  bpmStart: number;
  bpmEnd: number;
  bars: number;
  accuracy: number;
  meanOffset: number;
  stdDev: number;
  accentPct: number | null;
  stickingPct: number | null;
  gracePct: number | null;
  misses: number;
  extras: number;
  twoPads: boolean;
  source: 'midi' | 'teclado' | 'mixto';
}

const MAX_SESSIONS = 1000;
/** A tempo counts as "dominated" from this accuracy on. */
export const MASTERY = 90;

export const progressStore = persistentStore<{ sessions: SessionRecord[] }>('bateria.v1.progress', { sessions: [] });

export const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);

export function saveSession(r: Omit<SessionRecord, 'id' | 'date'>) {
  const rec: SessionRecord = { ...r, id: crypto.randomUUID(), date: Date.now() };
  progressStore.set({ sessions: [rec, ...progressStore.get().sessions].slice(0, MAX_SESSIONS) });
  return rec;
}

export function deleteSessions(exerciseId?: string) {
  progressStore.set({ sessions: exerciseId ? progressStore.get().sessions.filter((s) => s.exerciseId !== exerciseId) : [] });
}

export interface Best {
  /** Highest final BPM played with accuracy >= MASTERY. */
  masteredBpm: number | null;
  bestAccuracy: number;
  count: number;
}

export function bestFor(sessions: SessionRecord[], exerciseId: string): Best | null {
  const mine = sessions.filter((s) => s.exerciseId === exerciseId);
  if (!mine.length) return null;
  const mastered = mine.filter((s) => s.accuracy >= MASTERY).map((s) => s.bpmEnd);
  return {
    masteredBpm: mastered.length ? Math.max(...mastered) : null,
    bestAccuracy: Math.max(...mine.map((s) => s.accuracy)),
    count: mine.length,
  };
}
