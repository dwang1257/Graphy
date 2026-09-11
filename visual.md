# Visualizing code on Graphy graphs

Graphy already draws the LeetCode test-case structure (tree, list, grid). This note is how that picture follows **the code in the editor**, without asking people to sprinkle debug prints.

## Constraint

The judge runs on LeetCode’s servers. The panel only has:

- the parsed `GraphModel` (nodes `n0`, `n1`, …)
- whatever a **Run** puts on stdout
- the editor buffer (for signatures, not execution)

So “run my code on this graph” has to mean: execute the real solution somewhere, emit a cheap trace, paint it on the SVG we already laid out.

## Approaches we considered

| Approach | Runs their code? | Cost |
| --- | --- | --- |
| **A. Print protocol** — user writes `#graphy current 4` | Yes | Noisy; they have to touch the solution |
| **B. Inject a tracer on Run** | Yes | Rewrite `typed_code` on `interpret_solution` only |
| **C. Local VM** (Pyodide / eval) | Yes, one language | New runtime inside the extension |
| **D. Recipe walker** | No — standard BFS/invert/etc. | Fast, can lie |

**B is the one we shipped next.** A already exists as a fallback. C and D stay future work.

## What shipped

### 1. Manual stdout protocol (fallback)

Any language. After Run, Graphy parses lines like:

```text
#graphy current n0
#graphy visit n0
#graphy enqueue n1
#graphy dequeue n1
#graphy frontier n1 n2
#graphy clear
#graphy topology n0:n2,n1 n1:-,- n2:n6,n5
```

Refs: `n0` (id), `@2` (index → `n2`), bare `4` (first node with that label), `1,0` (matrix cell).

Compact `#graphy/[…]`: ints are tree/list visits (`0` → `n0`). **3-tuples** `(id,left,right)` patch tree topology. **2-tuples** `(r,c)` are grid cell current+visit (`"r,c"` → `cell:r,c`). Example: `#graphy/[(0,0),(0,1),(1,0)]`.

Topology tokens are `parent:left,right` with `-` for `None`. Only nodes reachable from the root are listed. When topology changes, Graphy rebuilds the tree (stable ids), re-runs Graphviz, and FLIP-animates nodes to their new positions; deleted ids fade out.

Playback is a scrubber under the graph. Highlights are CSS on the SVG. Walk-only frames keep the current layout; topology frames morph.

Current = solid accent, visited = soft fill, frontier = dashed outline.

### 2. Automatic Python tracer (no editor comments)

On **Run** (`interpret_solution`), not Submit:

1. If `lang` is `python` or `python3`, append a preamble marked `GRAPHY_TRACE_V1`.
2. The editor snapshot stays the original `typed_code`.
3. In the judge, the preamble wraps `Solution` methods.
4. On entry it tags `TreeNode`s with the same **level-order ids** Graphy uses (`n0` is the root; null children still consume an index). `ListNode` chains are tagged along `.next` with the same `n{i}` ids as `parseLinkedList` (head = n0). Cycles stop when a node is seen again.
5. `sys.settrace` watches locals (`node`, `curr`, `root`, `head`, …) and prints compact `#graphy/[…]` integers when they point at a tagged node. Grid walks emit `(r,c)` 2-tuples when `i`/`j`, `r`/`c`, `row`/`col`, or `x`/`y` are in range.
6. After each line (and on unwind) trees snapshot child pointers and emit `(id,left,right)` patches when the edge set changes. Lists emit current/visit integers only — topology 3-tuples would corrupt list layout.
7. Repeat prints for the same current node or cell are dropped.
8. The stdout → frame → overlay / morph path lights and reshapes the graph.

Invert Binary Tree, linked-list walks, and grid/graph cell walks then work with a clean editor: hit Run, scrub the walk. Tree children slide when swaps happen; unlinking a child fades that subtree. Lists light up as `curr`/`head`/`p`/`q` walk the chain. Matrices labeled Graph highlight `cell:r,c`.

Non-Python languages still need the manual protocol (or a later injector). Other languages can print `#graphy topology` by hand.

## Node id contract

Binary-tree ids are **level-order array indices**, not “nth live node”:

```text
[4,2,7,1,3,6,9]  →  n0=4 n1=2 n2=7 n3=1 n4=3 n5=6 n6=9
[3,9,20,null,null,15,7]  →  n0=3 n1=9 n2=20 n5=15 n6=7
```

The tracer’s BFS must use the same cursor rules as `parseBinaryTree`. Object identity stays on the tagged `TreeNode` for the whole run; pointer swaps change topology, not ids.

## Files

- `src/core/trace.ts` — parse stdout → frames; resolve refs; carry `links` / `deleted`
- `src/core/topology.ts` — topology token parse / reachability / canonicalize
- `src/core/treeModel.ts` — `modelFromTree` / `applyTopology`
- `src/main-world/instrument.ts` — Python snippet + Run-body rewrite
- `src/main-world/graphTrace.ts` — grid helpers; emit compact `(r,c)` 2-tuples
- `src/main-world/inject.ts` — apply rewrite on fetch/XHR Run; remember original code
- `src/main-world/runResult.ts` — pull stdout out of `/check`
- `src/panel/traceOverlay.ts` — mark SVG nodes / matrix cells
- `src/panel/graphMorph.ts` — FLIP slide between Graphviz layouts
- `src/panel/TracePlayback.tsx` — play / step / scrub
- `src/panel/GraphView.tsx` — apply overlay / morph after layout
- `src/core/dot/emit.ts` — `graphy://cell/r/c` hrefs on matrix cells

## What this does not do yet

- Auto-trace C++ / Java / JS (Python trees, lists, and grids are injected on Run)
- Nodes allocated during the run (not in the entry tag map)
- Submit (payload is never rewritten)

## Later, if we outgrow inject-on-Run

- **JS injector** on the same hook
- **Local replay** when we want step-through without a judge round-trip
- **Input vs output morph** from the return value (no trace needed)
- **Graph Node.neighbors** adjacency graphs beyond the matrix/"Graph" grid view
