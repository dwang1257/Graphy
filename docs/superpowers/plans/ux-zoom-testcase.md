# Plan addendum: UX fixes (zoom + testcase UX)

## Task 8: Faster graph zoom

**Files:** primarily `src/panel/GraphView.tsx`

**Problem:** Wheel zoom uses `Math.exp(-deltaY * 0.0015)`, which feels too slow.

**Fix:**
- Increase zoom responsiveness (stronger factor and/or treat `deltaMode` / trackpad vs mouse wheel)
- Prefer updating transform via a ref (or rAF-coalesced updates) so zoom does not feel laggy from React re-renders
- Keep cursor-anchored zoom and existing min/max scale
- Do not change pan behavior except as needed for the same transform path

**Acceptance:** Same physical scroll gesture zooms noticeably faster; still smooth; fit-to-view still works.

## Task 9: Accurate testcase parsing; remove arg tabs

**Files:** `src/panel/App.tsx`, `src/core/build.ts`, `src/main-world/inject.ts` (and signature/detect only if needed for naming)

**Problem:**
- Panel shows tabs labeled `arg 1`, `arg 2`, etc. for multi-parameter inputs
- User does not want tabs to switch between cases/args
- Graph should automatically reflect the **currently selected** LeetCode custom test case

**Fix:**
1. Remove the pane tab UI entirely from `App.tsx`
2. Show a single graph for the active snapshot: pick one primary pane (prefer first visualizable structure; if user set a structure override, prefer a pane matching that kind). Status bar may still show the param name when known.
3. Improve input capture in `inject.ts` so `splitBuffers()` / publish only reads the **active** custom testcase (the visible/selected Case N), not every case’s editors concatenated. Keep per-parameter editors of the *active* case joined as today (one line per arg).
4. Prefer real signature parameter names over `arg N` when a signature is available; fix signature alignment if names are missing due to parse bugs.

**Acceptance:**
- No tab bar in the panel
- Switching LeetCode Case 1 / Case 2 updates the graph to that case’s input
- Multi-arg problems (e.g. tree + `n`) show one sensible graph without `arg 1` / `arg 2` tabs
- `npm run typecheck` passes

## Independence

Task 8 and Task 9 share no required files (8 = GraphView; 9 = App/build/inject). Safe to run in parallel on separate branches.
