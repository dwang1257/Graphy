import type { StructureKind } from "./types.js";
import type { SigParam } from "./signature.js";
import { isArray, isNestedArray, type LCValue } from "./parse/value.js";

export type Role =
  | { kind: StructureKind }
  | { kind: "node-count" }
  | { kind: "cycle-pos" }
  | { kind: "ignore" };

const TYPE_RULES: Array<[RegExp, StructureKind]> = [
  [/\bTreeNode\b/, "binary-tree"],
  [/\bListNode\b/, "linked-list"],
];

const NAME_RULES: Array<[Set<string>, Role]> = [
  [set("root root1 root2 subRoot p q original cloned target"), { kind: "binary-tree" }],
  [set("head headA headB l1 l2 l3 list1 list2 list3 list"), { kind: "linked-list" }],
  [set("grid board matrix mat image maze forest heights land dungeon obstacleGrid isWater box picture isConnected"), { kind: "matrix" }],
  [set("n numCourses numNodes numVertices size"), { kind: "node-count" }],
  [set("pos"), { kind: "cycle-pos" }],
];

function set(words: string): Set<string> {
  return new Set(words.split(" "));
}

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

function fromShape(value: LCValue): Role {
  if (!isArray(value)) return { kind: "ignore" };

  if (isNestedArray(value)) {
    if (new Set(value.map((row) => row.length)).size === 1) return { kind: "matrix" };
    return { kind: "ignore" };
  }

  if (value.some((v) => v === null)) return { kind: "binary-tree" };
  if (value.length > 1 && value.every((v) => typeof v === "string")) {
    const width = (value[0] as string).length;
    if (width > 1 && value.every((v) => (v as string).length === width)) return { kind: "matrix" };
  }
  return { kind: "ignore" };
}
