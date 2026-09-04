# Testcase DOM Capture Revamp

## Goal

Graphy must capture every LeetCode custom testcase in DOM order without
occasionally publishing zero cases, a partial collection, or incorrectly grouped
cases. Graphy will keep its own case tabs.

## Problem

The current pipeline concatenates every non-code CodeMirror document into one
buffer, counts Case tabs and parameter fields globally, and asks
`groupTestCases` to reconstruct case boundaries. Those inputs are not stable:
LeetCode can duplicate editors, expose fields only for the selected case, update
tabs and editors at different times, or mount unrelated CodeMirror surfaces.

The current tolerant grouping then compounds the uncertainty. Depending on the
observed counts it can collapse several cases into one, infer one-value cases for
a multi-parameter problem, or discard trailing values. A network Run can replace
an already degraded collection with the single executed case.

## Chosen Approach

Use strict DOM ownership instead of aggregate-buffer inference. Graphy will
visit each LeetCode Case tab, read the parameter editors mounted for that
selected case, and restore the user's original selection.

Aggregate-buffer parsing will not be used as a fallback. If a Case tab cannot be
captured structurally, Graphy will not invent its boundaries.

## Capture Architecture

The page-world injection will separate capture into focused units:

1. Discover Case tabs in DOM order using the testcase-tab locator.
2. Determine the selected tab from semantic state such as `aria-selected`,
   `data-state`, or the tab's active marker.
3. Select each tab through its normal click behavior.
4. Wait until the testcase input region reflects that tab.
5. Read parameter values from editors scoped to the testcase console/input
   containers.
6. Join that tab's ordered parameter values with newlines.
7. Restore the originally selected tab in a `finally` block.
8. Atomically publish the complete ordered collection.

If no Case tabs exist, Graphy may capture a single structurally owned testcase
from the mounted testcase input region. It must not treat arbitrary page editors
as testcase input.

Code capture remains independent. The solution editor may still be identified
for signature detection, but failure to identify source code must not cause it
to be included as testcase data.

## Asynchronous Coordination

Collection becomes asynchronous because changing a Case tab updates LeetCode's
DOM after the click.

- Only one traversal may be active at a time.
- Each traversal receives a monotonically increasing generation token.
- Input, paste, route, Run, or scheduled refresh events invalidate older
  generations.
- Waiting is condition-based, using observed selected-tab and input-region
  changes rather than fixed sleeps.
- A traversal publishes only if its generation is still current.
- The original selected tab is restored on success, failure, or cancellation.
- Publishing is atomic; intermediate collections such as one of three cases are
  never sent to the panel.

The periodic refresh remains a recovery mechanism, but it must not overlap an
active traversal.

## Value Capture and Parsing

Each parameter editor is already a structural boundary. Capture preserves the
editor's complete document, including pretty-printed arrays, instead of splitting
an aggregate buffer into values.

`parseInput` still splits a single case into top-level parameter values for graph
construction. Its scanner will be hardened to:

- normalize CRLF line endings;
- track arrays, objects, and parentheses;
- handle quoted strings using backslash parity rather than checking one previous
  character;
- prevent delimiter depth from becoming negative;
- return explicit scan diagnostics for unclosed strings or delimiters.

Literal normalization must not replace `None`, `True`, or `False` inside quoted
strings. Unparseable values remain available as raw text so the graph builder can
produce a useful failure instead of losing the case.

## Failure and Cache Policy

The collector maintains the last complete collection for the current problem
slug.

- A successful traversal replaces the cache and publishes it.
- A transient traversal failure keeps the cached complete collection.
- If no complete collection has ever been captured, Graphy publishes no cases
  with a concise `captureError`.
- A route change clears the prior slug's cache.
- Empty testcase fields are valid values when their Case tab exists; they do not
  erase successfully captured sibling cases.
- No path may silently drop captured tabs, parameters, or trailing text.

## Network Run Policy

The Run request contains only the executed `data_input`, so it cannot establish
the full case collection.

- A Run triggers a fresh DOM traversal.
- Its code and language fields may update the snapshot metadata.
- Its single `data_input` may be used only when no Case tabs exist and no complete
  DOM collection is available.
- It must never replace a complete multi-case cache with one case.

## Interfaces

The external contracts remain stable:

- `Snapshot.cases` stays an ordered `string[]`.
- Each case remains a newline-separated collection of parameter values.
- `Snapshot.captureError` remains optional.
- The panel's case switcher and `clampCaseIndex` behavior remain unchanged.
- `buildPanes` continues receiving exactly one case at a time.

The aggregate `groupTestCases(buffer, caseCount, paramCount)` API will be removed
from page capture. If no other production caller remains, it and obsolete tests
will be deleted rather than retained as a misleading fallback.

## Testing

Implementation follows test-driven development. Regression coverage will include:

- three one-parameter cases captured in DOM order;
- three multi-parameter cases captured without global count arithmetic;
- only the selected case mounted at a time;
- delayed input replacement after a tab click;
- original selection restored after success, failure, and cancellation;
- overlapping refreshes publishing only the newest complete traversal;
- unrelated and duplicate CodeMirror editors ignored;
- textarea-backed testcase fields;
- no tabs with one structurally owned testcase;
- a missing or unresponsive Case tab preserving the last complete cache;
- route changes clearing the cache;
- Run requests never collapsing a multi-case collection;
- pretty-printed arrays and escaped quotes within a parameter editor;
- malformed delimiters producing diagnostics without losing sibling cases.

Focused injection and parser tests will run first, followed by the complete test
suite, typecheck, and production build.

## Scope

This revamp is limited to testcase collection, per-case value scanning, cache
coordination, and their tests. It will not redesign the panel, graph rendering,
structure selection, or signature detection. Existing uncommitted user changes
will be preserved and edited incrementally.
