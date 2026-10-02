import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT_FILES = new Set(["injected.js", "manifest.json", "service-worker-loader.js", "src/panel/index.html"]);
const ICON_PATTERN = /^icons\/icon(?:16|32|48|128)\.png$/;
const WORKER_PATTERN = /^service-worker\.ts-[^/]+\.js$/;
const ASSET_PATTERN = /^assets\/[^/]+\.(?:css|js|wasm|woff2?|ttf|otf)$/;
const DEVELOPMENT_PATTERN = /(?:^|[._-])(?:test|spec)(?:[._-]|$)/i;
const FILE_REFERENCE_PATTERN = /^[A-Za-z0-9._/-]+\.(?:css|html|js|json|png|svg|wasm|woff2?|ttf|otf)$/i;
const TEXT_PATTERN = /\.(?:css|html|js|json)$/i;

function normalizePath(filePath) {
  return filePath.split(sep).join("/").replace(/^\.\//, "");
}

export function selectReleaseFiles(filePaths) {
  return [...new Set(filePaths.map(normalizePath))]
    .filter((filePath) => filePath.split("/").every((part) => !part.startsWith(".")))
    .filter((filePath) => !filePath.split("/").includes("node_modules"))
    .filter((filePath) => !filePath.endsWith(".map"))
    .filter((filePath) => !DEVELOPMENT_PATTERN.test(filePath.split("/").at(-1) ?? ""))
    .filter((filePath) => ROOT_FILES.has(filePath) || ICON_PATTERN.test(filePath) || WORKER_PATTERN.test(filePath) || ASSET_PATTERN.test(filePath))
    .sort();
}

function listFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    const relativePath = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) return listFiles(path, relativePath);
    return [relativePath];
  });
}

export function collectReleaseFiles(distDirectory) {
  const candidates = new Set(selectReleaseFiles(listFiles(distDirectory)));
  const selected = new Set();
  const pending = ["manifest.json"];

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!filePath || selected.has(filePath) || !candidates.has(filePath)) continue;
    selected.add(filePath);
    if (!TEXT_PATTERN.test(filePath)) continue;
    const source = readFileSync(join(distDirectory, filePath), "utf8");
    for (const reference of runtimeReferences(source, filePath)) {
      pending.push(...referencedCandidates(distDirectory, candidates, reference, filePath));
    }
  }

  return [...selected].sort();
}

function referencedCandidates(distDirectory, candidates, reference, filePath) {
  if (reference.includes("*")) {
    const matches = [...candidates].filter((candidate) => matchesWildcard(reference, candidate));
    if (matches.length === 0) throw missingReference(reference, filePath);
    return matches;
  }
  if (!FILE_REFERENCE_PATTERN.test(reference)) return [];
  if (!existsSync(join(distDirectory, reference))) throw missingReference(reference, filePath);
  if (!candidates.has(reference)) {
    throw new Error(`Local runtime file "${reference}" referenced by ${filePath} is outside deterministic release candidates`);
  }
  return [reference];
}

function missingReference(reference, filePath) {
  return new Error(`Missing local runtime file "${reference}" referenced by ${filePath}`);
}

function matchesWildcard(reference, candidate) {
  const pattern = new RegExp(`^${reference.split("*").map(escapeRegExp).join(".*")}$`);
  return pattern.test(candidate);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runtimeReferences(source, filePath) {
  const references = new Set();
  const pattern = /(?:^|["'`\s(])\/?((?:assets|icons|src\/panel)\/[^"'`\s)<>]+|(?:manifest\.json|injected\.js|service-worker-loader\.js))/g;
  for (const match of source.matchAll(pattern)) {
    const reference = match[1]?.replace(/[?#].*$/, "");
    if (reference) references.add(reference);
  }
  const relativePattern = /(?:^|["'`(])\.\/([^"'`\s)<>]+)/g;
  for (const match of source.matchAll(relativePattern)) {
    const reference = match[1]?.replace(/[?#].*$/, "");
    if (reference) references.add(normalizePath(join(dirname(filePath), reference)));
  }
  return references;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  const output = Buffer.alloc(2);
  output.writeUInt16LE(value, 0);
  return output;
}

function uint32(value) {
  const output = Buffer.alloc(4);
  output.writeUInt32LE(value, 0);
  return output;
}

function zipFile(distDirectory, filePath, offset) {
  const name = Buffer.from(filePath);
  const data = readFileSync(join(distDirectory, filePath));
  const compressed = deflateRawSync(data, { level: 9 });
  const checksum = crc32(data);
  const header = Buffer.concat([
    uint32(0x04034b50),
    uint16(20),
    uint16(0),
    uint16(8),
    uint16(0),
    uint16(33),
    uint32(checksum),
    uint32(compressed.length),
    uint32(data.length),
    uint16(name.length),
    uint16(0),
    name,
    compressed,
  ]);
  const central = Buffer.concat([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(0),
    uint16(8),
    uint16(0),
    uint16(33),
    uint32(checksum),
    uint32(compressed.length),
    uint32(data.length),
    uint16(name.length),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(offset),
    name,
  ]);
  return { header, central };
}

export function createReleaseZip(distDirectory, outputPath) {
  const files = collectReleaseFiles(distDirectory);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const filePath of files) {
    const entry = zipFile(distDirectory, filePath, offset);
    localParts.push(entry.header);
    centralParts.push(entry.central);
    offset += entry.header.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(central.length),
    uint32(offset),
    uint16(0),
  ]);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.concat([...localParts, central, end]));
  return { outputPath, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const distDirectory = resolve("dist");
  const packagePath = resolve("release", `graphy-v${JSON.parse(readFileSync("package.json", "utf8")).version}.zip`);
  const result = createReleaseZip(distDirectory, packagePath);
  process.stdout.write(`Packaged ${result.files.length} files at ${relative(process.cwd(), result.outputPath)}\n`);
}
