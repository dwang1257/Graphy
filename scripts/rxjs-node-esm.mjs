/**
 * Same-thread fallback if RxJS still exposes its circular CJS Node export.
 * `registerHooks` is synchronous; `module.register()` is not and can deadlock.
 */
import { createRequire, registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const rxjsUrl = pathToFileURL(
  join(dirname(require.resolve("rxjs/package.json")), "dist/bundles/rxjs.umd.js"),
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "rxjs") {
      return {
        shortCircuit: true,
        url: rxjsUrl,
        format: "commonjs",
      };
    }
    return nextResolve(specifier, context);
  },
});
