import { detectRole, structureKindOf, type Role } from "./detect.js";
import { parseBinaryTree } from "./parse/binaryTree.js";
import { parseLinkedLists } from "./parse/linkedList.js";
import { parseMatrix } from "./parse/matrix.js";
import { COUNT_NAMES, graphForm, graphNodeCount, parseGraph, type GraphOptions } from "./parse/graph.js";
import { isArray, isNestedArray, isStringGrid, parseInputResult, type LCValue } from "./parse/value.js";
import { NODE_LIMIT } from "../settings/schema.js";
import type { SigParam, Signature } from "./signature.js";
import { KIND_LABELS, paneId, type GraphModel, type KindChoice, type ParseResult, type StructureKind } from "./types.js";

export interface BuildOptions {
  override?: StructureKind;
  kinds?: ReadonlyArray<KindChoice | undefined>;
  showIndices?: boolean;
}

export function buildPanes(
  input: string,
  signature: Signature | null,
  options: BuildOptions = {},
): ParseResult {
  const parsed = parseInputResult(input);
  const result: ParseResult = { panes: [], failures: [], detected: [] };
  if (parsed.error) {
    result.failures.push({ paramName: "input", reason: parsed.error });
    return result;
  }
  const values = parsed.values;
  if (values.length === 0) return result;

  const roles = values.map((value, i) => roleAt(values, i, signature));
  result.detected = roles.map(structureKindOf);
  const cycleValue = values.find((_, i) => roles[i]?.kind === "cycle-pos");
  let cyclePos = typeof cycleValue === "number" ? cycleValue : undefined;
  const count = countOf(values, signature);

  values.forEach((value, i) => {
    const id = paneId(i);
    const title = signature?.params[i]?.name ?? `arg ${i + 1}`;
    const choice = options.kinds?.[i];
    if (!id || choice === "none") return;
    const override = options.override && isArray(value) && (options.override === "matrix" || options.override === "graph" || !isNestedArray(value))
      ? options.override
      : undefined;
    const kind = choice ?? override ?? result.detected[i];
    if (!kind) return;
    const graph = graphOptions(signature?.params[i], title, count);
    if (!fits(kind, value, graph)) {
      result.failures.push({ paramName: title, reason: `${title} is not a valid ${KIND_LABELS[kind].toLowerCase()}.` });
      return;
    }
    if (nodeCount(kind, value, graph) > NODE_LIMIT) {
      result.failures.push({ paramName: title, reason: `Input exceeds the ${NODE_LIMIT}-node limit.` });
      return;
    }
    try {
      const pos = kind === "linked-list" && !isNestedArray(value) ? cyclePos : undefined;
      result.panes.push({ id, title, model: modelFor(kind, value, title, id, pos, options.showIndices !== false, graph) });
      if (pos !== undefined) cyclePos = undefined;
    } catch (error) {
      result.failures.push({ paramName: title, reason: error instanceof Error ? error.message : String(error) });
    }
  });

  if (result.panes.length === 0 && result.failures.length === 0) {
    result.failures.push({ paramName: "input", reason: "Choose a data structure from the dropdown." });
  }
  return result;
}

export function detectKinds(values: readonly string[], signature: Signature | null): Array<StructureKind | undefined> {
  return values.map((raw, i) => {
    const parsed = parseInputResult(raw);
    const value = !parsed.error && parsed.values.length === 1 ? parsed.values[0] ?? null : null;
    return structureKindOf(detectRole(signature?.params[i], value));
  });
}

function roleAt(values: readonly LCValue[], i: number, signature: Signature | null): Role {
  const param = signature?.params[i];
  const value = values[i] ?? null;
  const previous = values[i - 1];
  if (
    !param
    && i === values.length - 1
    && Number.isInteger(value)
    && previous !== undefined
    && detectRole(signature?.params[i - 1], previous).kind === "linked-list"
  ) return { kind: "cycle-pos" };
  return detectRole(param, value);
}

function countOf(values: readonly LCValue[], signature: Signature | null): number | undefined {
  const index = signature?.params.findIndex((param) => (COUNT_NAMES as readonly string[]).includes(param.name)) ?? -1;
  const value = values[index];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function graphOptions(param: SigParam | undefined, title: string, count: number | undefined): GraphOptions {
  return { title, name: param?.name, type: param?.type, count };
}

function fits(kind: StructureKind, value: LCValue, graph: GraphOptions): boolean {
  if (value === null) return true;
  if (kind === "graph") return graphForm(value, graph) !== undefined;
  return isArray(value) && (kind !== "binary-tree" || !isNestedArray(value));
}

function modelFor(
  kind: StructureKind,
  value: LCValue,
  title: string,
  id: string,
  cyclePos: number | undefined,
  showIndices: boolean,
  graph: GraphOptions,
): GraphModel {
  switch (kind) {
    case "binary-tree":
      return parseBinaryTree(value, title, id);
    case "linked-list":
      return parseLinkedLists(isNestedArray(value) ? value : [value], { cyclePos, title }, id);
    case "matrix":
      return parseMatrix(value, title, showIndices);
    case "graph":
      return parseGraph(value, id, graph);
  }
}

function nodeCount(kind: StructureKind, value: LCValue, graph: GraphOptions): number {
  if (!isArray(value)) return 0;
  if (kind === "graph") return graphNodeCount(value, graph);
  if (kind === "binary-tree") return value.filter((entry) => entry !== null).length;
  if (isNestedArray(value)) return value.reduce((total, row) => total + row.length, 0);
  if (kind === "matrix" && isStringGrid(value)) return value.length * (value[0]?.length ?? 0);
  return value.length;
}
