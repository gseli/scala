export interface OutNote {
  /** performance.now() clock, ms. */
  time: number;
  note: number;
  velocity: number;
}

const LOOKAHEAD_MS = 150;
const TICK_MS = 25;
const NOTE_LEN_MS = 60;
/** Channel 10, where drum modules listen. */
const NOTE_ON = 0x99;
const NOTE_OFF = 0x89;

/**
 * Plays notes on a MIDI device (e.g. the TD-07, so you hear its own kit). Sends them a little
 * ahead with timestamps, in small batches, so stopping takes effect quickly. Returns a stop function.
 */
export function playOnDevice(output: MIDIOutput, notes: OutNote[]): () => void {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  let next = 0;
  const pump = () => {
    const horizon = performance.now() + LOOKAHEAD_MS;
    while (next < sorted.length && sorted[next].time < horizon) {
      const n = sorted[next++];
      output.send([NOTE_ON, n.note, n.velocity], n.time);
      output.send([NOTE_OFF, n.note, 0], n.time + NOTE_LEN_MS);
    }
    if (next >= sorted.length) window.clearInterval(timer);
  };
  const timer = window.setInterval(pump, TICK_MS);
  pump();
  return () => window.clearInterval(timer);
}
