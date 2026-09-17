import { pageHooksMessage, pageTraceMessage } from "../shared/protocol.js";

export function notifyPageTrace(enabled: boolean): void {
  window.postMessage(pageTraceMessage(enabled), location.origin);
}

export function notifyPageHooks(enabled: boolean): void {
  window.postMessage(pageHooksMessage(enabled), location.origin);
}
