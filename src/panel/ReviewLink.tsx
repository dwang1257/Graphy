import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { loadReviewHidden, saveReviewHidden } from "../settings/storage.js";
import { StarIcon } from "./icons.js";
import { memo } from "./memo.js";

export const REVIEW_URL = "https://chromewebstore.google.com/detail/graphy-leetcode-graph-vis/amnjkcbkjhflapgmlphepddgfcmnnoid/reviews";

const PROMPT_ID = "graphy-review-prompt";

function ReviewLinkView({ shrunk }: { shrunk: boolean }): JSX.Element | null {
  const [hidden, setHidden] = useState(true);
  const [asking, setAsking] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let live = true;
    void loadReviewHidden().then((value) => {
      if (live) setHidden(value);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!asking) return;
    const doc = root.current?.ownerDocument;
    if (!doc) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setAsking(false);
    };
    const onPointer = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setAsking(false);
    };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onPointer);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("pointerdown", onPointer);
    };
  }, [asking]);

  if (hidden) return null;

  const open = asking && !shrunk;

  return (
    <span class="review" ref={root}>
      <a
        class="icon-btn review-link"
        href={REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Review Graphy"
        aria-label="Review Graphy on the Chrome Web Store"
        aria-controls={open ? PROMPT_ID : undefined}
        onClick={() => setAsking(true)}
      >
        <StarIcon />
      </a>
      {open && (
        <div class="review-prompt" id={PROMPT_ID} role="dialog" aria-label="Review Graphy">
          <p>Thanks for supporting Graphy! The review page opened in a new tab.</p>
          <div class="review-actions">
            <button
              type="button"
              class="text-btn"
              onClick={() => {
                setAsking(false);
                setHidden(true);
                void saveReviewHidden();
              }}
            >
              Don't show again
            </button>
            <button type="button" class="text-btn" onClick={() => setAsking(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export const ReviewLink = memo(ReviewLinkView);
