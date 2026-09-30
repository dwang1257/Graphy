import { cellId, childrenOf, initialTopology, layoutKeyOf, visibleIds, type NodeKind, type SceneNode, type SceneTopology } from "./scene.js";
import { TRACE_SENTINEL, traceLines } from "./traceWire.js";
import type { Links, Pane } from "./types.js";

export const MAX_TRACE_TEXT = 256 * 1024;
export const MAX_TRACE_FRAMES = 4_000;
const MAX_MANUAL_REFS = 100;
const MAX_LABEL = 12;

export interface TraceFrame {
  topology: SceneTopology;
  layoutKey: string;
  labels: Readonly<Record<string, string>>;
  current?: string;
  pointers: Readonly<Record<string, string>>;
  visited: readonly string[];
  frontier: readonly string[];
  dimmed: readonly string[];
}

export interface Trace {
  frames: TraceFrame[];
  truncated: boolean;
}

export const EMPTY_TRACE: Trace = { frames: [], truncated: false };

type Ref = string | null;

export type TraceOp =
  | { t: "visit"; ref: string }
  | { t: "value"; ref: string; label: string }
  | { t: "link"; ref: string; side: "<" | ">"; to: Ref }
  | { t: "alloc"; kind: NodeKind; ref: string; label: string }
  | { t: "pointer"; name: string | null; to: Ref }
  | { t: "front"; add: boolean; ref: string }
  | { t: "frontier"; refs: string[] }
  | { t: "del"; ref: string }
  | { t: "result"; ref: Ref }
  | { t: "clear" };

export type TraceStep = TraceOp[] | "~";

function nodeRef(raw: string): string | undefined {
  const [, pane = "", index] = /^([b-z]?)(\d+)$/.exec(raw) ?? [];
  return index === undefined ? undefined : `${pane || "a"}${index}`;
}

function anyRef(raw: string): Ref | undefined {
  if (raw === "-") return null;
  const [, pane = "", row, col] = /^([b-y]?)(\d+)\.(\d+)$/.exec(raw) ?? [];
  if (row !== undefined && col !== undefined) return `${pane || "a"}${row}.${col}`;
  return nodeRef(raw);
}

export function parseAutoLine(line: string): TraceStep[] {
  const steps: TraceStep[] = [];
  for (const token of line.replace(TRACE_SENTINEL, "").trimEnd().split(" ").slice(1)) {
    if (token === "") continue;
    if (token === "~") {
      steps.push("~");
      break;
    }
    steps.push(token.split(",").flatMap((raw) => parseOp(raw) ?? []));
  }
  return steps;
}

function parseOp(raw: string): TraceOp | undefined {
  const rest = raw.slice(1);
  switch (raw.charAt(0)) {
    case "+": {
      const [, kind, ref, label = ""] = /^([tl])(z\d+)=(.*)$/.exec(rest) ?? [];
      return kind && ref ? { t: "alloc", kind: kind === "t" ? "tree" : "list", ref, label: label.slice(0, MAX_LABEL) } : undefined;
    }
    case "@": {
      const [, name = "", target = ""] = /^([A-Za-z_]\w*)?=(.*)$/.exec(rest) ?? [];
      const to = anyRef(target);
      return to === undefined ? undefined : { t: "pointer", name: name || null, to };
    }
    case "&": {
      const [, sign, target = ""] = /^([+-])(.+)$/.exec(rest) ?? [];
      const ref = nodeRef(target);
      return sign && ref ? { t: "front", add: sign === "+", ref } : undefined;
    }
    case "!": {
      const ref = nodeRef(rest);
      return ref ? { t: "del", ref } : undefined;
    }
    case "^": {
      const ref = rest === "-" ? null : nodeRef(rest);
      return ref === undefined ? undefined : { t: "result", ref };
    }
  }
  const [, owner = "", op, value = ""] = /^([b-z]?\d+)([=<>])(.*)$/.exec(raw) ?? [];
  const ref = nodeRef(owner);
  if (ref && op === "=") return { t: "value", ref, label: value.slice(0, MAX_LABEL) };
  if (ref && (op === "<" || op === ">")) {
    const to = value === "-" ? null : nodeRef(value);
    return to === undefined ? undefined : { t: "link", ref, side: op, to };
  }
  const visit = anyRef(raw);
  return visit ? { t: "visit", ref: visit } : undefined;
}

const MANUAL = /^\s*#?graphy\s+(.*)$/i;

type Verb = "current" | "visit" | "walk" | "enqueue" | "dequeue" | "frontier" | "clear";

const VERBS: Record<string, Verb> = {
  current: "current",
  curr: "current",
  c: "current",
  visit: "visit",
  v: "visit",
  walk: "walk",
  enqueue: "enqueue",
  dequeue: "dequeue",
  frontier: "frontier",
  clear: "clear",
};

function verbOf(token: string): Verb | undefined {
  return VERBS[token.toLowerCase()];
}

export function parseManualText(text: string): Array<{ verb: Verb; refs: string[] }> {
  const out: Array<{ verb: Verb; refs: string[] }> = [];
  for (const line of text.split(/\r?\n/)) {
    const match = MANUAL.exec(line);
    if (!match) continue;
    const tokens = (match[1] ?? "").trim().split(/\s+/).filter(Boolean);
    let index = 0;
    while (index < tokens.length) {
      const verb = verbOf(tokens[index] ?? "");
      index += 1;
      if (!verb) continue;
      const refs: string[] = [];
      while (index < tokens.length && !verbOf(tokens[index] ?? "")) {
        if (refs.length < MAX_MANUAL_REFS) refs.push(tokens[index] ?? "");
        index += 1;
      }
      out.push({ verb, refs });
    }
  }
  return out;
}

function resolveManual(raw: string, panes: readonly Pane[], topology: SceneTopology): string | undefined {
  const [, row, col] = /^@?(\d+)\s*,\s*(\d+)$/.exec(raw) ?? [];
  if (row !== undefined && col !== undefined) {
    const grid = panes.find((pane) => pane.model.kind === "matrix");
    return grid ? cellId(grid.id, Number(row), Number(col)) : undefined;
  }
  const [, legacy] = /^(?:n|@)(\d+)$/i.exec(raw) ?? [];
  if (legacy !== undefined) return `a${legacy}`;
  if (/^[a-y]\d+$/.test(raw) && topology.nodes[raw]) return raw;
  return visibleIds(topology).find((id) => topology.nodes[id]?.label === raw);
}

function manualSteps(text: string, panes: readonly Pane[], topology: SceneTopology): TraceStep[] {
  const steps: TraceStep[] = [];
  const resolve = (raw: string): string | undefined => resolveManual(raw, panes, topology);
  for (const { verb, refs } of parseManualText(text)) {
    if (verb === "clear") {
      steps.push([{ t: "clear" }]);
      continue;
    }
    if (verb === "frontier") {
      steps.push([{ t: "frontier", refs: refs.flatMap((raw) => resolve(raw) ?? []) }]);
      continue;
    }
    for (const raw of refs) {
      const ref = resolve(raw);
      if (!ref) continue;
      if (verb === "current") steps.push([{ t: "pointer", name: null, to: ref }]);
      else if (verb === "visit") steps.push([{ t: "visit", ref }]);
      else if (verb === "walk") steps.push([{ t: "pointer", name: null, to: ref }, { t: "visit", ref }]);
      else steps.push([{ t: "front", add: verb === "enqueue", ref }]);
    }
  }
  return steps;
}

function cellValid(ref: string, panes: readonly Pane[]): boolean {
  const [, id, r, c] = /^([a-y])(\d+)\.(\d+)$/.exec(ref) ?? [];
  const pane = panes.find((entry) => entry.id === id);
  const row = pane?.model.kind === "matrix" ? pane.model.matrix?.rows[Number(r)] : undefined;
  return row?.[Number(c)] !== undefined;
}

interface WorkTopology {
  order: string[];
  nodes: Record<string, SceneNode>;
  links: Links;
  deleted: Set<string>;
}

class Player {
  private topology: SceneTopology;
  private layoutKey: string;
  private labels: Record<string, string> = {};
  private current: string | undefined;
  private pointers: Record<string, string> = {};
  private visited: string[] = [];
  private visitedSet = new Set<string>();
  private frontier: string[] = [];
  private dimmed: string[] = [];
  private work: WorkTopology | null = null;
  private owned = { labels: false, pointers: false, visited: false };
  private layoutDirty = false;
  private changed = false;

  constructor(private readonly panes: readonly Pane[], initial: SceneTopology) {
    this.topology = initial;
    this.layoutKey = layoutKeyOf(initial);
  }

  frame(): TraceFrame {
    if (this.layoutDirty) {
      this.layoutKey = layoutKeyOf(this.topology);
      this.layoutDirty = false;
    }
    this.owned = { labels: false, pointers: false, visited: false };
    this.work = null;
    this.changed = false;
    const frame: TraceFrame = {
      topology: this.topology,
      layoutKey: this.layoutKey,
      labels: this.labels,
      pointers: this.pointers,
      visited: this.visited,
      frontier: this.frontier,
      dimmed: this.dimmed,
    };
    if (this.current !== undefined) frame.current = this.current;
    return frame;
  }

  get dirty(): boolean {
    return this.changed;
  }

  private known(ref: string): boolean {
    return this.topology.nodes[ref] !== undefined || (ref.includes(".") && cellValid(ref, this.panes));
  }

  private isNode(ref: string): boolean {
    return this.topology.nodes[ref] !== undefined;
  }

  private mutable(): WorkTopology {
    this.layoutDirty = true;
    this.changed = true;
    if (this.work) return this.work;
    const work: WorkTopology = {
      order: [...this.topology.order],
      nodes: { ...this.topology.nodes },
      links: { ...this.topology.links },
      deleted: new Set(this.topology.deleted),
    };
    this.work = work;
    this.topology = work;
    return work;
  }

  private revive(ref: string): void {
    if (this.topology.deleted.has(ref)) this.mutable().deleted.delete(ref);
  }

  private setCurrent(ref: string | undefined): void {
    if (this.current === ref) return;
    this.current = ref;
    this.changed = true;
  }

  private addVisit(ref: string): void {
    if (this.visitedSet.has(ref)) return;
    if (!this.owned.visited) {
      this.visited = [...this.visited];
      this.owned.visited = true;
    }
    this.visited.push(ref);
    this.visitedSet.add(ref);
    this.changed = true;
  }

  private editFrontier(edit: (list: string[]) => string[]): void {
    const next = edit(this.frontier);
    if (next.length === this.frontier.length && next.every((id, i) => id === this.frontier[i])) return;
    this.frontier = next;
    this.changed = true;
  }

  private editPointers(name: string, to: string | null): void {
    if (to === null ? !(name in this.pointers) : this.pointers[name] === to) return;
    if (!this.owned.pointers) {
      this.pointers = { ...this.pointers };
      this.owned.pointers = true;
    }
    if (to === null) delete this.pointers[name];
    else this.pointers[name] = to;
    this.changed = true;
  }

  private setLabel(ref: string, label: string): void {
    const now = this.labels[ref] ?? this.topology.nodes[ref]?.label;
    if (now === label) return;
    if (!this.owned.labels) {
      this.labels = { ...this.labels };
      this.owned.labels = true;
    }
    this.labels[ref] = label;
    this.changed = true;
  }

  apply(op: TraceOp): void {
    switch (op.t) {
      case "visit":
        if (!this.known(op.ref)) return;
        if (this.isNode(op.ref)) this.revive(op.ref);
        this.addVisit(op.ref);
        return;
      case "value":
        if (!this.isNode(op.ref)) return;
        this.revive(op.ref);
        this.setLabel(op.ref, op.label);
        return;
      case "link":
        this.link(op.ref, op.side, op.to);
        return;
      case "alloc": {
        if (this.topology.nodes[op.ref]) return;
        const topology = this.mutable();
        topology.order.push(op.ref);
        topology.nodes[op.ref] = { id: op.ref, kind: op.kind, label: op.label, root: false };
        topology.links[op.ref] = {};
        return;
      }
      case "pointer":
        if (op.to !== null && !this.known(op.to)) return;
        if (op.to !== null && this.isNode(op.to)) this.revive(op.to);
        if (op.name === null) {
          if (op.to !== null) this.setCurrent(op.to);
          return;
        }
        this.editPointers(op.name, op.to);
        if (op.to !== null) this.setCurrent(op.to);
        return;
      case "front":
        if (!this.isNode(op.ref)) return;
        this.editFrontier((list) => {
          if (op.add) return list.includes(op.ref) ? list : [...list, op.ref];
          return list.filter((id) => id !== op.ref);
        });
        return;
      case "frontier":
        this.editFrontier(() => [...new Set(op.refs.filter((ref) => this.known(ref)))]);
        return;
      case "del":
        if (!this.isNode(op.ref) || this.topology.deleted.has(op.ref)) return;
        this.mutable().deleted.add(op.ref);
        return;
      case "result":
        this.result(op.ref);
        return;
      case "clear":
        this.setCurrent(undefined);
        if (this.visited.length > 0) {
          this.visited = [];
          this.visitedSet = new Set();
          this.changed = true;
        }
        this.editFrontier(() => []);
        for (const name of Object.keys(this.pointers)) this.editPointers(name, null);
        return;
    }
  }

  private link(ref: string, side: "<" | ">", to: Ref): void {
    const node = this.topology.nodes[ref];
    if (!node) return;
    if (to !== null && !this.isNode(to)) return;
    const field = node.kind === "list" ? (side === ">" ? "next" : undefined) : side === "<" ? "left" : "right";
    if (!field) return;
    this.revive(ref);
    if (to !== null) this.revive(to);
    const current = this.topology.links[ref]?.[field];
    if ((current ?? null) === to) return;
    const topology = this.mutable();
    const entry = { ...(topology.links[ref] ?? {}) };
    if (to === null) delete entry[field];
    else entry[field] = to;
    topology.links[ref] = entry;
  }

  private result(ref: Ref): void {
    const topology = this.topology;
    const visible = visibleIds(topology);
    const reached = new Set<string>();
    if (ref !== null && topology.nodes[ref] && !topology.deleted.has(ref)) {
      const stack = [ref];
      for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
        if (reached.has(id) || topology.deleted.has(id)) continue;
        const node = topology.nodes[id];
        if (!node) continue;
        reached.add(id);
        stack.push(...childrenOf(node.kind, topology.links[id]));
      }
      this.setCurrent(ref);
    }
    const dimmed = visible.filter((id) => !reached.has(id));
    if (dimmed.length !== this.dimmed.length || dimmed.some((id, i) => id !== this.dimmed[i])) {
      this.dimmed = dimmed;
      this.changed = true;
    }
  }
}

export function buildTrace(text: string, panes: readonly Pane[]): Trace {
  if (!text || text.length > MAX_TRACE_TEXT) return EMPTY_TRACE;
  const initial = initialTopology(panes);
  const auto = traceLines(text)[0];
  const steps = auto !== undefined ? parseAutoLine(auto) : manualSteps(text, panes, initial);
  if (steps.length === 0) return EMPTY_TRACE;

  const player = new Player(panes, initial);
  const frames: TraceFrame[] = [player.frame()];
  let truncated = false;
  for (const step of steps) {
    if (step === "~") {
      truncated = true;
      break;
    }
    for (const op of step) player.apply(op);
    if (!player.dirty) continue;
    if (frames.length >= MAX_TRACE_FRAMES) {
      truncated = true;
      break;
    }
    frames.push(player.frame());
  }
  if (frames.length === 1 && !truncated) return EMPTY_TRACE;
  return { frames, truncated };
}
