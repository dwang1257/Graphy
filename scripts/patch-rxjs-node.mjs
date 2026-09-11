/**
 * RxJS 7's `exports["."].node` points at `dist/cjs` (~250 circular files).
 * Node's ESM↔CJS interop can deadlock on that graph, which stalls
 * `@crxjs/vite-plugin` and therefore `vite build`. Use the single-file UMD
 * bundle instead. The ESM build is unusable from Node (extensionless dirs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const NODE_ENTRY = "./dist/bundles/rxjs.umd.js";
const require = createRequire(import.meta.url);

let pkgPath;
try {
  pkgPath = require.resolve("rxjs/package.json");
} catch {
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const main = pkg.exports?.["."];
if (!main || typeof main !== "object" || main.node === NODE_ENTRY) {
  process.exit(0);
}

main.node = NODE_ENTRY;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
