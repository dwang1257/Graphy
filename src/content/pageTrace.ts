import { pageTraceMessage } from "../shared/protocol.js";

export function notifyPageTrace(enabled: boolean): void {
  window.postMessage(pageTraceMessage(enabled), location.origin);
}
