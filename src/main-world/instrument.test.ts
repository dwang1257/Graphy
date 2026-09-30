import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { buildTrace, type Trace } from "../core/trace.js";
import { TRACE_SENTINEL } from "../core/traceWire.js";
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

type Conv = "tree" | "list" | "raw";

function runCases(code: string, method: string, cases: unknown[][], conv: Conv[], instrument = true): CaseResult[] {
  const driver = `
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
conv = ${JSON.stringify(conv)}
real = sys.stdout
for c in cases:
    args = [mk_tree(v) if k == "tree" else mk_list(v) if k == "list" else v for v, k in zip(c, conv)]
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
