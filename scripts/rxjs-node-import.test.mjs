import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * @crxjs/vite-plugin ESM-imports RxJS. RxJS 7's Node export is a ~250-file
 * circular CJS graph; loading that from ESM deadlocks `vite build`.
 */
test("@crxjs/vite-plugin imports without hanging on RxJS CJS", async () => {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const crx = await import("@crxjs/vite-plugin");
       if (typeof crx.crx !== "function") throw new Error("missing crx");
       console.log("ok");`,
    ],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
  );

    let timeout;
    const result = await Promise.race([
      new Promise((resolve) => {
        let out = "";
        child.stdout.on("data", (chunk) => {
          out += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
          out += String(chunk);
        });
        child.on("close", (code) => resolve({ code, out }));
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("import hung"));
        }, 5000);
      }),
    ]).finally(() => clearTimeout(timeout));

  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /ok/);
});
