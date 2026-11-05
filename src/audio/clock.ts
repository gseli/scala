let ctx: AudioContext | null = null;

export function audioContext(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}

export async function resumeAudio(): Promise<AudioContext> {
  const c = audioContext();
  if (c.state !== 'running') await c.resume();
  return c;
}

/**
 * Offset (ms) to convert AudioContext time into the performance.now() clock that MIDI and keyboard
 * events use: perfMs = contextSeconds * 1000 + offset. Based on the output timestamp, so it already
 * includes the output latency the browser knows about.
 */
export function contextToPerfOffset(c: AudioContext): number {
  const ts = c.getOutputTimestamp?.();
  if (ts && ts.contextTime && ts.performanceTime) return ts.performanceTime - ts.contextTime * 1000;
  return performance.now() - c.currentTime * 1000 + ((c.baseLatency ?? 0) + (c.outputLatency ?? 0)) * 1000;
}
