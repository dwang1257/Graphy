/** Messages crossing the page world, the content script, and the panel iframe. */

export const PAGE_CHANNEL = "graphy:page";
export const PANEL_CHANNEL = "graphy:panel";

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

export type PageMessage = { channel: typeof PAGE_CHANNEL; type: "snapshot"; payload: Snapshot };

export type ToPanel =
  | { channel: typeof PANEL_CHANNEL; type: "snapshot"; payload: Snapshot }
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSnapshot(payload: unknown): payload is Snapshot {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (
    !isStringArray(p.cases) ||
    typeof p.code !== "string" ||
    typeof p.lang !== "string" ||
    typeof p.slug !== "string" ||
    (p.source !== "editor" && p.source !== "network") ||
    typeof p.at !== "number" ||
    !Number.isFinite(p.at)
  ) {
    return false;
  }
  if (p.captureError !== undefined && typeof p.captureError !== "string") return false;
  if (p.stdout !== undefined && typeof p.stdout !== "string") return false;
  if (p.stdoutByCase !== undefined && !isStringArray(p.stdoutByCase)) return false;
  return true;
}

/** Any page script can post on this channel, so payloads are shape-checked. */
export function isPageMessage(data: unknown): data is PageMessage {
  if (!onChannel(data, PAGE_CHANNEL)) return false;
  const m = data as { type?: unknown; payload?: unknown };
  return m.type === "snapshot" && isSnapshot(m.payload);
}

export function isPanelMessage(data: unknown): data is FromPanel {
  if (!onChannel(data, PANEL_CHANNEL)) return false;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case "ready":
    case "close":
    case "persist":
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
  if (m.type === "shrunk") return typeof m.shrunk === "boolean";
  return false;
}
