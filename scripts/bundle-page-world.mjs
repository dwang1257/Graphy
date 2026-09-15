import { buildSync } from "esbuild";

/**
 * The page-world script must be a standalone IIFE. Use esbuild's one-shot
 * sync API so this tiny bundle does not attach to a process-global service.
 */
export function bundlePageWorld() {
  buildSync({
    entryPoints: ["src/main-world/inject.ts"],
    outfile: "public/injected.js",
    bundle: true,
    format: "iife",
    target: "chrome110",
    minify: process.env.NODE_ENV === "production",
    legalComments: "none",
    logLevel: "warning",
  });
}
