import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { memo } from "./memo.js";

export const CUSTOM_CASE = "custom";

export type CaseSelection = number | typeof CUSTOM_CASE;

export type CaseTabActivation = "click" | "arrow";

export function caseTabId(selection: CaseSelection): string {
  return `graphy-case-tab-${selection}`;
}

function positionOf(selection: CaseSelection, count: number): number {
  if (selection === CUSTOM_CASE) return count;
  return selection >= 0 && selection < count ? selection : -1;
}

function selectionAt(position: number, count: number): CaseSelection {
  return position >= count ? CUSTOM_CASE : position;
}

interface Props {
  count: number;
  selection: CaseSelection | null;
  onChange: (selection: CaseSelection, activation: CaseTabActivation) => void;
}

function CaseTabsView({ count, selection, onChange }: Props): JSX.Element {
  const total = count + 1;
  const [focused, setFocused] = useState<CaseSelection>(selection ?? 0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const placedRef = useRef(false);

  useEffect(() => {
    if (selection !== null) setFocused(selection);
  }, [selection]);

  const selectedPosition = selection === null ? -1 : positionOf(selection, count);
  const focusedPosition = positionOf(focused, count);
  const rovingPosition = focusedPosition >= 0 ? focusedPosition : Math.max(selectedPosition, 0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    const place = (): void => {
      const tab = selectedPosition >= 0 ? tabRefs.current[selectedPosition] : null;
      if (!tab) {
        indicator.hidden = true;
        placedRef.current = false;
        return;
      }
      const first = !placedRef.current;
      if (first) indicator.classList.add("is-instant");
      indicator.hidden = false;
      indicator.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop + tab.offsetHeight}px) scaleX(${tab.offsetWidth})`;
      if (first) {
        void indicator.offsetWidth;
        indicator.classList.remove("is-instant");
      }
      placedRef.current = true;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [selectedPosition, total]);

  const selectPosition = (position: number, activation: CaseTabActivation): void => {
    const next = selectionAt(position, count);
    setFocused(next);
    tabRefs.current[position]?.focus();
    onChange(next, activation);
  };

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, position: number): void => {
    let nextPosition: number | undefined;
    if (event.key === "ArrowRight") nextPosition = (position + 1) % total;
    if (event.key === "ArrowLeft") nextPosition = (position - 1 + total) % total;
    if (event.key === "Home") nextPosition = 0;
    if (event.key === "End") nextPosition = total - 1;
    if (nextPosition === undefined) return;
    event.preventDefault();
    selectPosition(nextPosition, "arrow");
  };

  return (
    <div class="case-switcher" role="tablist" aria-label="Test cases" ref={listRef}>
      {Array.from({ length: total }, (_, position) => {
        const tab = selectionAt(position, count);
        const label = tab === CUSTOM_CASE ? "Custom" : `Case ${tab + 1}`;
        return (
          <button
            ref={(element) => { tabRefs.current[position] = element; }}
            class={tab === CUSTOM_CASE ? "case-pill case-pill-custom" : "case-pill"}
            role="tab"
            key={tab}
            id={caseTabId(tab)}
            type="button"
            tabIndex={position === rovingPosition ? 0 : -1}
            aria-selected={position === selectedPosition}
            aria-controls="graphy-case-panel"
            aria-label={label}
            onClick={() => selectPosition(position, "click")}
            onKeyDown={(event) => onKeyDown(event, position)}
          >
            {label}
          </button>
        );
      })}
      <span class="case-indicator" ref={indicatorRef} aria-hidden="true" />
    </div>
  );
}

export const CaseTabs = memo(CaseTabsView);
