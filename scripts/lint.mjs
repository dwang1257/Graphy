import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const roots = ["src", "manifest.config.ts", "vite.config.ts"];
const extensions = new Set([".mjs", ".ts", ".tsx"]);
const rules = [
  [/[ \t]+$/, "trailing whitespace"],
  [/\bdebugger\b/, "debugger statement"],
  [/console\.log\s*\(/, "console.log is not allowed"],
];
const violations = [];

function filesAt(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => filesAt(join(path, entry.name)));
}

for (const path of roots.flatMap(filesAt)) {
  if (!extensions.has(extname(path))) continue;
  readFileSync(path, "utf8").split("\n").forEach((line, index) => {
    for (const [pattern, message] of rules) {
      if (pattern.test(line)) violations.push(`${relative(process.cwd(), path)}:${index + 1}: ${message}`);
    }
  });
}

if (violations.length > 0) {
  process.stderr.write(`${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Lint passed\n");
}
