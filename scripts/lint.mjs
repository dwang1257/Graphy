import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "manifest.config.ts", "vite.config.ts"];
const extensions = new Set([".mjs", ".ts", ".tsx"]);
const violations = [];

function filesAt(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => filesAt(join(path, entry.name)));
}

for (const root of roots) {
  for (const path of filesAt(root)) {
    if (!extensions.has(path.slice(path.lastIndexOf(".")))) continue;
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) violations.push(`${relative(process.cwd(), path)}:${index + 1}: trailing whitespace`);
      if (/\bdebugger\b/.test(line)) violations.push(`${relative(process.cwd(), path)}:${index + 1}: debugger statement`);
      if (/console\.log\s*\(/.test(line)) violations.push(`${relative(process.cwd(), path)}:${index + 1}: console.log is not allowed`);
    });
  }
}

if (violations.length > 0) {
  process.stderr.write(`${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Lint passed\n");
}
