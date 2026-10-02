import type { Snapshot, SnapshotParam } from "../src/shared/protocol.js";

export interface Sample {
  label: string;
  build: () => Snapshot;
}

function snapshot(slug: string, cases: string[], params: SnapshotParam[], extra: Partial<Snapshot> = {}): Snapshot {
  return { cases, code: "", lang: "python3", slug, source: "editor", at: Date.now(), params, ...extra };
}

const TREE = "[4,2,7,1,3,6,9]";
const LARGE_TREE = "[16,8,24,4,12,20,28,2,6,10,14,18,22,26,30,1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31]";
const TRACE = ["n0", "n1", "n3", "n4", "n2", "n5"].map((ref) => `#graphy walk ${ref}`).join("\n");

const root: SnapshotParam[] = [{ name: "root", type: "TreeNode" }];

export const SAMPLES = {
  tree: {
    label: "Tree",
    build: () => snapshot("invert-binary-tree", [TREE], root),
  },
  largeTree: {
    label: "Tree 31",
    build: () => snapshot("balanced-binary-search-tree", [LARGE_TREE], root),
  },
  list: {
    label: "List",
    build: () => snapshot("reverse-linked-list", ["[1,2,3,4,5,6]"], [{ name: "head", type: "ListNode" }]),
  },
  grid: {
    label: "Grid",
    build: () =>
      snapshot(
        "number-of-islands",
        ['[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]'],
        [{ name: "grid", type: "List[List[str]]" }],
      ),
  },
  graph: {
    label: "Edges",
    build: () =>
      snapshot(
        "course-schedule",
        ["4\n[[1,0],[2,0],[3,1],[3,2]]"],
        [
          { name: "numCourses", type: "int" },
          { name: "prerequisites", type: "List[List[int]]" },
        ],
      ),
  },
  cases: {
    label: "Cases",
    build: () =>
      snapshot("maximum-depth-of-binary-tree", [TREE, "[2,1,3]", "[3,9,20,null,null,15,7]", "[1,null,2,null,3]"], root),
  },
  trace: {
    label: "Trace",
    build: () => snapshot("binary-tree-preorder-traversal", [TREE, "[2,1,3]"], root, { stdoutByCase: [TRACE, ""] }),
  },
} satisfies Record<string, Sample>;

export type SampleName = keyof typeof SAMPLES;

export function isSampleName(name: string): name is SampleName {
  return Object.prototype.hasOwnProperty.call(SAMPLES, name);
}
