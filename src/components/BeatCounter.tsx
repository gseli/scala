interface Props {
  beatsPerBar: number;
  /** 0-based beat inside the bar, or null before the first click. */
  beat: number | null;
  countIn?: boolean;
}

/** Big beat number plus one dot per beat, the current one lit. */
export function BeatCounter({ beatsPerBar, beat, countIn }: Props) {
  return (
    <div className={`beat-counter ${countIn ? 'count-in' : ''}`}>
      <div className="beat-num">{beat === null ? '…' : beat + 1}</div>
      <div className="beat-dots">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span key={i} className={`beat-dot ${i === 0 ? 'one' : ''} ${i === beat ? 'on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
