import { useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";
import type { TraceFrame } from "../core/trace.js";
import { PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon } from "./icons.js";
import { memo } from "./memo.js";

interface Props {
  frames: readonly TraceFrame[];
  truncated?: boolean;
  index: number;
  playing: boolean;
  onIndexChange: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

const STEP_MS = 650;

function TracePlaybackView({
  frames,
  truncated = false,
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

  const at = Math.min(index, frames.length - 1);

  return (
    <div class="trace-playback" role="group" aria-label="Execution trace">
      <button
        type="button"
        class="trace-btn"
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play"}
        onClick={() => {
          if (!playing && at >= frames.length - 1) onIndexChange(0);
          onPlayingChange(!playing);
        }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        class="trace-btn"
        aria-label="Previous step"
        title="Previous step"
        disabled={at <= 0}
        onClick={() => {
          onPlayingChange(false);
          onIndexChange(Math.max(0, at - 1));
        }}
      >
        <StepBackIcon />
      </button>
      <button
        type="button"
        class="trace-btn"
        aria-label="Next step"
        title="Next step"
        disabled={at >= frames.length - 1}
        onClick={() => {
          onPlayingChange(false);
          onIndexChange(Math.min(frames.length - 1, at + 1));
        }}
      >
        <StepForwardIcon />
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
          onIndexChange(Number(event.currentTarget.value));
        }}
      />
      <span class="trace-meta">
        {at + 1}/{frames.length}
      </span>
      {truncated && (
        <span class="trace-truncated" title="The run took too many steps, so only the start is shown.">
          Trace cut off at {frames.length} steps
        </span>
      )}
    </div>
  );
}

export const TracePlayback = memo(TracePlaybackView);
