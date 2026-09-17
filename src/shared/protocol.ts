/** Messages crossing the page world, the content script, and the panel iframe. */

export const PAGE_CHANNEL = "graphy:page";
export const PANEL_CHANNEL = "graphy:panel";
export const MAX_SNAPSHOT_CASES = 64;
export const MAX_SNAPSHOT_CASE_LENGTH = 64 * 1024;
export const MAX_CODE_LENGTH = 256 * 1024;
export const MAX_LANG_LENGTH = 32;
export const MAX_SLUG_LENGTH = 128;
export const MAX_CAPTURE_ERROR_LENGTH = 2 * 1024;
export const MAX_STDOUT_LENGTH = 256 * 1024;
export const MAX_STDOUT_CASES = 64;

/** Captured state of the LeetCode editor at one moment. */
export interface Snapshot {
  /** Ordered custom test cases; each entry is one Case N, parameters newline-separated. */
  cases: string[];
  /** Full solution buffer, used for signature detection. */
  code: string;
  /** LeetCode language slug, e.g. "cpp". */
  lang: string;
  slug: string;
  /** "network" snapshots come from the Run request and are authoritative for a single run. */
  source: "editor" | "network";
  at: number;
  /** Set when the full buffer could not be split into Case tabs. */
  captureError?: string;
  /** Run stdout from the LeetCode `/check` response, when present. */
  stdout?: string;
  /** Per-case stdout from `std_output_list` (one string per custom test case). */
  stdoutByCase?: string[];
}

export type PageMessage =
  | { channel: typeof PAGE_CHANNEL; type: "snapshot"; payload: Snapshot }
  | { channel: typeof PAGE_CHANNEL; type: "clear" };

export type PageTraceMessage = { channel: typeof PAGE_CHANNEL; type: "trace"; enabled: boolean };

export type PageHooksMessage = { channel: typeof PAGE_CHANNEL; type: "hooks"; enabled: boolean };

export type PageControlMessage = PageTraceMessage | PageHooksMessage;

export function pageTraceMessage(enabled: boolean): PageTraceMessage {
  return { channel: PAGE_CHANNEL, type: "trace", enabled };
}

export function pageHooksMessage(enabled: boolean): PageHooksMessage {
  return { channel: PAGE_CHANNEL, type: "hooks", enabled };
}

export function pageClearMessage(): Extract<PageMessage, { type: "clear" }> {
  return { channel: PAGE_CHANNEL, type: "clear" };
}

export type ToPanel =
  | { channel: typeof PANEL_CHANNEL; type: "snapshot"; payload: Snapshot }
  | { channel: typeof PANEL_CHANNEL; type: "clear" }
  | { channel: typeof PANEL_CHANNEL; type: "shrunk"; shrunk: boolean };

export type FromPanel =
  | { channel: typeof PANEL_CHANNEL; type: "ready" }
  | { channel: typeof PANEL_CHANNEL; type: "close" }
  | { channel: typeof PANEL_CHANNEL; type: "move"; dx: number; dy: number }
  | { channel: typeof PANEL_CHANNEL; type: "persist" }
  | { channel: typeof PANEL_CHANNEL; type: "setShrunk"; shrunk: boolean };

function onChannel(data: unknown, channel: string): data is { channel: string; type: unknown } {
  return typeof data === "object" && data !== null && (data as { channel?: unknown }).channel === channel;
}

function isBoundedString(value: unknown, max: number, nonEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (!nonEmpty || value.length > 0);
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((entry) => isBoundedString(entry, maxLength));
}

function isSnapshot(payload: unknown): payload is Snapshot {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (
    !isStringArray(p.cases, MAX_SNAPSHOT_CASES, MAX_SNAPSHOT_CASE_LENGTH) ||
    !isBoundedString(p.code, MAX_CODE_LENGTH) ||
    !isBoundedString(p.lang, MAX_LANG_LENGTH, true) ||
    !isBoundedString(p.slug, MAX_SLUG_LENGTH, true) ||
    (p.source !== "editor" && p.source !== "network") ||
    typeof p.at !== "number" ||
    !Number.isFinite(p.at)
  ) {
    return false;
  }
  if (p.captureError !== undefined && !isBoundedString(p.captureError, MAX_CAPTURE_ERROR_LENGTH)) return false;
  if (p.stdout !== undefined && !isBoundedString(p.stdout, MAX_STDOUT_LENGTH)) return false;
  if (p.stdoutByCase !== undefined && !isStringArray(p.stdoutByCase, MAX_STDOUT_CASES, MAX_STDOUT_LENGTH)) return false;
  return true;
}

/** Any page script can post on this channel, so payloads are shape-checked. */
export function isPageMessage(data: unknown): data is PageMessage {
  if (!onChannel(data, PAGE_CHANNEL)) return false;
  const m = data as { type?: unknown; payload?: unknown };
  if (m.type === "clear") return true;
  return m.type === "snapshot" && isSnapshot(m.payload);
}

export function isPageTraceMessage(data: unknown): data is PageTraceMessage {
  if (!onChannel(data, PAGE_CHANNEL)) return false;
  const m = data as { type?: unknown; enabled?: unknown };
  return m.type === "trace" && typeof m.enabled === "boolean";
}

export function isPageControlMessage(data: unknown): data is PageControlMessage {
  if (!onChannel(data, PAGE_CHANNEL)) return false;
  const m = data as { type?: unknown; enabled?: unknown };
  return (m.type === "trace" || m.type === "hooks") && typeof m.enabled === "boolean";
}

export function isPanelMessage(data: unknown): data is FromPanel {
  if (!onChannel(data, PANEL_CHANNEL)) return false;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case "ready":
    case "close":
    case "persist":
    case "clear":
      return true;
    case "setShrunk":
      return typeof m.shrunk === "boolean";
    case "move":
      return (
        typeof m.dx === "number" &&
        Number.isFinite(m.dx) &&
        typeof m.dy === "number" &&
        Number.isFinite(m.dy)
      );
    default:
      return false;
  }
}

export function isToPanel(data: unknown): data is ToPanel {
  if (!onChannel(data, PANEL_CHANNEL)) return false;
  const m = data as Record<string, unknown>;
  if (m.type === "snapshot") return isSnapshot(m.payload);
  if (m.type === "clear") return true;
  if (m.type === "shrunk") return typeof m.shrunk === "boolean";
  return false;
}
