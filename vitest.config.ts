import { defineConfig } from "vite";

/** Isolated from vite.config.ts so tests do not load @crxjs/vite-plugin. */
export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic", importSource: "preact" },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**", "**/scripts/**"],
    pool: "threads",
  },
});
