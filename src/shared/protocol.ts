/** Messages crossing the page world, the content script, and the panel iframe. */

export const PAGE_CHANNEL = "graphy:page";
export const PANEL_CHANNEL = "graphy:panel";

/** Captured state of the LeetCode editor at one moment. */
export interface Snapshot {
  /** Raw custom-testcase text, one parameter per line. */
  input: string;
  /** Full solution buffer, used for signature detection. */
  code: string;
  /** LeetCode language slug, e.g. "cpp". */
  lang: string;
  slug: string;
  /** "network" snapshots come from the Run request and are authoritative. */
  source: "editor" | "network";
}

export type PageMessage = { channel: typeof PAGE_CHANNEL; type: "snapshot"; payload: Snapshot };

export type ToPanel =
  | { channel: typeof PANEL_CHANNEL; type: "snapshot"; payload: Snapshot; pageIsDark: boolean }
  | { channel: typeof PANEL_CHANNEL; type: "theme"; pageIsDark: boolean };

export type FromPanel =
  | { channel: typeof PANEL_CHANNEL; type: "ready" }
  | { channel: typeof PANEL_CHANNEL; type: "close" }
  | { channel: typeof PANEL_CHANNEL; type: "collapse"; collapsed: boolean }
  | { channel: typeof PANEL_CHANNEL; type: "move"; dx: number; dy: number }
  | { channel: typeof PANEL_CHANNEL; type: "resize"; dx: number; dy: number }
  | { channel: typeof PANEL_CHANNEL; type: "persist" };

function onChannel(data: unknown, channel: string): data is { channel: string; type: unknown } {
  return typeof data === "object" && data !== null && (data as { channel?: unknown }).channel === channel;
}

function isSnapshot(payload: unknown): payload is Snapshot {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.input === "string" &&
    typeof p.code === "string" &&
    typeof p.lang === "string" &&
    typeof p.slug === "string" &&
    (p.source === "editor" || p.source === "network")
  );
}

/** Any page script can post on this channel, so payloads are shape-checked. */
export function isPageMessage(data: unknown): data is PageMessage {
  if (!onChannel(data, PAGE_CHANNEL)) return false;
  const m = data as { type?: unknown; payload?: unknown };
  return m.type === "snapshot" && isSnapshot(m.payload);
}

export function isPanelMessage(data: unknown): data is FromPanel {
  return onChannel(data, PANEL_CHANNEL);
}

export function isToPanel(data: unknown): data is ToPanel {
  if (!onChannel(data, PANEL_CHANNEL)) return false;
  const m = data as { type?: unknown; payload?: unknown; pageIsDark?: unknown };
  if (m.type === "theme") return typeof m.pageIsDark === "boolean";
  return m.type === "snapshot" && isSnapshot(m.payload);
}
