import type { JSX } from "preact";

export function shouldShowPrivacyNotice(value: unknown): boolean {
  return value !== true;
}

export function PrivacyNotice(props: { onDismiss: () => void }): JSX.Element {
  return (
    <aside class="privacy-notice" aria-label="Graphy privacy notice">
      <p>
        Graphy reads LeetCode editor, custom testcase, and Run output locally. Settings stay in Chrome sync or local storage, and Graphy does not send this data to a Graphy server.
      </p>
      <button type="button" class="privacy-notice-dismiss" onClick={props.onDismiss}>
        Got it
      </button>
    </aside>
  );
}
