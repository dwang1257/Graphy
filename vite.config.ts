/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.js";

/**
 * The page-world script must be a standalone IIFE served from
 * web_accessible_resources, so it is bundled outside the extension graph.
 */
function pageWorldBundle(): Plugin {
  return {
    name: "graphy:page-world",
    async buildStart() {
      const { build } = await import("esbuild");
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

export default defineConfig(async ({ command }) => {
  const plugins: Plugin[] = [pageWorldBundle(), crx({ manifest })];
  // @preact/preset-vite pulls in Babel + fsevents on import, which can stall
  // `vite build`. Production JSX is handled by Oxc; Prefresh is only for serve.
  if (command === "serve") {
    const { default: preact } = await import("@preact/preset-vite");
    plugins.unshift(preact());
  }
  return {
    plugins,
    oxc: {
      jsx: { runtime: "automatic", importSource: "preact" },
    },
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
  };
});
