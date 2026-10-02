import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

/**
 * @crxjs/vite-plugin ESM-imports RxJS. RxJS 7's Node export is a ~250-file
 * circular CJS graph; loading that from ESM deadlocks `vite build`.
 */
test("@crxjs/vite-plugin imports without hanging on RxJS CJS", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const crx = await import("@crxjs/vite-plugin");
       if (typeof crx.crx !== "function") throw new Error("missing crx");
       console.log("ok");`,
    ],
    { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL" },
  );

  assert.equal(result.signal, null, "import hung");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /ok/);
});
