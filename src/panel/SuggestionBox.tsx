import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { LightbulbIcon } from "./icons.js";
import { memo } from "./memo.js";
import {
  SUGGESTION_KINDS,
  SUGGESTION_MAX_LENGTH,
  extensionVersion,
  submitSuggestion,
  type SuggestionKind,
} from "./suggestion.js";

const POPOVER_ID = "graphy-suggest-popover";

type Status = "idle" | "sending" | "sent" | "failed";

function SuggestionBoxView({ shrunk, slug }: { shrunk: boolean; slug: string }): JSX.Element {
  const [asking, setAsking] = useState(false);
  const [kind, setKind] = useState<SuggestionKind | undefined>(undefined);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const done = useRef<HTMLButtonElement>(null);

  const open = asking && !shrunk;
  const sending = status === "sending";
  const sent = status === "sent";

  const close = (refocus: boolean): void => {
    setAsking(false);
    setStatus((current) => (current === "sending" ? current : "idle"));
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!asking) return;
    const doc = root.current?.ownerDocument;
    if (!doc) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close(true);
    };
    const onPointer = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onPointer);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("pointerdown", onPointer);
    };
  }, [asking]);

  useEffect(() => {
    if (!open) return;
    if (sent) done.current?.focus();
    else field.current?.focus();
  }, [open, sent]);

  const canSend = text.trim().length > 0 && !sending;

  const send = async (): Promise<void> => {
    if (!canSend) return;
    setStatus("sending");
    try {
      await submitSuggestion({ kind, text, slug, version: extensionVersion() });
      setText("");
      setKind(undefined);
      setStatus("sent");
    } catch {
      setStatus("failed");
      field.current?.focus();
    }
  };

  return (
    <span class="suggest" ref={root}>
      <button
        type="button"
        class="icon-btn suggest-btn"
        ref={trigger}
        title="Send a suggestion"
        aria-label="Send a suggestion"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? POPOVER_ID : undefined}
        onClick={() => (open ? close(false) : setAsking(true))}
      >
        <LightbulbIcon />
      </button>
      {open && (
        <div class="suggest-popover" id={POPOVER_ID} role="dialog" aria-label="Send a suggestion">
          {sent ? (
            <>
              <p class="suggest-thanks">Thanks! Your suggestion was sent.</p>
              <div class="suggest-actions">
                <button type="button" class="text-btn" ref={done} onClick={() => close(true)}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <form
              class="suggest-form"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <div class="segmented suggest-kinds" role="group" aria-label="Kind of suggestion">
                {SUGGESTION_KINDS.map((option) => (
                  <button
                    type="button"
                    class="segment"
                    key={option.value}
                    aria-pressed={kind === option.value}
                    disabled={sending}
                    onClick={() => setKind((current) => (current === option.value ? undefined : option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <textarea
                class="suggest-field"
                ref={field}
                rows={4}
                maxLength={SUGGESTION_MAX_LENGTH}
                placeholder="Share an idea or report a problem"
                aria-label="Suggestion"
                value={text}
                readOnly={sending}
                onInput={(event) => setText(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
                  event.preventDefault();
                  void send();
                }}
              />
              {status === "failed" && (
                <p class="suggest-error" role="alert">
                  Couldn't send. Check your connection and try again.
                </p>
              )}
              <div class="suggest-actions">
                <button type="button" class="text-btn" onClick={() => close(true)}>
                  Cancel
                </button>
                <button type="submit" class="text-btn" disabled={!canSend}>
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </span>
  );
}

export const SuggestionBox = memo(SuggestionBoxView);
