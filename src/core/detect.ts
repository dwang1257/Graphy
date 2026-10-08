import { isStructureKind, type StructureKind } from "./types.js";
import type { SigParam } from "./signature.js";
import { isArray, isNestedArray, isStringGrid, type LCValue } from "./parse/value.js";
import { GRAPH_NAMES, graphForm, isAdjacencyList } from "./parse/graph.js";

export type Role =
  | { kind: StructureKind }
  | { kind: "cycle-pos" }
  | { kind: "ignore" };

const TYPE_RULES: Array<[RegExp, StructureKind]> = [
  [/\bTreeNode\b/, "binary-tree"],
  [/\bListNode\b/, "linked-list"],
  [/\bNode\b/, "graph"],
];

const NAME_RULES: Array<[Set<string>, Role]> = [
  [set("root root1 root2 subRoot p q original cloned target"), { kind: "binary-tree" }],
  [set("head headA headB l1 l2 l3 list1 list2 list3 list"), { kind: "linked-list" }],
  [set("grid board matrix mat image maze forest heights land dungeon obstacleGrid isWater box picture"), { kind: "matrix" }],
  [new Set<string>(GRAPH_NAMES), { kind: "graph" }],
  [set("pos"), { kind: "cycle-pos" }],
];

const IGNORE: Role = { kind: "ignore" };

function set(words: string): Set<string> {
  return new Set(words.split(" "));
}

export function detectRole(param: SigParam | undefined, value: LCValue): Role {
  if (param) {
    for (const [pattern, kind] of TYPE_RULES) {
      if (pattern.test(param.type)) return isArray(value) ? { kind } : IGNORE;
    }
    const scalar = isScalarType(param.type);
    for (const [names, role] of NAME_RULES) {
      if (!names.has(param.name)) continue;
      if (isStructureKind(role.kind) && (scalar || !isArray(value))) return IGNORE;
      if (role.kind === "graph" && isArray(value) && value.length > 0 && !graphForm(value, param)) break;
      return role;
    }
    if (scalar) return IGNORE;
  }
  return fromShape(value);
}

export function structureKindOf(role: Role): StructureKind | undefined {
  return isStructureKind(role.kind) ? role.kind : undefined;
}

const SCALAR_TYPE = /^(int|long|double|float|bool|boolean|char|string|str|number|integer|character|Integer|Long|Double|Boolean|Character|String|i32|i64|f64)$/;

export function isScalarType(type: string): boolean {
  const bare = type.replace(/^Optional\[|\]$/g, "").replace(/[*&\s]/g, "").replace(/\|null$/, "");
  return SCALAR_TYPE.test(bare);
}

function fromShape(value: LCValue): Role {
  if (!isArray(value)) return IGNORE;
  if (isNestedArray(value)) {
    if (new Set(value.map((row) => row.length)).size === 1) return { kind: "matrix" };
    return isAdjacencyList(value) ? { kind: "graph" } : IGNORE;
  }
  if (value.some((v) => v === null)) return { kind: "binary-tree" };
  if (value.length > 1 && isStringGrid(value) && (value[0]?.length ?? 0) > 1) return { kind: "matrix" };
  return IGNORE;
}
