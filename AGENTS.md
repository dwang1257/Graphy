# Repository Guidelines

## Project Structure & Module Organization

Graphy is a Manifest V3 Chrome extension built with TypeScript, Preact, Vite, and Graphviz.
Core parsing, graph construction, topology, and trace logic live in `src/core/`.
The extension panel UI is in `src/panel/`, while LeetCode integration is split across `src/content/`, `src/main-world/`, and `src/background/`.
Shared message types belong in `src/shared/`, and persisted preferences belong in `src/settings/`.
Static icons live in `public/icons/`; maintenance scripts live in `scripts/`.
Treat `dist/` and packaged `.zip` files as generated release artifacts rather than source.

## Build, Test, and Development Commands

- `npm install` installs dependencies and applies the required RxJS patch.
- `npm run dev` starts Vite for local extension development.
- `npm run build` creates the production extension bundle in `dist/`.
- `npm test` verifies the RxJS import patch, then runs the Vitest suite once.
- `npm run typecheck` runs strict TypeScript checks without emitting files.

Load the unpacked `dist/` directory in a Chromium browser after building when validating full extension behavior.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, and ES modules, matching the existing TypeScript and TSX files.
Keep TypeScript strict and preserve `noUncheckedIndexedAccess`; narrow uncertain values instead of using broad casts.
Name Preact components in PascalCase, hooks with a `use` prefix, and functions or modules in camelCase.
Keep domain logic independent of browser and UI code where practical.
Do not manually edit generated bundles or packaged releases.

## Testing Guidelines

Vitest is the primary test framework, with Happy DOM available for component and DOM behavior.
Place tests beside their implementation as `name.test.ts` or `Component.test.tsx`.
Add focused regression coverage for bug fixes and test boundary cases for parsers, graph topology, traces, storage, and protocol changes.
Before submitting, run `npm test`, `npm run typecheck`, and `npm run build`.
For user-facing changes, also exercise the extension on a representative LeetCode problem.

## Commit & Pull Request Guidelines

Follow the repository’s concise conventional style: `feat:`, `fix:`, or `chore:` followed by an imperative summary.
Keep commits scoped to one coherent change and exclude local files such as `.DS_Store`.
Pull requests should explain the user-visible outcome, note important implementation choices, link relevant issues, and list verification performed.
Include screenshots or recordings for panel layout, styling, graph rendering, or trace playback changes.
