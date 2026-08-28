import type { StructureKind } from "./types.js";
import type { SigParam } from "./signature.js";
import { isArray, isNestedArray, type LCValue } from "./parse/value.js";

export type Role =
  | { kind: StructureKind; directed?: boolean }
  | { kind: "node-count" }
  | { kind: "cycle-pos" }
  | { kind: "ignore" };

const TYPE_RULES: Array<[RegExp, StructureKind]> = [
  [/\bTreeNode\b/, "binary-tree"],
  [/\bListNode\b/, "linked-list"],
  [/\bNode\b/, "adjacency"],
];

const NAME_RULES: Array<[Set<string>, Role]> = [
  [set("root root1 root2 subRoot p q original cloned target"), { kind: "binary-tree" }],
  [set("head headA headB l1 l2 list1 list2 list"), { kind: "linked-list" }],
  [set("grid board matrix mat image maze forest heights land dungeon obstacleGrid isWater box picture isConnected"), { kind: "matrix" }],
  [set("adjList adj neighbors graph rooms"), { kind: "adjacency" }],
  [set("prerequisites trust times flights relations dependencies edges1 requirements"), { kind: "graph", directed: true }],
  [set("edges connections roads paths pairs dislikes edgeList links"), { kind: "graph", directed: false }],
  [set("n numCourses numNodes numVertices size"), { kind: "node-count" }],
  [set("pos"), { kind: "cycle-pos" }],
];

function set(words: string): Set<string> {
  return new Set(words.split(" "));
}

/** Classifies one parameter using its declared type, then its name, then its data. */
export function detectRole(param: SigParam | undefined, value: LCValue): Role {
  if (param) {
    for (const [pattern, kind] of TYPE_RULES) {
      if (pattern.test(param.type)) return { kind };
    }
    for (const [names, role] of NAME_RULES) {
      if (names.has(param.name)) return role;
    }
    if (isScalarType(param.type)) return { kind: "ignore" };
  }
  return fromShape(value);
}

const SCALAR_TYPE = /^(int|long|double|float|bool|boolean|char|string|str|number|Integer|Long|Double|Boolean|Character|String|i32|i64|f64)$/;

function isScalarType(type: string): boolean {
  const bare = type.replace(/^Optional\[|\]$/g, "").replace(/[*&\s]/g, "").replace(/\|null$/, "");
  return SCALAR_TYPE.test(bare);
}

/** Last-resort classification from the literal alone. */
function fromShape(value: LCValue): Role {
  if (!isArray(value)) return { kind: "ignore" };

  if (isNestedArray(value)) {
    const widths = new Set(value.map((row) => row.length));
    const allPairs = [...widths].every((w) => w === 2 || w === 3);
    if (isSquareBinaryGrid(value)) return { kind: "matrix" };

    // A row that starts with its own index is carrying an explicit source,
    // which is stronger edge-list evidence than merely having in-range ids.
    const hasExplicitSources = allPairs
      && value.every((row, index) => row[0] === index);
    if (!hasExplicitSources && isLikelyAdjacency(value)) {
      return { kind: "adjacency" };
    }
    if (allPairs) return { kind: "graph", directed: false };
    if (widths.size === 1 && !allPairs) return { kind: "matrix" };
    return { kind: "adjacency" };
  }

  if (value.some((v) => v === null)) return { kind: "binary-tree" };
  // Equal-length strings are a character grid ("11110", "10001").
  if (value.length > 1 && value.every((v) => typeof v === "string")) {
    const lengths = new Set(value.map((v) => (v as string).length));
    if (lengths.size === 1 && (value[0] as string).length > 1) return { kind: "matrix" };
  }
  return { kind: "ignore" };
}

function isSquareBinaryGrid(rows: LCValue[][]): boolean {
  return rows.length > 0
    && rows.every((row) => row.length === rows.length
      && row.every((value) => value === 0 || value === 1));
}

function isLikelyAdjacency(rows: LCValue[][]): boolean {
  let indexCount = 0;
  let inRangeCount = 0;
  for (const row of rows) {
    for (const value of row) {
      if (!Number.isInteger(value) || (value as number) < 0) return false;
      indexCount++;
      if ((value as number) < rows.length) inRangeCount++;
    }
  }
  return indexCount > 0 && inRangeCount / indexCount >= 0.75;
}
