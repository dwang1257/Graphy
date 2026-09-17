import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

interface Props {
  count: number;
  activeIndex: number;
  onChange: (index: number) => void;
}

export function CaseTabs({ count, activeIndex, onChange }: Props): JSX.Element | null {
  const [focusIndex, setFocusIndex] = useState(activeIndex);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusIndex(activeIndex);
  }, [activeIndex]);

  if (count <= 1) return null;

  const selectIndex = (index: number): void => {
    setFocusIndex(index);
    onChange(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % count;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + count) % count;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = count - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectIndex(nextIndex);
  };

  return (
    <div class="case-switcher" role="tablist" aria-label="Test cases">
      {Array.from({ length: count }, (_, index) => (
        <button
          ref={(element) => { tabRefs.current[index] = element; }}
          class="case-pill"
          role="tab"
          key={index}
          id={`graphy-case-tab-${index}`}
          type="button"
          tabIndex={index === focusIndex ? 0 : -1}
          aria-selected={index === activeIndex}
          aria-controls="graphy-case-panel"
          aria-label={`Case ${index + 1}`}
          onClick={() => selectIndex(index)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          Case {index + 1}
        </button>
      ))}
    </div>
  );
}
