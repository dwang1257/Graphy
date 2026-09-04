# Testcase DOM Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably capture every LeetCode testcase by visiting its Case tab and reading structurally owned parameter editors, without publishing partial collections.

**Architecture:** Add a focused DOM adapter for testcase tabs and mounted input fields, then an asynchronous traversal collector that restores the selected tab. Integrate the collector into the page-world publisher with generation cancellation and a per-slug last-complete cache; remove aggregate case grouping from production capture.

**Tech Stack:** TypeScript 7, DOM APIs, Preact extension runtime, Vitest 4

**Spec:** `docs/superpowers/specs/2026-09-03-testcase-dom-capture-design.md`

## Global Constraints

- Capture all Case tabs in DOM order and retain Graphy's case switcher.
- Use strict DOM ownership; do not infer case boundaries from an aggregate buffer.
- Restore the user's selected LeetCode tab on success, failure, and cancellation.
- Publish collections atomically; never publish an intermediate subset.
- A Run request must not collapse a complete multi-case collection.
- Preserve existing uncommitted user work and do not rewrite unrelated panel/build files.
- Add no runtime dependency.

---

## File Structure

- `src/core/parse/value.ts`: scan a single case's top-level values safely.
- `src/core/parse/value.test.ts`: scanner and literal-normalization regressions.
- `src/main-world/testcaseDom.ts`: testcase-specific selectors, editor reads, tab state, and condition-based settling.
- `src/main-world/testcaseDom.test.ts`: DOM adapter tests with small fake elements.
- `src/main-world/testcaseCapture.ts`: sequential traversal, cancellation, atomic results, and selection restoration.
- `src/main-world/testcaseCapture.test.ts`: traversal behavior tests against a fake adapter.
- `src/main-world/inject.ts`: scheduling, per-slug cache, network merge policy, and snapshot publication.
- `src/main-world/inject.test.ts`: page-world integration and race regressions.
- `src/core/cases.ts`: retain only `clampCaseIndex` after aggregate grouping is removed.
- `src/core/cases.test.ts`: remove obsolete grouping tests; retain index tests.

### Task 1: Harden Per-Case Value Scanning

**Files:**
- Modify: `src/core/parse/value.ts`
- Modify: `src/core/parse/value.test.ts`

**Interfaces:**
- Produces: `scanInputValues(input: string): { values: string[]; error?: string }`
- Produces: `splitInputValues(input: string): string[]`
- Preserves: `parseInput(input: string): LCValue[]`

- [ ] **Step 1: Add failing scanner tests**

Add tests proving parentheses remain balanced across newlines, escaped quotes use
backslash parity, unmatched closing delimiters do not produce negative depth,
and Python tokens inside quoted strings are unchanged:

```ts
it("tracks parentheses while splitting multiline values", () => {
  expect(splitInputValues("(\n[1, 2]\n)\n3")).toEqual(["(\n[1, 2]\n)", "3"]);
});

it("does not end a string after an escaped backslash pair", () => {
  expect(splitInputValues('["\\\\", "]"]\n2')).toEqual(['["\\\\", "]"]', "2"]);
});

it("does not normalize Python tokens inside strings", () => {
  expect(parseInput('["None", None, "True", True]')).toEqual([
    ["None", null, "True", true],
  ]);
});

it("reports an unmatched delimiter without discarding scanned text", () => {
  expect(scanInputValues("[1, 2")).toEqual({
    values: ["[1, 2"],
    error: "Unclosed delimiter '['.",
  });
});
```

- [ ] **Step 2: Verify the new tests fail**

Run: `npm test -- src/core/parse/value.test.ts`

Expected: at least the parentheses or quoted-token test fails for the current scanner/normalizer.

- [ ] **Step 3: Implement delimiter stack and token-aware normalization**

Replace scalar bracket depth with a delimiter stack for `[]`, `{}`, and `()`.
Determine quote termination by counting consecutive preceding backslashes.
Normalize `None`, `True`, and `False` only while outside quoted strings. Keep
unparseable literals as their original raw strings. Implement
`splitInputValues` as the compatibility wrapper returning
`scanInputValues(input).values`.

- [ ] **Step 4: Verify scanner tests pass**

Run: `npm test -- src/core/parse/value.test.ts`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/core/parse/value.ts src/core/parse/value.test.ts
git commit -m "fix: harden testcase value scanning"
```

### Task 2: Add the Structurally Scoped DOM Adapter

**Files:**
- Create: `src/main-world/testcaseDom.ts`
- Create: `src/main-world/testcaseDom.test.ts`

**Interfaces:**
- Produces:

```ts
export interface CaseTab {
  element: HTMLElement;
  index: number;
}

export interface TestcaseDomAdapter {
  tabs(): CaseTab[];
  selectedIndex(tabs: CaseTab[]): number;
  select(tab: CaseTab): void;
  readMountedParameters(): string[] | null;
  waitUntilSettled(tab: CaseTab, isCurrent: () => boolean): Promise<string[]>;
}

export function createTestcaseDomAdapter(
  doc: Document,
  win: Window,
): TestcaseDomAdapter;
```

- [ ] **Step 1: Add failing adapter tests**

Create fake testcase tabs and input wrappers. Cover:

```ts
it("reads only editors owned by testcase input wrappers", () => {
  const adapter = createTestcaseDomAdapter(fakeDocumentWithUnrelatedEditor(), fakeWindow());
  expect(adapter.readMountedParameters()).toEqual(["[1,2,3]", "2"]);
});

it("falls back to textarea values inside testcase input wrappers", () => {
  const adapter = createTestcaseDomAdapter(fakeTextareaDocument(), fakeWindow());
  expect(adapter.readMountedParameters()).toEqual(["[4,5]", "3"]);
});

it("recognizes the selected testcase tab semantically", () => {
  const adapter = createTestcaseDomAdapter(fakeSelectedTabDocument(1), fakeWindow());
  expect(adapter.selectedIndex(adapter.tabs())).toBe(1);
});
```

The fakes must expose `[data-e2e-locator="console-testcase-tag"]` tabs and
`[data-e2e-locator="console-testcase-input"]` wrappers. Put unrelated
`.cm-content` nodes outside those wrappers and prove they are ignored.

- [ ] **Step 2: Verify the adapter tests fail**

Run: `npm test -- src/main-world/testcaseDom.test.ts`

Expected: FAIL because `testcaseDom.ts` does not exist.

- [ ] **Step 3: Implement scoped reads and semantic tab state**

Read a wrapper's CodeMirror document through
`cmView.rootView.view.state.doc.toString()`. Fall back to a descendant textarea,
or the wrapper itself when it is a textarea. `waitUntilSettled` must wait for
the requested tab to become selected and for mounted parameter fingerprints to
remain equal across two animation frames. Reject when `isCurrent()` becomes
false or after a bounded timeout; the timeout is only a failure boundary, not
the readiness condition.

- [ ] **Step 4: Verify adapter tests pass**

Run: `npm test -- src/main-world/testcaseDom.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main-world/testcaseDom.ts src/main-world/testcaseDom.test.ts
git commit -m "feat: add testcase DOM adapter"
```

### Task 3: Implement Atomic Case-Tab Traversal

**Files:**
- Create: `src/main-world/testcaseCapture.ts`
- Create: `src/main-world/testcaseCapture.test.ts`

**Interfaces:**
- Consumes: `TestcaseDomAdapter`, `CaseTab`
- Produces:

```ts
export interface DomCaseCapture {
  cases: string[];
  captureError?: string;
}

export async function captureCasesFromTabs(
  adapter: TestcaseDomAdapter,
  isCurrent?: () => boolean,
): Promise<DomCaseCapture>;
```

- [ ] **Step 1: Add failing traversal tests**

Use a fake adapter whose `select` changes the mounted parameter values. Cover:

```ts
it("captures every tab in order and restores the original selection", async () => {
  const adapter = fakeAdapter({
    selected: 1,
    cases: [["[1]"], ["[2]", "4"], ["[3]"]],
  });
  await expect(captureCasesFromTabs(adapter)).resolves.toEqual({
    cases: ["[1]", "[2]\n4", "[3]"],
  });
  expect(adapter.currentIndex()).toBe(1);
});

it("restores selection and returns no partial cases after a tab failure", async () => {
  const adapter = fakeAdapter({ selected: 0, cases: [["[1]"], new Error("missing"), ["[3]"]] });
  const result = await captureCasesFromTabs(adapter);
  expect(result.cases).toEqual([]);
  expect(result.captureError).toMatch(/Case 2/);
  expect(adapter.currentIndex()).toBe(0);
});
```

Also test no-tab single mounted case and generation cancellation.

- [ ] **Step 2: Verify traversal tests fail**

Run: `npm test -- src/main-world/testcaseCapture.test.ts`

Expected: FAIL because the collector does not exist.

- [ ] **Step 3: Implement sequential traversal**

Record the original selected tab, visit every tab in order, await
`waitUntilSettled`, and join parameter documents with `\n`. Return no cases if
any tab fails or cancellation occurs. In `finally`, select and settle the
original tab when it changed. For zero tabs, return one mounted structurally
owned case when available.

- [ ] **Step 4: Verify traversal tests pass**

Run: `npm test -- src/main-world/testcaseCapture.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main-world/testcaseCapture.ts src/main-world/testcaseCapture.test.ts
git commit -m "feat: capture testcase tabs atomically"
```

### Task 4: Integrate Traversal, Cancellation, Cache, and Run Policy

**Files:**
- Modify: `src/main-world/inject.ts`
- Modify: `src/main-world/inject.test.ts`
- Modify: `src/core/cases.ts`
- Modify: `src/core/cases.test.ts`

**Interfaces:**
- Consumes: `createTestcaseDomAdapter(document, window)`,
  `captureCasesFromTabs(adapter, isCurrent)`
- Preserves: `Snapshot.cases`, `Snapshot.captureError`, `Snapshot.source`
- Preserves: `clampCaseIndex(index: number, caseCount: number): number`

- [ ] **Step 1: Replace integration fixtures with tab-aware failing tests**

Extend the page harness so clicking each fake Case tab changes the mounted input
wrappers. Add tests for:

```ts
test("publishes one atomic snapshot containing every visited Case tab", async () => {
  const page = installTabbedPage([["[1]"], ["[2]", "4"], ["[3]"]], 1);
  await import("./inject.js");
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]\n4", "[3]"]);
  expect(page.selectedIndex()).toBe(1);
});

test("keeps the last complete collection when a refresh is cancelled", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 0);
  await import("./inject.js");
  await page.flushCapture();
  const complete = page.snapshots.at(-1)?.payload.cases;

  page.pauseSelectionOf(1);
  page.dispatchInput();
  page.dispatchInput();
  await page.flushCapture();

  expect(complete).toEqual(["[1]", "[2]", "[3]"]);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
});

test("Run never replaces a complete collection with data_input", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 0);
  await import("./inject.js");
  await page.flushCapture();

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[2]", typed_code: "class Solution {};", lang: "cpp" }),
  });
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);
});
```

Add route-cache isolation and initial-failure `captureError` tests.

- [ ] **Step 2: Verify integration tests fail**

Run: `npm test -- src/main-world/inject.test.ts`

Expected: FAIL because current publication is synchronous and aggregate-based.

- [ ] **Step 3: Implement asynchronous single-flight publication**

In `inject.ts`:

- create one DOM adapter;
- replace synchronous `captureCases()` with `captureCasesFromTabs`;
- increment a generation for every scheduled capture;
- ensure only the latest generation may publish;
- keep `{ slug, cases }` only after a complete capture;
- clear the cache when `slug` changes;
- on transient failure, reuse the current slug's complete cache;
- await a fresh traversal for editor, interval, click, and Run triggers;
- keep code/language metadata collection separate from testcase editors;
- allow network `data_input` only when no tabs and no complete cache exist.

Remove `groupTestCases` from capture. Delete that export and its obsolete tests
if no production caller remains, leaving `clampCaseIndex` intact.

- [ ] **Step 4: Verify focused integration**

Run:

```bash
npm test -- src/main-world/testcaseDom.test.ts src/main-world/testcaseCapture.test.ts src/main-world/inject.test.ts src/core/cases.test.ts
```

Expected: PASS with no unhandled promise rejections.

- [ ] **Step 5: Commit**

```bash
git add src/main-world/inject.ts src/main-world/inject.test.ts src/core/cases.ts src/core/cases.test.ts
git commit -m "fix: capture all testcase tabs reliably"
```

### Task 5: Full Verification and Distribution Build

**Files:**
- Generated by build: `dist/**`

**Interfaces:**
- Verifies all prior tasks as one extension build.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 2: Run static type checking**

Run: `npm run typecheck`

Expected: exit code 0 with no diagnostics.

- [ ] **Step 3: Build the extension**

Run: `npm run build`

Expected: Vite exits successfully and emits updated `dist` assets.

- [ ] **Step 4: Re-run tests after generated output**

Run: `npm test`

Expected: all tests still pass.

- [ ] **Step 5: Review the final diff**

Confirm the diff contains only the approved parser/capture work, its tests, plan
and spec commits, plus expected generated `dist` output. Confirm no pre-existing
unrelated user changes were reverted.
