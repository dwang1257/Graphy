import { useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";
import type { TraceFrame } from "../core/trace.js";

interface Props {
  frames: TraceFrame[];
  index: number;
  playing: boolean;
  onIndexChange: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

const STEP_MS = 650;

/** Play / pause / step scrubber for `#graphy` Run traces. */
export function TracePlayback({
  frames,
  index,
  playing,
  onIndexChange,
  onPlayingChange,
}: Props): JSX.Element | null {
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const timer = window.setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= frames.length) {
        onPlayingChange(false);
        return;
      }
      onIndexChange(next);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, frames.length, onIndexChange, onPlayingChange]);

  if (frames.length === 0) return null;

  const frame = frames[index] ?? frames[0];
  const at = Math.min(index, frames.length - 1);

  return (
    <div class="trace-playback" role="group" aria-label="Execution trace">
      <button
        type="button"
        class="trace-btn"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          if (!playing && at >= frames.length - 1) onIndexChange(0);
          onPlayingChange(!playing);
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        class="trace-btn"
        aria-label="Previous step"
        disabled={at <= 0}
        onClick={() => {
          onPlayingChange(false);
          onIndexChange(Math.max(0, at - 1));
        }}
      >
        ‹
      </button>
      <button
        type="button"
        class="trace-btn"
        aria-label="Next step"
        disabled={at >= frames.length - 1}
        onClick={() => {
          onPlayingChange(false);
          onIndexChange(Math.min(frames.length - 1, at + 1));
        }}
      >
        ›
      </button>
      <input
        class="trace-scrub"
        type="range"
        min={0}
        max={frames.length - 1}
        value={at}
        aria-label="Trace step"
        onInput={(event) => {
          onPlayingChange(false);
          onIndexChange(Number((event.target as HTMLInputElement).value));
        }}
      />
      <span class="trace-meta" title={frame?.label}>
        {at + 1}/{frames.length}
        {frame ? ` · ${frame.label}` : ""}
      </span>
    </div>
  );
}
