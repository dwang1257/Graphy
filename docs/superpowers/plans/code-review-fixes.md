# Plan: Code review fixes

Fix Critical and Important issues from the Graphy v1 code review.

## Spec / authority

README.md supported-structures table and Usage/Customization sections.

## Global Constraints

- Stay scoped to the listed fix; no drive-by refactors
- Follow existing TypeScript/Preact patterns
- Prefer TDD for parser/detection/behavior changes
- Do not push to remote
- Commit on the agent's own branch only
- After changes: `npm run typecheck` must pass
- Work only in the assigned file scope (listed per task)

## Tasks

### Task 1: String grid expansion

**Files:** `src/core/parse/matrix.ts` (and tests if added locally)

**Problem:** `["11110","10001"]` detects as matrix but `normalize()` treats strings as a single row of whole strings instead of character cells.

**Fix:** In `normalize`, if every element is a string of equal length (>0), expand via `value.map(s => [...s])` (or equivalent) before building cells. Keep nested-array path unchanged.

**Acceptance:** `parseMatrix(["11110","10001"])` yields 2 rows × 5 cells with correct filled/empty cells.

### Task 2: Shape heuristics for edge list vs adjacency

**Files:** `src/core/detect.ts` (`fromShape` only; do not change `isConnected` name mapping — Task 4)

**Problem:** README examples without signature:
- `[[2,4],[1,3],[2,4],[1,3]]` → wrongly graph (should be adjacency)
- `[[0,1],[1,2],[2,0]]` → wrongly adjacency (should be undirected graph)

**Fix:** Prefer denser signals: square 0/1 → matrix; neighbor indices mostly `< rows.length` → adjacency; otherwise edge list. Keep name/type rules as higher priority (already are).

**Acceptance:** `detectRole(undefined, …)` matches README table for those two literals.

### Task 3: Node-limit uses visible nodes

**Files:** `src/core/types.ts` (`modelSize` / helpers), `src/panel/App.tsx` (guard that uses size)

**Problem:** Limit uses `nodes.length` including spine/null scaffolding.

**Fix:** Gate layout confirmation on `visibleNodeCount` (matrix cells unchanged). Status bar already uses visible count — keep consistent.

**Acceptance:** A binary tree whose visible nodes ≤ limit but scaffolding pushes `nodes.length` over limit does not show “Render anyway”.

### Task 4: Map `isConnected` to matrix

**Files:** `src/core/detect.ts` (NAME_RULES only), optionally README one-line if needed

**Problem:** `isConnected` is Number of Provinces adjacency **matrix**, not neighbor lists.

**Fix:** Move `isConnected` from adjacency name set to matrix name set.

**Acceptance:** `detectRole({ name: "isConnected", type: "..." }, …)` → `{ kind: "matrix" }`.

### Task 5: Parser/detection unit tests

**Files:** new test files under e.g. `src/core/**/*.test.ts`, `package.json` scripts/deps as needed (vitest recommended)

**Problem:** No automated tests for parsers/detection.

**Fix:** Add vitest (or minimal node test runner), fixtures for README structure table: string grids, edge vs adjacency shape, linked-list `pos` if easy, `isConnected` → matrix, binary tree nulls. Tests should assert desired behavior (may fail until other tasks merge — write correct expectations).

**Acceptance:** `npm test` runs and covers detect + matrix at minimum.

### Task 6: Trust boundary (postMessage, shadow, SVG)

**Files:** `src/panel/App.tsx`, `src/content/host.ts`, `src/panel/GraphView.tsx`, `src/shared/protocol.ts`

**Problem:** Open shadow root; panel accepts messages without origin check; SVG via `dangerouslySetInnerHTML`; weak `isPanelMessage`.

**Fix:**
1. Prefer `shadowRoot: "closed"` if panel still works; otherwise document why not and still harden messaging
2. Validate `event.origin` is the extension origin (panel ↔ host)
3. `postMessage` with explicit target origin (not `"*"`)
4. Strengthen `isPanelMessage` by type + finite numbers/booleans
5. Sanitize Graphviz SVG before HTML injection (strip script/on* handlers)

**Acceptance:** Malformed panel messages ignored; SVG with `<script>` does not execute; typecheck clean.

### Task 7: Remove NUL bytes from source

**Files:** `src/main-world/inject.ts`, `src/core/parse/graph.ts`

**Problem:** `\0` in template strings makes git treat files as binary.

**Fix:** Replace with a printable sentinel (e.g. `"\u001e"` record separator or a clear string constant like `"\n/*GRAPHY_SEP*/\n"`). Preserve runtime behavior of whatever the separator was joining/splitting.

**Acceptance:** `git diff` / `file` shows both as text; typecheck clean; no behavioral change to parsing/injection.

## Preflight conflict scan

| Pair | Shared | Notes |
| --- | --- | --- |
| T2 ↔ T4 | `detect.ts` | Same file — isolated worktrees, merge carefully (NAME_RULES vs fromShape) |
| T3 ↔ T6 | `App.tsx` | Different concerns (size vs messages) — merge carefully |
| T5 ↔ all | tests | Depends on correct behavior — merge last or write expectations first |
| T1, T7 | none | Independent |

**Ruling:** Run Tasks 1–7 in parallel via isolated git worktrees (`best-of-n-runner`), then merge onto one feature branch in order T7 → T1 → T2 → T4 → T3 → T6 → T5.
