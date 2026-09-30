import { detectRole, structureKindOf, type Role } from "./detect.js";
import { parseBinaryTree } from "./parse/binaryTree.js";
import { parseLinkedLists } from "./parse/linkedList.js";
import { parseMatrix } from "./parse/matrix.js";
import { isArray, isNestedArray, parseInputResult, type LCValue } from "./parse/value.js";
import { NODE_LIMIT } from "../settings/schema.js";
import type { Signature } from "./signature.js";
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

  values.forEach((value, i) => {
    const id = paneId(i);
    const title = signature?.params[i]?.name ?? `arg ${i + 1}`;
    const choice = options.kinds?.[i];
    if (!id || choice === "none") return;
    const override = options.override && isArray(value) && (options.override === "matrix" || !isNestedArray(value))
      ? options.override
      : undefined;
    const kind = choice ?? override ?? result.detected[i];
    if (!kind) return;
    if (!fits(kind, value)) {
      result.failures.push({ paramName: title, reason: `${title} is not a valid ${KIND_LABELS[kind].toLowerCase()}.` });
      return;
    }
    try {
      assertNodeLimit(kind, value);
      const pos = kind === "linked-list" && !isNestedArray(value) ? cyclePos : undefined;
      result.panes.push({ id, title, model: modelFor(kind, value, title, id, pos, options.showIndices !== false) });
      if (pos !== undefined) cyclePos = undefined;
    } catch (error) {
      result.failures.push({ paramName: title, reason: error instanceof Error ? error.message : String(error) });
    }
  });

  return withFallback(result);
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

function fits(kind: StructureKind, value: LCValue): boolean {
  if (value === null) return true;
  return isArray(value) && (kind !== "binary-tree" || !isNestedArray(value));
}

function modelFor(
  kind: StructureKind,
  value: LCValue,
  title: string,
  id: string,
  cyclePos: number | undefined,
  showIndices: boolean,
): GraphModel {
  switch (kind) {
    case "binary-tree":
      return parseBinaryTree(value, title, id);
    case "linked-list":
      return parseLinkedLists(isNestedArray(value) ? value : [value], { cyclePos, title }, id);
    case "matrix":
      return parseMatrix(value, title, showIndices);
  }
}

function assertNodeLimit(kind: StructureKind, value: LCValue): void {
  if (nodeCount(kind, value) > NODE_LIMIT) {
    throw new Error(`Input exceeds the ${NODE_LIMIT}-node limit.`);
  }
}

function nodeCount(kind: StructureKind, value: LCValue): number {
  if (!isArray(value)) return 0;
  switch (kind) {
    case "binary-tree":
      return value.filter((entry) => entry !== null).length;
    case "linked-list":
      return isNestedArray(value) ? value.reduce((total, list) => total + list.length, 0) : value.length;
    case "matrix":
      return matrixItemCount(value);
  }
}

function matrixItemCount(value: LCValue[]): number {
  if (isNestedArray(value)) return value.reduce((total, row) => total + row.length, 0);
  const first = value[0];
  if (typeof first === "string" && first.length > 0 && value.every((entry) => typeof entry === "string" && entry.length === first.length)) {
    return value.length * first.length;
  }
  return value.length;
}

function withFallback(result: ParseResult): ParseResult {
  if (result.panes.length === 0 && result.failures.length === 0) {
    result.failures.push({
      paramName: "input",
      reason: "Choose a data structure from the dropdown.",
    });
  }
  return result;
}
