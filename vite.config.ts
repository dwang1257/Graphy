import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { crx } from "@crxjs/vite-plugin";
import preact from "@preact/preset-vite";
import { build } from "esbuild";
import manifest from "./manifest.config.js";

/**
 * The page-world script must be a standalone IIFE served from
 * web_accessible_resources, so it is bundled outside the extension graph.
 */
function pageWorldBundle(): Plugin {
  return {
    name: "graphy:page-world",
    async buildStart() {
      await build({
        entryPoints: ["src/main-world/inject.ts"],
        outfile: "public/injected.js",
        bundle: true,
        format: "iife",
        target: "chrome110",
        minify: process.env.NODE_ENV === "production",
        legalComments: "none",
        logLevel: "warning",
      });
    },
  };
}

export default defineConfig({
  plugins: [preact(), pageWorldBundle(), crx({ manifest })],
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
  },
  build: {
    target: "chrome110",
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
      // The panel is only referenced from web_accessible_resources, so CRXJS
      // does not pick it up as an entry on its own.
      input: { panel: "src/panel/index.html" },
      output: { chunkFileNames: "assets/[name]-[hash].js" },
    },
  },
});
