import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import preact from "@preact/preset-vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const realParentOrigin = resolve(rootDir, "src/panel/parentOrigin.ts");
const harnessParentOrigin = resolve(rootDir, "harness/parentOrigin.ts");

function harnessParentOriginPlugin(): Plugin {
  return {
    name: "graphy-harness:parent-origin",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || importer === harnessParentOrigin || !source.includes("parentOrigin")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved?.id === realParentOrigin ? harnessParentOrigin : null;
    },
  };
}

function harnessIndexPlugin(): Plugin {
  return {
    name: "graphy-harness:index",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        if (url === "/" || url.startsWith("/?")) req.url = `/harness/index.html${url.slice(1)}`;
        next();
      });
    },
  };
}

export default defineConfig({
  root: rootDir,
  cacheDir: "node_modules/.vite-harness",
  plugins: [harnessParentOriginPlugin(), harnessIndexPlugin(), preact()],
  oxc: {
    jsx: { runtime: "automatic", importSource: "preact" },
  },
  server: {
    port: 5199,
    strictPort: true,
  },
  build: {
    outDir: "node_modules/.harness-dist",
  },
});
