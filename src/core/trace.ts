import type { GraphModel } from "./types.js";
import { deletedIds, parseTopologyTokens, type TreeLinks } from "./topology.js";

export type { TreeLinks };

/** One parsed stdout directive from a `#graphy ...` or compact `#g ...` line. */
export type TraceEvent =
  | { kind: "current"; ref: string; line: number }
  | { kind: "visit"; ref: string; line: number }
  | { kind: "enqueue"; ref: string; line: number }
  | { kind: "dequeue"; ref: string; line: number }
  | { kind: "frontier"; refs: string[]; line: number }
  | { kind: "topology"; links: TreeLinks; line: number; patch?: boolean }
  | { kind: "clear"; line: number };

/** Cumulative highlight state after one event — one scrubber frame. */
export interface TraceFrame {
  current?: string;
  visited: string[];
  frontier: string[];
  line: number;
  /** Short label for the playback UI (e.g. "current n0"). */
  label: string;
  /** Current tree child pointers (seeded from the model, updated by topology). */
  links: TreeLinks;
  /** Base node ids that are no longer reachable. */
  deleted: string[];
}

const PREFIX = /^\s*#?(?:graphy|g)(?:\s+|\/)(.*)$/i;
const VERBS = new Set([
  "current",
  "curr",
  "c",
  "visit",
  "v",
  "enqueue",
  "dequeue",
  "frontier",
  "clear",
  "/",
  "walk",
  "topology",
  "t",
]);

function isVerb(token: string): boolean {
  return VERBS.has(token.toLowerCase());
}

function nodeRef(index: number): string {
  return `n${index}`;
}

function childFromAtom(value: number | null): string | undefined {
  return value === null ? undefined : nodeRef(value);
}

type ArrayItem = number | [number, number | null, number | null];

/** Parses `#graphy/[0,(0,2,1),2]` — ints are current+visit, tuples are topology patches. */
function parseCompactArray(raw: string): ArrayItem[] {
  const s = raw.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return [];
  const inner = s.slice(1, -1);
  const items: ArrayItem[] = [];
  let i = 0;

  const skip = (): void => {
    while (i < inner.length && /[\s,]/.test(inner[i] ?? "")) i += 1;
  };

  const parseAtom = (): number | null => {
    skip();
    if (inner.startsWith("None", i)) {
      i += 4;
      return null;
    }
    const next = inner[i + 1] ?? "";
    if (inner[i] === "-" && (next === "," || next === ")" || next === "" || /\s/.test(next))) {
      i += 1;
      return null;
    }
    const match = /^-?\d+/.exec(inner.slice(i));
    if (!match) {
      if (i < inner.length) i += 1;
      return null;
    }
    i += match[0].length;
    return Number(match[0]);
  };

  while (i < inner.length) {
    skip();
    if (i >= inner.length) break;
    if (inner[i] === "(") {
      i += 1;
      const id = parseAtom();
      skip();
      if (inner[i] === ",") i += 1;
      const left = parseAtom();
      skip();
      if (inner[i] === ",") i += 1;
      const right = parseAtom();
      skip();
      if (inner[i] === ")") i += 1;
      if (id !== null) items.push([id, left, right]);
      continue;
    }
    const value = parseAtom();
    if (value !== null) items.push(value);
  }
  return items;
}

function parseArrayEvents(raw: string, line: number): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const item of parseCompactArray(raw)) {
    if (typeof item === "number") {
      const ref = nodeRef(item);
      events.push({ kind: "current", ref, line }, { kind: "visit", ref, line });
      continue;
    }
    const [id, left, right] = item;
    const entry: { left?: string; right?: string } = {};
    const lid = childFromAtom(left);
    const rid = childFromAtom(right);
    if (lid) entry.left = lid;
    if (rid) entry.right = rid;
    events.push({ kind: "topology", links: { [nodeRef(id)]: entry }, line, patch: true });
  }
  return events;
}

function pushRefEvents(events: TraceEvent[], verb: string, ref: string, line: number): void {
  if (verb === "walk") {
    events.push({ kind: "current", ref, line }, { kind: "visit", ref, line });
    return;
  }
  if (verb === "current" || verb === "curr" || verb === "c") events.push({ kind: "current", ref, line });
  else if (verb === "visit" || verb === "v") events.push({ kind: "visit", ref, line });
  else if (verb === "enqueue") events.push({ kind: "enqueue", ref, line });
  else if (verb === "dequeue") events.push({ kind: "dequeue", ref, line });
}

/** Extracts Graphy trace events from LeetCode Run stdout. */
export function parseTrace(stdout: string): TraceEvent[] {
  const events: TraceEvent[] = [];
  const lines = stdout.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = PREFIX.exec(lines[i] ?? "");
    if (!match) continue;
    const line = i + 1;
    const payload = (match[1] ?? "").trim();
    if (payload.startsWith("[")) {
      events.push(...parseArrayEvents(payload, line));
      continue;
    }
    const tokens = payload.split(/\s+/).filter(Boolean);
    let index = 0;
    while (index < tokens.length) {
      const raw = tokens[index] ?? "";
      const verb = raw.toLowerCase();
      if (!isVerb(verb)) {
        index += 1;
        continue;
      }
      index += 1;
      if (verb === "clear" || verb === "/") {
        events.push({ kind: "clear", line });
        continue;
      }
      if (verb === "frontier") {
        const refs: string[] = [];
        while (index < tokens.length && !isVerb(tokens[index] ?? "")) {
          refs.push(tokens[index] ?? "");
          index += 1;
        }
        if (refs.length > 0) events.push({ kind: "frontier", refs, line });
        continue;
      }
      if (verb === "topology" || verb === "t") {
        const parts: string[] = [];
        while (index < tokens.length && !isVerb(tokens[index] ?? "")) {
          parts.push(tokens[index] ?? "");
          index += 1;
        }
        events.push({ kind: "topology", links: parseTopologyTokens(parts.join(" ")), line });
        continue;
      }
      while (index < tokens.length && !isVerb(tokens[index] ?? "")) {
        pushRefEvents(events, verb, tokens[index] ?? "", line);
        index += 1;
      }
    }
  }
  return events;
}

/**
 * Maps a user ref onto a highlight target id.
 * - `n0` → node id
 * - `@2` → `n2` (tree/list index) or ignored on matrices unless `@r,c`
 * - `1,0` / `@1,0` → `cell:1,0` on matrices
 * - bare `3` → first visible node whose label is `3`
 */
export function resolveRef(ref: string, model: GraphModel): string | undefined {
  if (model.matrix) {
    const cell = parseCellRef(ref);
    if (!cell) return undefined;
    const row = model.matrix.rows[cell.r];
    if (!row || !row[cell.c]) return undefined;
    return `cell:${cell.r},${cell.c}`;
  }

  if (/^n\d+$/i.test(ref)) {
    const id = ref.toLowerCase();
    return model.nodes.some((n) => n.id === id) ? id : undefined;
  }

  if (/^@\d+$/.test(ref)) {
    const id = `n${ref.slice(1)}`;
    return model.nodes.some((n) => n.id === id) ? id : undefined;
  }

  for (const node of model.nodes) {
    if (node.role === "spine" || node.role === "null") continue;
    if (node.label === ref) return node.id;
  }
  return undefined;
}

function parseCellRef(ref: string): { r: number; c: number } | null {
  const match = /^@?(\d+)\s*,\s*(\d+)$/.exec(ref);
  if (!match) return null;
  return { r: Number(match[1]), c: Number(match[2]) };
}

function visibleBaseIds(model: GraphModel): string[] {
  return model.nodes
    .filter((n) => n.role !== "spine" && n.role !== "null")
    .map((n) => n.id);
}

function snapshotFrame(
  partial: Omit<TraceFrame, "links" | "deleted">,
  links: TreeLinks,
  baseIds: string[],
): TraceFrame {
  return {
    ...partial,
    links: { ...links },
    deleted: deletedIds(baseIds, links),
  };
}

/** Parses stdout and folds events into cumulative frames ready for the scrubber. */
export function framesFromStdout(stdout: string, model: GraphModel): TraceFrame[] {
  const events = parseTrace(stdout);
  const frames: TraceFrame[] = [];
  let current: string | undefined;
  const visited: string[] = [];
  const frontier: string[] = [];
  const visitedSet = new Set<string>();
  const frontierSet = new Set<string>();
  let links: TreeLinks = model.links ? structuredClone(model.links) : {};
  const baseIds = visibleBaseIds(model);

  for (const event of events) {
    if (event.kind === "clear") {
      current = undefined;
      visited.length = 0;
      frontier.length = 0;
      visitedSet.clear();
      frontierSet.clear();
      frames.push(
        snapshotFrame(
          {
            current: undefined,
            visited: [],
            frontier: [],
            line: event.line,
            label: "clear",
          },
          links,
          baseIds,
        ),
      );
      continue;
    }

    if (event.kind === "topology") {
      links = event.patch ? { ...links, ...event.links } : event.links;
      frames.push(
        snapshotFrame(
          {
            current,
            visited: [...visited],
            frontier: [...frontier],
            line: event.line,
            label: "topology",
          },
          links,
          baseIds,
        ),
      );
      continue;
    }

    if (event.kind === "frontier") {
      frontier.length = 0;
      frontierSet.clear();
      for (const raw of event.refs) {
        const id = resolveRef(raw, model);
        if (!id || frontierSet.has(id)) continue;
        frontierSet.add(id);
        frontier.push(id);
      }
      frames.push(
        snapshotFrame(
          {
            current,
            visited: [...visited],
            frontier: [...frontier],
            line: event.line,
            label: `frontier ${event.refs.join(" ")}`,
          },
          links,
          baseIds,
        ),
      );
      continue;
    }

    const id = resolveRef(event.ref, model);
    if (!id) continue;

    if (event.kind === "current") {
      current = id;
    } else if (event.kind === "visit") {
      if (!visitedSet.has(id)) {
        visitedSet.add(id);
        visited.push(id);
      }
    } else if (event.kind === "enqueue") {
      if (!frontierSet.has(id)) {
        frontierSet.add(id);
        frontier.push(id);
      }
    } else if (event.kind === "dequeue") {
      if (frontierSet.has(id)) {
        frontierSet.delete(id);
        const index = frontier.indexOf(id);
        if (index >= 0) frontier.splice(index, 1);
      }
    }

    frames.push(
      snapshotFrame(
        {
          current,
          visited: [...visited],
          frontier: [...frontier],
          line: event.line,
          label: `${event.kind} ${event.ref}`,
        },
        links,
        baseIds,
      ),
    );
  }

  return frames;
}
