import type { JSX } from "preact";
import { memo } from "./memo.js";

function PrivacyNoticeView(props: { onDismiss: () => void }): JSX.Element {
  return (
    <aside class="privacy-notice" aria-label="Privacy">
      <p>Graphy reads this page locally. Nothing is sent to a Graphy server.</p>
      <button type="button" class="text-btn" onClick={props.onDismiss}>
        Dismiss
      </button>
    </aside>
  );
}

export const PrivacyNotice = memo(PrivacyNoticeView);
