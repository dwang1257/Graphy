# Graphy Release Hardening

## Objective

Make the Chrome Web Store release candidate safe, bounded, navigationally correct, accessible, disclosed, and reproducibly packageable.

## Workstream 1: Page lifecycle and testcase capture

- Add an initial testcase-tab scan when a problem page becomes ready.
- Preserve testcase scanning after every completed Run response.
- Gate page-world network hooks to LeetCode problem routes and deactivate them after SPA navigation away.
- Correlate Run and result responses without shared mutable run state.
- Clear stale panel state when the problem slug changes.
- Add focused tests for initial capture, activation, navigation, concurrent runs, and empty testcases.

## Workstream 2: Protocol, parser, state, and error hardening

- Bound cross-context messages, testcase payloads, stdout, and trace events.
- Reject oversized or malformed inputs before expensive parser work.
- Remove quadratic tree-model construction.
- Report syntax failures and unreachable tree values as user-visible case failures.
- Validate persisted enum and boolean settings.
- Reset structure overrides per problem and guard Graphviz morph completions against stale frames.
- Render valid empty structures explicitly and clear stale Graphviz errors.
- Add regression and boundary tests before implementation changes.

## Workstream 3: UX, privacy, and release packaging

- Bound image uploads and surface readable upload errors.
- Add keyboard and dialog accessibility behavior.
- Make testcase navigation keyboard-friendly with correct state semantics.
- Add a visible privacy/data-use disclosure aligned with the implementation and update privacy documentation.
- Narrow web-accessible resources.
- Add lint and deterministic release packaging scripts that exclude development and hidden files.
- Add packaging tests and verify the final ZIP contents.

## Verification

- Run the focused red and green tests for each workstream.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run package`.
- Inspect the generated manifest and ZIP file contents.
- Verify no generated artifacts or unrelated files are committed.
