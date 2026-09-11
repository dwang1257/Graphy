import { detectRole, type Role } from "./detect.js";
import { parseBinaryTree } from "./parse/binaryTree.js";
import { MAX_LINKED_LISTS, parseLinkedLists } from "./parse/linkedList.js";
import { parseMatrix } from "./parse/matrix.js";
import { isArray, isNestedArray, parseInput, type LCValue } from "./parse/value.js";
import type { Signature } from "./signature.js";
import type { Pane, ParseResult, StructureKind } from "./types.js";

export interface BuildOptions {
  override?: StructureKind;
  showTerminal?: boolean;
  showIndices?: boolean;
}

interface Entry {
  index: number;
  value: LCValue;
  param?: { name: string };
  role: Role;
}

interface BuildContext {
  cyclePos?: number;
  showTerminal?: boolean;
  showIndices?: boolean;
}

export function buildPanes(
  input: string,
  signature: Signature | null,
  options: BuildOptions = {},
): ParseResult {
  const values = parseInput(input);
  const result: ParseResult = { panes: [], failures: [] };
  if (values.length === 0) return result;

  const entries: Entry[] = values.map((value, i) => {
    const param = signature?.params[i];
    return { index: i, value, param, role: detectRole(param, value) };
  });

  const pos = entries.find((e) => e.role.kind === "cycle-pos");
  const ctx: BuildContext = {
    cyclePos: typeof pos?.value === "number" ? pos.value : undefined,
    showTerminal: options.showTerminal,
    showIndices: options.showIndices,
  };

  const structures = entries.filter((e) => isStructure(e.role.kind));
  const mergeLists =
    options.override === "linked-list"
    || (!options.override && structures.length > 0 && structures.every((e) => e.role.kind === "linked-list"));

  if (mergeLists) {
    const source = options.override === "linked-list" ? entries : structures;
    return withFallback(buildLinkedListPanes(collectListInputs(source), ctx));
  }

  const first = entries.find((e) => isArray(e.value));
  const targets = options.override ? (first ? [first] : []) : structures;

  for (const entry of targets) {
    const kind = options.override ?? (entry.role.kind as StructureKind);
    const title = paramTitle(entry);
    try {
      result.panes.push(...buildFor(kind, entry.value, title, `p${entry.index}`, ctx));
    } catch (error) {
      result.failures.push({ paramName: title, reason: String(error) });
    }
  }

  return withFallback(result);
}

function paramTitle(entry: { index: number; param?: { name: string } }): string {
  return entry.param?.name ?? `arg ${entry.index + 1}`;
}

function collectListInputs(entries: Entry[]): Array<{ value: LCValue; title: string }> {
  const out: Array<{ value: LCValue; title: string }> = [];

  function push(value: LCValue, title: string): void {
    if (out.length < MAX_LINKED_LISTS && isArray(value) && value.length > 0) {
      out.push({ value, title });
    }
  }

  for (const entry of entries) {
    if (out.length >= MAX_LINKED_LISTS) break;
    const title = paramTitle(entry);
    if (isNestedArray(entry.value)) {
      for (let j = 0; j < entry.value.length; j += 1) push(entry.value[j]!, `${title}[${j}]`);
    } else {
      push(entry.value, title);
    }
  }
  return out;
}

function buildLinkedListPanes(
  lists: Array<{ value: LCValue; title: string }>,
  ctx: BuildContext,
): ParseResult {
  const result: ParseResult = { panes: [], failures: [] };
  if (lists.length === 0) return result;
  try {
    result.panes.push({
      id: "p0",
      title: lists.map((list) => list.title).join(" · "),
      model: parseLinkedLists(lists, {
        cyclePos: ctx.cyclePos,
        showTerminal: ctx.showTerminal,
      }),
    });
  } catch (error) {
    result.failures.push({ paramName: lists[0]?.title ?? "list", reason: String(error) });
  }
  return result;
}

function buildFor(
  kind: StructureKind,
  value: LCValue,
  title: string,
  id: string,
  ctx: BuildContext,
): Pane[] {
  switch (kind) {
    case "binary-tree":
      return [{ id, title, model: parseBinaryTree(value, title) }];

    case "linked-list":
      return [{
        id,
        title,
        model: parseLinkedLists(
          isNestedArray(value)
            ? value.map((sub, j) => ({ value: sub, title: `${title}[${j}]` }))
            : [{ value, title }],
          {
            cyclePos: isNestedArray(value) ? undefined : ctx.cyclePos,
            showTerminal: ctx.showTerminal,
          },
        ),
      }];

    case "matrix":
      return [{ id, title, model: parseMatrix(value, title, ctx.showIndices !== false) }];
  }
}

function isStructure(kind: Role["kind"]): kind is StructureKind {
  return kind === "binary-tree" || kind === "linked-list" || kind === "matrix";
}

function withFallback(result: ParseResult): ParseResult {
  if (result.panes.length === 0 && result.failures.length === 0) {
    result.failures.push({
      paramName: "input",
      reason: "No visualizable parameter found for this structure.",
    });
  }
  return result;
}
