import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { buildTrace, type Trace } from "../core/trace.js";
import { TRACE_SENTINEL } from "../core/traceWire.js";
import { parseGraph, type GraphOptions } from "../core/parse/graph.js";
import { parseMatrix } from "../core/parse/matrix.js";
import type { GNode, GraphModel, Links, Pane } from "../core/types.js";
import { GRAPHY_TRACE_MARK, instrumentPython, instrumentRunBody } from "./instrument.js";

function hasPython(): boolean {
  try {
    const out = execFileSync("python3", ["-c", "import sys; print(sys.version_info >= (3, 11))"], { encoding: "utf8" });
    return out.trim() === "True";
  } catch {
    return false;
  }
}

const PYTHON = hasPython();
const dir = mkdtempSync(join(tmpdir(), "graphy-trace-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const PRELUDE = `import io, json, sys, time
from collections import deque
from typing import List, Optional

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def mk_tree(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    q = deque([root])
    i = 1
    while q and i < len(arr):
        n = q.popleft()
        if i < len(arr) and arr[i] is not None:
            n.left = TreeNode(arr[i])
            q.append(n.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            n.right = TreeNode(arr[i])
            q.append(n.right)
        i += 1
    return root

class Node:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []

def mk_graph(adj):
    if not adj:
        return None
    nodes = [Node(i + 1) for i in range(len(adj))]
    for i, nb in enumerate(adj):
        nodes[i].neighbors = [nodes[j - 1] for j in nb]
    return nodes[0]

def mk_list(arr):
    d = ListNode()
    c = d
    for v in arr:
        c.next = ListNode(v)
        c = c.next
    return d.next

def ser(v):
    if isinstance(v, TreeNode):
        out, q = [], deque([v])
        while q:
            n = q.popleft()
            if n is None:
                out.append(None)
                continue
            out.append(n.val)
            q.append(n.left)
            q.append(n.right)
        while out and out[-1] is None:
            out.pop()
        return out
    if isinstance(v, Node):
        return v.val
    if isinstance(v, ListNode):
        out = []
        while v is not None and len(out) < 10000:
            out.append(v.val)
            v = v.next
        return out
    return v

def clean():
    return all(k not in c.__dict__ for c in (TreeNode, ListNode) for k in ("val", "__setattr__", "__getattribute__"))
`;

interface CaseResult {
  stdout: string;
  ret: unknown;
  err: string | null;
  clean: boolean;
  seconds: number;
}

type Conv = "tree" | "list" | "graph" | "raw";

function runCases(code: string, method: string, cases: unknown[][], conv: Conv[], instrument = true): CaseResult[] {
  const driver = `
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
conv = ${JSON.stringify(conv)}
real = sys.stdout
for c in cases:
    args = [mk_tree(v) if k == "tree" else mk_list(v) if k == "list" else mk_graph(v) if k == "graph" else v for v, k in zip(c, conv)]
    buf = io.StringIO()
    sys.stdout = buf
    err = None
    ret = None
    start = time.perf_counter()
    try:
        ret = getattr(Solution(), ${JSON.stringify(method)})(*args)
    except Exception as e:
        err = type(e).__name__
    seconds = time.perf_counter() - start
    sys.stdout = real
    print(json.dumps({"stdout": buf.getvalue(), "ret": ser(ret), "err": err, "clean": clean(), "seconds": seconds}))
`;
  const file = join(dir, `case-${Math.random().toString(36).slice(2)}.py`);
  writeFileSync(file, `${PRELUDE}\n${instrument ? instrumentPython(code) : code}\n${driver}`);
  const result = spawnSync("python3", [file], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim().split("\n").map((line) => JSON.parse(line) as CaseResult);
}

function treePane(values: Array<number | null>, id = "a", title = "root"): Pane {
  const nodes: GNode[] = [];
  const links: Links = {};
  const model: GraphModel = { kind: "binary-tree", directed: true, title, nodes, edges: [], ranks: [], links };
  if (values.length === 0 || values[0] === null || values[0] === undefined) return { id, title, model };
  nodes.push({ id: `${id}0`, label: String(values[0]), role: "root" });
  links[`${id}0`] = {};
  const queue = [`${id}0`];
  let cursor = 1;
  while (queue.length > 0 && cursor < values.length) {
    const parent = queue.shift()!;
    for (const side of ["left", "right"] as const) {
      if (cursor >= values.length) break;
      const raw = values[cursor];
      const child = `${id}${cursor}`;
      cursor += 1;
      if (raw === null || raw === undefined) continue;
      nodes.push({ id: child, label: String(raw), role: "normal" });
      links[child] = {};
      links[parent]![side] = child;
      queue.push(child);
    }
  }
  return { id, title, model };
}

function listPane(values: number[], id = "a", title = "head"): Pane {
  const ids = values.map((_, i) => `${id}${i}`);
  const links: Links = {};
  ids.forEach((node, i) => {
    links[node] = ids[i + 1] ? { next: ids[i + 1] } : {};
  });
  return {
    id,
    title,
    model: {
      kind: "linked-list",
      directed: true,
      title,
      nodes: values.map((v, i) => ({ id: ids[i]!, label: String(v), role: i === 0 ? "root" : "normal" })),
      edges: [],
      ranks: [],
      links,
      listGroups: ids.length > 0 ? [ids] : [],
    },
  };
}

function traceLines(stdout: string): string[] {
  return stdout.split("\n").filter((line) => line.startsWith(TRACE_SENTINEL));
}

function labelsOf(trace: Trace, ids: readonly string[]): string[] {
  const last = trace.frames.at(-1)!;
  return ids.map((id) => last.labels[id] ?? last.topology.nodes[id]?.label ?? id);
}

const T = [1, 2, 3, 4, 5, null, 6];

const order = (body: string) => `class Solution:
    def order(self, root: Optional[TreeNode]) -> List[int]:
        res = []
        def dfs(node):
            if not node:
                return
${body}
        dfs(root)
        return res
`;

const PRE = order("            res.append(node.val)\n            dfs(node.left)\n            dfs(node.right)");
const IN = order("            dfs(node.left)\n            res.append(node.val)\n            dfs(node.right)");
const POST = order("            dfs(node.left)\n            dfs(node.right)\n            res.append(node.val)");

const BST_DELETE = `class Solution:
    def deleteNode(self, root: Optional[TreeNode], key: int) -> Optional[TreeNode]:
        if not root:
            return None
        if key < root.val:
            root.left = self.deleteNode(root.left, key)
        elif key > root.val:
            root.right = self.deleteNode(root.right, key)
        else:
            if not root.left:
                return root.right
            if not root.right:
                return root.left
            cur = root.right
            while cur.left:
                cur = cur.left
            root.val = cur.val
            root.right = self.deleteNode(root.right, root.val)
        return root
`;

const REVERSE = `class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        curr = head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev
`;

const REMOVE_NTH = `class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        fast = slow = dummy
        for _ in range(n + 1):
            fast = fast.next
        while fast:
            fast = fast.next
            slow = slow.next
        slow.next = slow.next.next
        return dummy.next
`;

const MERGE = `class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode()
        tail = dummy
        while list1 and list2:
            if list1.val <= list2.val:
                tail.next = list1
                list1 = list1.next
            else:
                tail.next = list2
                list2 = list2.next
            tail = tail.next
        tail.next = list1 or list2
        return dummy.next
`;

describe("instrumentPython", () => {
  it("appends the tracer once", () => {
    const once = instrumentPython(REVERSE);
    expect(once).toContain(GRAPHY_TRACE_MARK);
    expect(instrumentPython(once)).toBe(once);
  });

  it("embeds the sentinel as an escape so the Python source stays ASCII", () => {
    expect(instrumentPython(REVERSE)).not.toContain(TRACE_SENTINEL);
    expect(instrumentPython(REVERSE)).toContain("\\ue000");
  });
});

describe("instrumentRunBody", () => {
  it("rewrites python3 Run payloads and leaves Python 2 and C++ untouched", () => {
    const result = instrumentRunBody(JSON.stringify({ data_input: "[4,2,7]", typed_code: REVERSE, lang: "python3" }));
    expect(result).toContain(GRAPHY_TRACE_MARK);
    expect(JSON.parse(result ?? "{}")).toMatchObject({ data_input: "[4,2,7]", lang: "python3" });
    expect(instrumentRunBody(JSON.stringify({ typed_code: REVERSE, lang: "python" }))).toBeNull();
    expect(instrumentRunBody(JSON.stringify({ typed_code: "class Solution {};", lang: "cpp" }))).toBeNull();
    expect(instrumentRunBody("null")).toBeNull();
  });
});

describe.skipIf(!PYTHON)("python tracer", () => {
  it.each([
    ["preorder", PRE, ["1", "2", "4", "5", "3", "6"]],
    ["inorder", IN, ["4", "2", "5", "1", "3", "6"]],
    ["postorder", POST, ["4", "5", "2", "6", "3", "1"]],
  ])("records the %s visit order from .val reads", (_name, code, expected) => {
    const [result] = runCases(code, "order", [[T]], ["tree"]);
    expect(result!.clean).toBe(true);
    const trace = buildTrace(result!.stdout, [treePane(T)]);
    expect(labelsOf(trace, trace.frames.at(-1)!.visited)).toEqual(expected);
  });

  it("gives each postorder visit its own frame", () => {
    const [result] = runCases(POST, "order", [[T]], ["tree"]);
    const trace = buildTrace(result!.stdout, [treePane(T)]);
    const counts = trace.frames.map((frame) => frame.visited.length);
    counts.slice(1).forEach((count, i) => expect(count - counts[i]!).toBeLessThanOrEqual(1));
    expect(counts.at(-1)).toBe(6);
  });

  it.each([
    ["search in a BST", `class Solution:
    def searchBST(self, root: Optional[TreeNode], val: int) -> Optional[TreeNode]:
        while root and root.val != val:
            root = root.left if val < root.val else root.right
        return root
`, "searchBST", [[4, 2, 7, 1, 3], 3], ["tree", "raw"] as Conv[], [treePane([4, 2, 7, 1, 3])]],
    ["binary number in a list", `class Solution:
    def getDecimalValue(self, head: Optional[ListNode]) -> int:
        n = 0
        while head:
            n = n * 2 + head.val
            head = head.next
        return n
`, "getDecimalValue", [[1, 0, 1]], ["list"] as Conv[], [listPane([1, 0, 1])]],
  ])("deletes nothing in a read-only %s that moves its parameter", (_name, code, method, args, conv, panes) => {
    const [result] = runCases(code, method, [args], conv);
    const trace = buildTrace(result!.stdout, panes);
    expect(trace.frames.length).toBeGreaterThan(2);
    expect(trace.frames.every((frame) => frame.topology.deleted.size === 0)).toBe(true);
  });

  it("writes one line per call with the call index and nothing for calls it cannot draw", () => {
    const results = runCases(PRE, "order", [[T], [[]], [T]], ["tree"]);
    expect(traceLines(results[0]!.stdout)[0]?.startsWith(`${TRACE_SENTINEL}0 `)).toBe(true);
    expect(results[1]!.stdout).toBe("");
    expect(traceLines(results[2]!.stdout)).toHaveLength(1);
    expect(traceLines(results[2]!.stdout)[0]?.startsWith(`${TRACE_SENTINEL}2 `)).toBe(true);
  });

  it("keeps user prints in place and restores the node classes", () => {
    const code = `class Solution:
    def order(self, root: Optional[TreeNode]) -> int:
        print("before")
        x = root.val
        print("after")
        return x
`;
    const [result] = runCases(code, "order", [[T]], ["tree"]);
    const lines = result!.stdout.trimEnd().split("\n");
    expect(lines.slice(0, 2)).toEqual(["before", "after"]);
    expect(lines[2]?.startsWith(TRACE_SENTINEL)).toBe(true);
    expect(result!.clean).toBe(true);
  });

  it("writes a partial line and re-raises when the solution throws", () => {
    const code = `class Solution:
    def order(self, root: Optional[TreeNode]) -> int:
        node = root.left
        x = node.val
        raise ValueError("boom")
`;
    const [result] = runCases(code, "order", [[T]], ["tree"]);
    expect(result!.err).toBe("ValueError");
    expect(result!.clean).toBe(true);
    expect(traceLines(result!.stdout)).toHaveLength(1);
    expect(traceLines(result!.stdout)[0]).not.toContain("^");
  });

  it("stays silent when there is nothing to draw", () => {
    const code = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
`;
    const [result] = runCases(code, "twoSum", [[[2, 7, 11, 15], 9]], ["raw", "raw"]);
    expect(result!.stdout).toBe("");
  });

  it("skips inputs above the node limit at close to native speed", () => {
    const big = Array.from({ length: 3000 }, (_, i) => i);
    const plain = runCases(PRE, "order", [[big], [big], [big]], ["tree"], false);
    const traced = runCases(PRE, "order", [[big], [big], [big]], ["tree"]);
    expect(traced.every((result) => result.stdout === "")).toBe(true);
    const fastest = (results: CaseResult[]) => Math.min(...results.map((result) => result.seconds));
    expect(fastest(traced)).toBeLessThan(fastest(plain) * 3 + 0.002);
  });

  it("stops recording after the op cap and marks the trace truncated", () => {
    const code = `class Solution:
    def walk(self, head: Optional[ListNode]) -> int:
        n = 0
        for _ in range(10000):
            cur = head
            while cur:
                n += 1
                cur = cur.next
        return n
`;
    const [result] = runCases(code, "walk", [[[1, 2, 3, 4, 5]]], ["list"]);
    expect(result!.ret).toBe(50000);
    expect(result!.clean).toBe(true);
    expect(result!.stdout.trimEnd().endsWith(" ~")).toBe(true);
    expect(buildTrace(result!.stdout, [listPane([1, 2, 3, 4, 5])]).truncated).toBe(true);
  });

  it("gives every allocated node its own id even when Python reuses memory", () => {
    const code = `class Solution:
    def churn(self, head: Optional[ListNode]) -> int:
        total = 0
        for i in range(40):
            tmp = ListNode(i)
            total += tmp.val
            tmp = None
        return total
`;
    const [result] = runCases(code, "churn", [[[1]]], ["list"]);
    const allocs = result!.stdout.match(/\+lz\d+/g) ?? [];
    expect(allocs).toHaveLength(40);
    expect(new Set(allocs).size).toBe(40);
  });

  it("shows a BST two-child delete as one relabel and a deleted successor", () => {
    const input = [5, 3, 6, 2, 4, null, 7];
    const [result] = runCases(BST_DELETE, "deleteNode", [[input, 3]], ["tree", "raw"]);
    expect(result!.ret).toEqual([5, 4, 6, 2, null, null, 7]);
    const trace = buildTrace(result!.stdout, [treePane(input)]);
    const relabel = trace.frames.findIndex((frame) => frame.labels.a1 === "4");
    expect(relabel).toBeGreaterThan(0);
    expect(trace.frames[relabel - 1]!.labels.a1).toBeUndefined();
    const last = trace.frames.at(-1)!;
    expect([...last.topology.deleted]).toEqual(["a4"]);
    expect(last.topology.links.a1).toEqual({ left: "a3" });
    expect(last.current).toBe("a0");
    expect(last.dimmed).toEqual([]);
  });

  it("dims everything when the whole tree is deleted", () => {
    const [result] = runCases(BST_DELETE, "deleteNode", [[[5], 5]], ["tree", "raw"]);
    const trace = buildTrace(result!.stdout, [treePane([5])]);
    expect(trace.frames.at(-1)!.dimmed).toEqual(["a0"]);
  });

  it("reverses a list without deleting anything and ends on the new head", () => {
    const [result] = runCases(REVERSE, "reverseList", [[[1, 2, 3, 4, 5]]], ["list"]);
    const trace = buildTrace(result!.stdout, [listPane([1, 2, 3, 4, 5])]);
    const last = trace.frames.at(-1)!;
    expect(last.topology.deleted.size).toBe(0);
    expect(last.current).toBe("a4");
    expect(last.topology.links.a4).toEqual({ next: "a3" });
    expect(last.topology.links.a0).toEqual({});
    const names = new Set(trace.frames.flatMap((frame) => Object.keys(frame.pointers)));
    expect(names).toEqual(new Set(["head", "curr", "nxt", "prev"]));
    expect(Buffer.byteLength(result!.stdout)).toBeLessThan(200);
  });

  it("deletes the removed node and dims the dummy", () => {
    const [result] = runCases(REMOVE_NTH, "removeNthFromEnd", [[[1, 2, 3, 4, 5], 2]], ["list", "raw"]);
    const trace = buildTrace(result!.stdout, [listPane([1, 2, 3, 4, 5])]);
    const last = trace.frames.at(-1)!;
    expect([...last.topology.deleted]).toEqual(["a3"]);
    expect(last.topology.links.a2).toEqual({ next: "a4" });
    expect(last.dimmed).toEqual(["z0"]);
  });

  it("merges two input lists into one chain behind the dummy", () => {
    const [result] = runCases(MERGE, "mergeTwoLists", [[[1, 2, 4], [1, 3, 4]]], ["list", "list"]);
    const trace = buildTrace(result!.stdout, [listPane([1, 2, 4], "a", "list1"), listPane([1, 3, 4], "b", "list2")]);
    const last = trace.frames.at(-1)!;
    const chain: string[] = [];
    for (let id: string | undefined = "z0"; id; id = last.topology.links[id]?.next) chain.push(id);
    expect(chain).toEqual(["z0", "a0", "b0", "a1", "b1", "a2", "b2"]);
    expect(last.dimmed).toEqual(["z0"]);
  });

  it("swaps two labels in a single frame", () => {
    const code = `class Solution:
    def swap(self, head: Optional[ListNode]) -> Optional[ListNode]:
        a, b = head, head.next.next
        a.val, b.val = b.val, a.val
        return head
`;
    const [result] = runCases(code, "swap", [[[1, 2, 3]]], ["list"]);
    const trace = buildTrace(result!.stdout, [listPane([1, 2, 3])]);
    const swapped = trace.frames.findIndex((frame) => frame.labels.a0 === "3");
    expect(trace.frames[swapped]!.labels.a2).toBe("1");
    expect(trace.frames[swapped - 1]!.labels.a2).toBeUndefined();
  });

  it("allocates nodes created by the solution and links them in", () => {
    const code = `class Solution:
    def insertIntoBST(self, root: Optional[TreeNode], val: int) -> Optional[TreeNode]:
        node = TreeNode(val)
        cur = root
        while True:
            if val < cur.val:
                if not cur.left:
                    cur.left = node
                    return root
                cur = cur.left
            else:
                if not cur.right:
                    cur.right = node
                    return root
                cur = cur.right
`;
    const input = [4, 2, 7, 1, 3];
    const [result] = runCases(code, "insertIntoBST", [[input, 5]], ["tree", "raw"]);
    const trace = buildTrace(result!.stdout, [treePane(input)]);
    const floating = trace.frames.findIndex((frame) => frame.topology.nodes.z0 !== undefined);
    expect(trace.frames[floating]!.topology.nodes.z0?.label).toBe("5");
    expect(trace.frames[floating]!.topology.links.a2).toEqual({});
    expect(trace.frames.at(-1)!.topology.links.a2).toEqual({ left: "z0" });
  });
});

function gridPane(values: unknown[][]): Pane {
  return { id: "a", title: "grid", model: parseMatrix(values as never, "grid") };
}

function gridTrace(code: string, method: string, args: unknown[]): { trace: Trace; ret: unknown } {
  const [result] = runCases(code, method, [args], args.map(() => "raw"));
  expect(result!.err).toBeNull();
  return { trace: buildTrace(result!.stdout, [gridPane(args[0] as unknown[][])]), ret: result!.ret };
}

function cellsOf(rows: unknown[][], trace: Trace): string[][] {
  const last = trace.frames.at(-1)!;
  return rows.map((row, r) => row.map((value, c) => last.labels[`a${r}.${c}`] ?? String(value)));
}

function moves(trace: Trace, name: string): string[] {
  const out: string[] = [];
  for (const frame of trace.frames) {
    const at = frame.pointers[name];
    if (at !== undefined && out.at(-1) !== at) out.push(at);
  }
  return out;
}

const ORANGES = `class Solution:
    def orangesRotting(self, grid: List[List[int]]) -> int:
        rows, cols = len(grid), len(grid[0])
        q = deque()
        fresh = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 2:
                    q.append((r, c))
                elif grid[r][c] == 1:
                    fresh += 1
        minutes = 0
        while q and fresh:
            for _ in range(len(q)):
                r, c = q.popleft()
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                        grid[nr][nc] = 2
                        fresh -= 1
                        q.append((nr, nc))
            minutes += 1
        return -1 if fresh else minutes
`;

const DIAGONAL = `from collections import defaultdict
class Solution:
    def diagonalSort(self, mat: List[List[int]]) -> List[List[int]]:
        m, n = len(mat), len(mat[0])
        d = defaultdict(list)
        for i in range(m):
            for j in range(n):
                d[i - j].append(mat[i][j])
        for k in d:
            d[k].sort(reverse=True)
        for i in range(m):
            for j in range(n):
                mat[i][j] = d[i - j].pop()
        return mat
`;

describe.skipIf(!PYTHON)("python grid tracer", () => {
  it("shows Rotting Oranges cells rotting, the BFS queue and both coordinate pairs", () => {
    const grid = [[2, 1, 1], [1, 1, 0], [0, 1, 1]];
    const { trace, ret } = gridTrace(ORANGES, "orangesRotting", [grid]);
    expect(ret).toBe(4);
    expect(cellsOf(grid, trace)).toEqual([["2", "2", "2"], ["2", "2", "0"], ["0", "2", "2"]]);
    expect(moves(trace, "r,c").slice(0, 9)).toEqual(["a0.0", "a0.1", "a0.2", "a1.0", "a1.1", "a1.2", "a2.0", "a2.1", "a2.2"]);
    expect(moves(trace, "nr,nc")).toContain("a1.0");
    const rotted = trace.frames.findIndex((frame) => frame.labels["a1.0"] === "2");
    expect(trace.frames[rotted]).toMatchObject({ current: "a1.0", pointers: { "r,c": "a0.0", "nr,nc": "a1.0" } });
    expect(trace.frames[rotted]!.visited).toContain("a1.0");
    expect(trace.frames.some((frame) => frame.frontier.length >= 2)).toBe(true);
    expect(trace.frames.at(-1)!.frontier).toEqual([]);
  });

  it("writes Sort the Matrix Diagonally values back into the grid in order", () => {
    const mat = [[3, 3, 1, 1], [2, 2, 1, 2], [1, 1, 1, 2]];
    const sorted = [[1, 1, 1, 1], [1, 2, 2, 2], [1, 2, 3, 3]];
    const { trace, ret } = gridTrace(DIAGONAL, "diagonalSort", [mat]);
    expect(ret).toEqual(sorted);
    expect(cellsOf(mat, trace)).toEqual(sorted.map((row) => row.map(String)));
    const first = trace.frames.findIndex((frame) => frame.labels["a0.0"] === "1");
    expect(trace.frames[first - 1]!.current).toBe("a0.0");
  });

  it("follows the pair each line indexes with", () => {
    const code = `class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        res = []
        top, bottom, left, right = 0, len(matrix) - 1, 0, len(matrix[0]) - 1
        while top <= bottom and left <= right:
            for j in range(left, right + 1):
                res.append(matrix[top][j])
            top += 1
            for i in range(top, bottom + 1):
                res.append(matrix[i][right])
            right -= 1
            if top <= bottom:
                for j in range(right, left - 1, -1):
                    res.append(matrix[bottom][j])
                bottom -= 1
            if left <= right:
                for i in range(bottom, top - 1, -1):
                    res.append(matrix[i][left])
                left += 1
        return res
`;
    const { trace } = gridTrace(code, "spiralOrder", [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]]);
    const path = trace.frames.flatMap((frame, i) => (i > 0 && frame.current !== trace.frames[i - 1]!.current ? [frame.current] : []));
    expect(path).toEqual(["a0.0", "a0.1", "a0.2", "a1.2", "a2.2", "a2.1", "a2.0", "a1.0", "a1.1"]);
    expect(Object.keys(trace.frames.at(-1)!.pointers)).toEqual(["top,j"]);
  });

  it("uses the last two tuple fields of heap entries and ignores grid copies", () => {
    const code = `import heapq
class Solution:
    def minimumEffortPath(self, heights: List[List[int]]) -> int:
        R, C = len(heights), len(heights[0])
        best = [row[:] for row in heights]
        h = [(0, 0, 0)]
        seen = set()
        while h:
            d, r, c = heapq.heappop(h)
            if (r, c) in seen:
                continue
            seen.add((r, c))
            if (r, c) == (R - 1, C - 1):
                return d
            for nr, nc in ((r + 1, c), (r, c + 1)):
                if nr < R and nc < C:
                    heapq.heappush(h, (max(d, abs(heights[nr][nc] - heights[r][c])), nr, nc))
        return 0
`;
    const { trace, ret } = gridTrace(code, "minimumEffortPath", [[[1, 2], [3, 8]]]);
    expect(ret).toBe(5);
    const frontier = new Set(trace.frames.flatMap((frame) => frame.frontier));
    expect([...frontier].sort()).toEqual(["a0.0", "a0.1", "a1.0", "a1.1"]);
    expect(trace.frames.at(-1)!.visited).toEqual(expect.arrayContaining(["a0.0", "a1.1"]));
  });

  it("shows a returned grid as the final frame", () => {
    const code = `class Solution:
    def updateMatrix(self, mat: List[List[int]]) -> List[List[int]]:
        m, n = len(mat), len(mat[0])
        dist = [[0 if mat[i][j] == 0 else -1 for j in range(n)] for i in range(m)]
        q = deque((i, j) for i in range(m) for j in range(n) if mat[i][j] == 0)
        while q:
            i, j = q.popleft()
            for ni, nj in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if 0 <= ni < m and 0 <= nj < n and dist[ni][nj] == -1:
                    dist[ni][nj] = dist[i][j] + 1
                    q.append((ni, nj))
        return dist
`;
    const mat = [[0, 0, 0], [0, 1, 0], [1, 1, 1]];
    const { trace, ret } = gridTrace(code, "updateMatrix", [mat]);
    expect(ret).toEqual([[0, 0, 0], [0, 1, 0], [1, 2, 1]]);
    expect(cellsOf(mat, trace)).toEqual([["0", "0", "0"], ["0", "1", "0"], ["1", "2", "1"]]);
    expect(trace.frames.at(-1)!.pointers).toEqual({});
    expect(trace.frames.every((frame) => frame.frontier.every((id) => /^a\d\.\d$/.test(id)))).toBe(true);
  });

  it("restores cells written during backtracking and marks visited matrices", () => {
    const code = `class Solution:
    def exist(self, board: List[List[str]], word: str) -> bool:
        R, C = len(board), len(board[0])
        seen = [[False] * C for _ in range(R)]
        def bt(r, c, k):
            if k == len(word):
                return True
            if r < 0 or c < 0 or r >= R or c >= C or board[r][c] != word[k]:
                return False
            seen[r][c] = True
            tmp, board[r][c] = board[r][c], "#"
            found = bt(r + 1, c, k + 1) or bt(r, c + 1, k + 1)
            board[r][c] = tmp
            return found
        return bt(0, 0, 0)
`;
    const board = [["A", "B"], ["C", "D"]];
    const { trace, ret } = gridTrace(code, "exist", [board, "ABD"]);
    expect(ret).toBe(true);
    expect(trace.frames.some((frame) => frame.labels["a0.1"] === "#")).toBe(true);
    expect(cellsOf(board, trace)).toEqual([["A", "B"], ["C", "D"]]);
    expect(trace.frames.at(-1)!.visited).toEqual(expect.arrayContaining(["a0.0", "a0.1", "a1.1"]));
  });
});

function graphTrace(code: string, method: string, args: unknown[], at: number, options: GraphOptions, conv?: Conv[]): { trace: Trace; ret: unknown } {
  const [result] = runCases(code, method, [args], conv ?? args.map(() => "raw"));
  expect(result!.err).toBeNull();
  const id = "abcdefghijklmnopqrstuvwxy"[at]!;
  const pane: Pane = { id, title: options.name ?? "graph", model: parseGraph(args[at] as never, id, options) };
  return { trace: buildTrace(result!.stdout, [pane]), ret: result!.ret };
}

describe.skipIf(!PYTHON)("python graph tracer", () => {
  it("follows Kahn's algorithm with node pointers, the queue and indegrees", () => {
    const code = `from collections import defaultdict
class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        adj = defaultdict(list)
        indeg = [0] * numCourses
        for a, b in prerequisites:
            adj[b].append(a)
            indeg[a] += 1
        q = deque(i for i in range(numCourses) if indeg[i] == 0)
        taken = 0
        while q:
            course = q.popleft()
            taken += 1
            for nxt in adj[course]:
                indeg[nxt] -= 1
                if indeg[nxt] == 0:
                    q.append(nxt)
        return taken == numCourses
`;
    const { trace, ret } = graphTrace(code, "canFinish", [3, [[1, 0], [2, 1]]], 1, { name: "prerequisites", count: 3 });
    expect(ret).toBe(true);
    const built = trace.frames.findIndex((frame) => frame.notes.indeg?.b2 === "1");
    expect(trace.frames[built]).toMatchObject({ note: "indeg", notes: { indeg: { b0: "0", b1: "1", b2: "1" } } });
    expect(trace.frames.some((frame) => frame.pointers.course === "b1" && frame.pointers.nxt === "b2")).toBe(true);
    expect(trace.frames.some((frame) => frame.frontier.includes("b0"))).toBe(true);
    const later = trace.frames.filter((frame) => frame.pointers.course !== undefined);
    expect(later.every((frame) => frame.pointers.a === undefined && frame.pointers.b === undefined)).toBe(true);
    expect(trace.frames.at(-1)!.notes.indeg).toEqual({ b0: "0", b1: "0", b2: "0" });
  });

  it("reads the node out of Dijkstra heap entries and shows distances", () => {
    const code = `import heapq
from collections import defaultdict
class Solution:
    def networkDelayTime(self, times: List[List[int]], n: int, k: int) -> int:
        g = defaultdict(list)
        for u, v, w in times:
            g[u].append((v, w))
        dist = {}
        heap = [(0, k)]
        while heap:
            d, node = heapq.heappop(heap)
            if node in dist:
                continue
            dist[node] = d
            for nei, w in g[node]:
                if nei not in dist:
                    heapq.heappush(heap, (d + w, nei))
        return max(dist.values()) if len(dist) == n else -1
`;
    const { trace, ret } = graphTrace(code, "networkDelayTime", [[[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2], 0, { name: "times", count: 4 });
    expect(ret).toBe(2);
    expect(trace.frames.some((frame) => frame.frontier.includes("a1"))).toBe(true);
    expect(trace.frames.at(-1)!.notes.dist).toEqual({ a0: "1", a1: "0", a2: "1", a3: "2" });
  });

  it("tags Clone Graph nodes by object and leaves the copies alone", () => {
    const code = `class Solution:
    def cloneGraph(self, node: Optional['Node']) -> Optional['Node']:
        if not node:
            return None
        copies = {node: Node(node.val)}
        q = deque([node])
        while q:
            cur = q.popleft()
            for nei in cur.neighbors:
                if nei not in copies:
                    copies[nei] = Node(nei.val)
                    q.append(nei)
                copies[cur].neighbors.append(copies[nei])
        return copies[node]
`;
    const adj = [[2, 4], [1, 3], [2, 4], [1, 3]];
    const { trace, ret } = graphTrace(code, "cloneGraph", [adj], 0, { name: "node", type: "Optional['Node']" }, ["graph"]);
    expect(ret).toBe(1);
    expect(new Set(trace.frames.map((frame) => frame.pointers.cur).filter(Boolean))).toEqual(new Set(["a0", "a1", "a2", "a3"]));
    expect(trace.frames.some((frame) => frame.frontier.length >= 2)).toBe(true);
  });

  it("marks visited rooms from a seen set and the stack as the frontier", () => {
    const code = `class Solution:
    def canVisitAllRooms(self, rooms: List[List[int]]) -> bool:
        seen = {0}
        stack = [0]
        while stack:
            room = stack.pop()
            for key in rooms[room]:
                if key not in seen:
                    seen.add(key)
                    stack.append(key)
        return len(seen) == len(rooms)
`;
    const { trace, ret } = graphTrace(code, "canVisitAllRooms", [[[1, 3], [3, 0, 1], [2], [0]]], 0, { name: "rooms" });
    expect(ret).toBe(false);
    expect(trace.frames.at(-1)!.visited).toEqual(["a0", "a1", "a3"]);
    expect(trace.frames.some((frame) => frame.frontier.includes("a3"))).toBe(true);
  });
});

describe.skipIf(!PYTHON)("python grid tracer pairs", () => {
  it("ignores enumerate values and unpacked tuples the grid is never indexed with", () => {
    const code = `class Solution:
    def islandPerimeter(self, grid: List[List[int]]) -> int:
        p = 0
        for r, row in enumerate(grid):
            for c, v in enumerate(row):
                if v:
                    p += 4
                    if r and grid[r - 1][c]:
                        p -= 2
                    if c and grid[r][c - 1]:
                        p -= 2
        q, s = divmod(p, 3)
        return p
`;
    const { trace, ret } = gridTrace(code, "islandPerimeter", [[[0, 1], [1, 1]]]);
    expect(ret).toBe(8);
    const names = new Set(trace.frames.flatMap((frame) => Object.keys(frame.pointers)));
    expect([...names]).toEqual(["r,c"]);
  });

  it("traces writes on the grid each pair indexes", () => {
    const code = `class Solution:
    def countSubIslands(self, grid1: List[List[int]], grid2: List[List[int]]) -> int:
        m, n = len(grid2), len(grid2[0])
        def dfs(i, j):
            if not (0 <= i < m and 0 <= j < n) or grid2[i][j] == 0:
                return 1
            grid2[i][j] = 0
            res = grid1[i][j]
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                res &= dfs(i + di, j + dj)
            return res
        return sum(dfs(i, j) for i in range(m) for j in range(n) if grid2[i][j])
`;
    const grid1 = [[1, 1], [0, 1]];
    const grid2 = [[1, 0], [0, 1]];
    const [result] = runCases(code, "countSubIslands", [[grid1, grid2]], ["raw", "raw"]);
    const panes: Pane[] = [
      { id: "a", title: "grid1", model: parseMatrix(grid1 as never, "grid1") },
      { id: "b", title: "grid2", model: parseMatrix(grid2 as never, "grid2") },
    ];
    const trace = buildTrace(result!.stdout, panes);
    expect(result!.ret).toBe(2);
    expect(trace.frames.at(-1)!.labels).toEqual({ "b0.0": "0", "b1.1": "0" });
    expect(trace.frames.flatMap((frame) => Object.values(frame.pointers)).every((id) => id.startsWith("b"))).toBe(true);
  });
});
