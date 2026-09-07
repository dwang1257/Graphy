import type { GraphModel } from "./types.js";

/** One parsed stdout directive from a `#graphy ...` line. */
export type TraceEvent =
  | { kind: "current"; ref: string; line: number }
  | { kind: "visit"; ref: string; line: number }
  | { kind: "enqueue"; ref: string; line: number }
  | { kind: "dequeue"; ref: string; line: number }
  | { kind: "frontier"; refs: string[]; line: number }
  | { kind: "clear"; line: number };

/** Cumulative highlight state after one event — one scrubber frame. */
export interface TraceFrame {
  current?: string;
  visited: string[];
  frontier: string[];
  line: number;
  /** Short label for the playback UI (e.g. "current n0"). */
  label: string;
}

const PREFIX = /^\s*#?graphy\s+(.+?)\s*$/i;
const VERBS = new Set(["current", "curr", "visit", "enqueue", "dequeue", "frontier", "clear", "walk"]);

function isVerb(token: string): boolean {
  return VERBS.has(token.toLowerCase());
}

function pushRefEvents(events: TraceEvent[], verb: string, ref: string, line: number): void {
  if (verb === "walk") {
    events.push({ kind: "current", ref, line }, { kind: "visit", ref, line });
    return;
  }
  if (verb === "current" || verb === "curr") events.push({ kind: "current", ref, line });
  else if (verb === "visit") events.push({ kind: "visit", ref, line });
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
    const tokens = (match[1] ?? "").split(/\s+/).filter(Boolean);
    let index = 0;
    while (index < tokens.length) {
      const raw = tokens[index] ?? "";
      const verb = raw.toLowerCase();
      if (!isVerb(verb)) {
        index += 1;
        continue;
      }
      index += 1;
      if (verb === "clear") {
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

/** Parses stdout and folds events into cumulative frames ready for the scrubber. */
export function framesFromStdout(stdout: string, model: GraphModel): TraceFrame[] {
  const events = parseTrace(stdout);
  const frames: TraceFrame[] = [];
  let current: string | undefined;
  const visited: string[] = [];
  const frontier: string[] = [];
  const visitedSet = new Set<string>();
  const frontierSet = new Set<string>();

  for (const event of events) {
    if (event.kind === "clear") {
      current = undefined;
      visited.length = 0;
      frontier.length = 0;
      visitedSet.clear();
      frontierSet.clear();
      frames.push({
        current: undefined,
        visited: [],
        frontier: [],
        line: event.line,
        label: "clear",
      });
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
      frames.push({
        current,
        visited: [...visited],
        frontier: [...frontier],
        line: event.line,
        label: `frontier ${event.refs.join(" ")}`,
      });
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

    frames.push({
      current,
      visited: [...visited],
      frontier: [...frontier],
      line: event.line,
      label: `${event.kind} ${event.ref}`,
    });
  }

  return frames;
}
