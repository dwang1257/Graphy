import type { GNode, GraphModel } from "./types.js";
import { deletedIds, parseTopologyTokens, type TreeLinks } from "./topology.js";

export type { TreeLinks };

export type TraceEvent =
  | { kind: "current"; ref: string; line: number }
  | { kind: "visit"; ref: string; line: number }
  | { kind: "enqueue"; ref: string; line: number }
  | { kind: "dequeue"; ref: string; line: number }
  | { kind: "frontier"; refs: string[]; line: number }
  | { kind: "topology"; links: TreeLinks; line: number; patch?: boolean }
  | { kind: "alloc"; ref: string; label: string; line: number }
  | { kind: "clear"; line: number };

export interface TraceFrame {
  current?: string;
  visited: string[];
  frontier: string[];
  line: number;
  label: string;
  links: TreeLinks;
  deleted: string[];
  allocs: GNode[];
}

const PREFIX = /^\s*#?(?:graphy|g)(?:\s+|\/)(.*)$/i;

type Verb =
  | "current"
  | "visit"
  | "enqueue"
  | "dequeue"
  | "frontier"
  | "clear"
  | "walk"
  | "topology";

const VERBS: Record<string, Verb> = {
  current: "current",
  curr: "current",
  c: "current",
  visit: "visit",
  v: "visit",
  enqueue: "enqueue",
  dequeue: "dequeue",
  frontier: "frontier",
  clear: "clear",
  "/": "clear",
  walk: "walk",
  topology: "topology",
  t: "topology",
};

function verbOf(token: string): Verb | undefined {
  return VERBS[token.toLowerCase()];
}

function nodeRef(index: number): string {
  return `n${index}`;
}

function childFromAtom(value: number | null): string | undefined {
  return value === null ? undefined : nodeRef(value);
}

type ArrayItem = number | string | Array<number | null>;

function parseCompactArray(raw: string): ArrayItem[] {
  const s = raw.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return [];
  const inner = s.slice(1, -1);
  const items: ArrayItem[] = [];
  let i = 0;

  function skipSep(): void {
    while (i < inner.length && /[\s,]/.test(inner[i] ?? "")) i += 1;
  }

  function skipWs(): void {
    while (i < inner.length && /\s/.test(inner[i] ?? "")) i += 1;
  }

  function parseAtom(): number | null {
    skipSep();
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
  }

  while (i < inner.length) {
    skipSep();
    if (i >= inner.length) break;
    if (inner[i] !== "(") {
      const value = parseAtom();
      if (value !== null) items.push(value);
      continue;
    }
    i += 1;
    const atoms: Array<number | null> = [];
    for (;;) {
      atoms.push(parseAtom());
      skipWs();
      if (inner[i] === "," && atoms.length < 4) {
        i += 1;
        continue;
      }
      break;
    }
    if (inner[i] === ")") i += 1;
    const first = atoms[0];
    if (first === null || first === undefined) continue;
    if (atoms.length >= 4) items.push([first, atoms[1] ?? null, atoms[2] ?? null, atoms[3] ?? null]);
    else if (atoms.length >= 3) items.push([first, atoms[1] ?? null, atoms[2] ?? null]);
    else if (atoms.length >= 2 && atoms[1] !== null && atoms[1] !== undefined) {
      items.push(`${first},${atoms[1]}`);
    }
  }
  return items;
}

function topologyEntry(left: number | null, right?: number | null): { left?: string; right?: string } {
  const entry: { left?: string; right?: string } = {};
  const lid = childFromAtom(left);
  if (lid) entry.left = lid;
  if (right !== undefined) {
    const rid = childFromAtom(right);
    if (rid) entry.right = rid;
  }
  return entry;
}

function parseArrayEvents(raw: string, line: number): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const item of parseCompactArray(raw)) {
    if (!Array.isArray(item)) {
      const ref = typeof item === "number" ? nodeRef(item) : item;
      events.push({ kind: "current", ref, line }, { kind: "visit", ref, line });
      continue;
    }
    const [id, left, right, val] = item;
    const ref = nodeRef(id!);
    if (item.length >= 4) {
      events.push({ kind: "alloc", ref, label: String(val ?? 0), line });
    }
    const kids = item.length >= 4
      ? topologyEntry(left ?? null)
      : topologyEntry(left ?? null, right ?? null);
    events.push({ kind: "topology", links: { [ref]: kids }, line, patch: true });
  }
  return events;
}

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
      const verb = verbOf(tokens[index] ?? "");
      if (!verb) {
        index += 1;
        continue;
      }
      index += 1;
      if (verb === "clear") {
        events.push({ kind: "clear", line });
        continue;
      }
      const args: string[] = [];
      while (index < tokens.length && !verbOf(tokens[index] ?? "")) {
        args.push(tokens[index] ?? "");
        index += 1;
      }
      if (verb === "frontier") {
        if (args.length > 0) events.push({ kind: "frontier", refs: args, line });
      } else if (verb === "topology") {
        events.push({ kind: "topology", links: parseTopologyTokens(args.join(" ")), line });
      } else {
        for (const ref of args) {
          if (verb === "walk") {
            events.push({ kind: "current", ref, line }, { kind: "visit", ref, line });
          } else {
            events.push({ kind: verb, ref, line });
          }
        }
      }
    }
  }
  return events;
}

export function resolveRef(ref: string, model: GraphModel, extra: GNode[] = []): string | undefined {
  if (model.matrix) {
    const cell = parseCellRef(ref);
    if (!cell) return undefined;
    const row = model.matrix.rows[cell.r];
    if (!row || !row[cell.c]) return undefined;
    return `cell:${cell.r},${cell.c}`;
  }

  const nodes = extra.length > 0 ? [...model.nodes, ...extra] : model.nodes;
  let byId: string | undefined;
  if (/^n\d+$/i.test(ref)) byId = ref.toLowerCase();
  else if (/^@\d+$/.test(ref)) byId = `n${ref.slice(1)}`;
  if (byId) return nodes.some((n) => n.id === byId) ? byId : undefined;

  for (const node of nodes) {
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

function pushUnique(ids: string[], seen: Set<string>, id: string): void {
  if (seen.has(id)) return;
  seen.add(id);
  ids.push(id);
}

export function framesFromStdout(stdout: string, model: GraphModel): TraceFrame[] {
  const events = parseTrace(stdout);
  const frames: TraceFrame[] = [];
  let current: string | undefined;
  const visited: string[] = [];
  const frontier: string[] = [];
  const visitedSet = new Set<string>();
  const frontierSet = new Set<string>();
  let links: TreeLinks = model.links ? structuredClone(model.links) : {};
  const baseIds = model.nodes
    .filter((n) => n.role !== "spine" && n.role !== "null")
    .map((n) => n.id);
  const allocs: GNode[] = [];
  const allocIds = new Set<string>();

  function frame(label: string, line: number): TraceFrame {
    return {
      current,
      visited: [...visited],
      frontier: [...frontier],
      line,
      label,
      links: { ...links },
      deleted: model.kind === "linked-list" ? [] : deletedIds(baseIds, links),
      allocs: [...allocs],
    };
  }

  for (const event of events) {
    if (event.kind === "clear") {
      current = undefined;
      visited.length = 0;
      frontier.length = 0;
      visitedSet.clear();
      frontierSet.clear();
      frames.push(frame("clear", event.line));
      continue;
    }

    if (event.kind === "alloc") {
      if (!allocIds.has(event.ref) && !model.nodes.some((n) => n.id === event.ref)) {
        allocIds.add(event.ref);
        allocs.push({ id: event.ref, label: event.label, role: "normal" });
      }
      frames.push(frame(`alloc ${event.ref}`, event.line));
      continue;
    }

    if (event.kind === "topology") {
      links = event.patch ? { ...links, ...event.links } : event.links;
      frames.push(frame("topology", event.line));
      continue;
    }

    if (event.kind === "frontier") {
      frontier.length = 0;
      frontierSet.clear();
      for (const raw of event.refs) {
        const id = resolveRef(raw, model, allocs);
        if (id) pushUnique(frontier, frontierSet, id);
      }
      frames.push(frame(`frontier ${event.refs.join(" ")}`, event.line));
      continue;
    }

    const id = resolveRef(event.ref, model, allocs);
    if (!id) continue;

    if (event.kind === "current") {
      current = id;
    } else if (event.kind === "visit") {
      pushUnique(visited, visitedSet, id);
    } else if (event.kind === "enqueue") {
      pushUnique(frontier, frontierSet, id);
    } else if (event.kind === "dequeue" && frontierSet.has(id)) {
      frontierSet.delete(id);
      const index = frontier.indexOf(id);
      if (index >= 0) frontier.splice(index, 1);
    }

    frames.push(frame(`${event.kind} ${event.ref}`, event.line));
  }

  return frames;
}
