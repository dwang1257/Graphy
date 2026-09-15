/**
 * iCloud Desktop evicts node_modules to dataless placeholders. Vite then hangs
 * before printing a startup line while each CRXJS/RxJS file is downloaded.
 * Folders named *.nosync are not synced, so packages stay on disk.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { pathToFileURL } from "node:url";

const NOSYNC_NAME = "node_modules.nosync";
const TRASH_NAME = "node_modules.icloud-trash";
const DATALESS_MESSAGE =
  "Graphy's node_modules is stored as iCloud placeholders, so Vite hangs while macOS downloads each file.\n" +
  "Run: npm install\n" +
  "Graphy keeps packages in node_modules.nosync, which iCloud does not evict.";

export function nodeModulesLayout(root) {
  return {
    modules: join(root, "node_modules"),
    nosync: join(root, NOSYNC_NAME),
  };
}

export function pathIsCloudSynced(absPath) {
  if (platform() !== "darwin") return false;
  let current = resolve(absPath);
  for (;;) {
    try {
      const value = execFileSync(
        "xattr",
        ["-p", "com.apple.file-provider-domain-id", current],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      if (value.includes("iCloud")) return true;
    } catch {
      // This level is not a File Provider domain root.
    }
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function walkFiles(dir, visit) {
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isSymbolicLink()) continue;
      if (visit(full) === true) return true;
    }
  }
  return false;
}

function darwinHasDatalessFiles(dir) {
  if (platform() !== "darwin") return false;
  try {
    const out = execFileSync(
      "find",
      [dir, "-flags", "+dataless", "-print", "-quit"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export function directoryHasDatalessFiles(dir, isDataless) {
  if (!existsSync(dir)) return false;
  if (typeof isDataless === "function") {
    return walkFiles(dir, (filePath) => isDataless(filePath));
  }
  return darwinHasDatalessFiles(dir);
}

function quarantine(dir, root) {
  const trash = join(root, TRASH_NAME);
  if (existsSync(trash)) rmSync(trash, { recursive: true, force: true });
  renameSync(dir, trash);
}

function linkNosync(modules, nosync) {
  mkdirSync(nosync, { recursive: true });
  rmSync(modules, { recursive: true, force: true });
  symlinkSync(NOSYNC_NAME, modules);
}

function alreadyLinked(modules, nosync) {
  try {
    if (!lstatSync(modules).isSymbolicLink()) return false;
    const target = readlinkSync(modules);
    return target === NOSYNC_NAME || resolve(dirname(modules), target) === nosync;
  } catch {
    return false;
  }
}

function inspectDir(root) {
  const { modules, nosync } = nodeModulesLayout(root);
  if (alreadyLinked(modules, nosync)) return nosync;
  return modules;
}

export function checkLocalNodeModules(root = process.cwd(), options = {}) {
  if (directoryHasDatalessFiles(inspectDir(root), options.isDataless)) {
    return { ok: false, message: DATALESS_MESSAGE };
  }
  return { ok: true, message: "" };
}

export function ensureLocalNodeModules(root = process.cwd(), options = {}) {
  const cloudSynced = options.cloudSynced ?? pathIsCloudSynced(root);
  const { modules, nosync } = nodeModulesLayout(root);

  if (alreadyLinked(modules, nosync)) {
    if (directoryHasDatalessFiles(nosync, options.isDataless)) {
      quarantine(nosync, root);
      linkNosync(modules, nosync);
      return { action: "replaced-dataless", needsInstall: true };
    }
    return { action: "already-linked", needsInstall: false };
  }

  if (existsSync(modules) && lstatSync(modules).isDirectory()) {
    if (directoryHasDatalessFiles(modules, options.isDataless)) {
      quarantine(modules, root);
      if (existsSync(nosync)) rmSync(nosync, { recursive: true, force: true });
      linkNosync(modules, nosync);
      return { action: "replaced-dataless", needsInstall: true };
    }
    if (!cloudSynced) {
      return { action: "skipped", needsInstall: false };
    }
    if (existsSync(nosync)) rmSync(nosync, { recursive: true, force: true });
    renameSync(modules, nosync);
    symlinkSync(NOSYNC_NAME, modules);
    return { action: "relocated", needsInstall: false };
  }

  if (!cloudSynced) {
    return { action: "skipped", needsInstall: false };
  }

  rmSync(modules, { recursive: true, force: true });
  linkNosync(modules, nosync);
  return { action: "created", needsInstall: false };
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

function cliOptions() {
  return {
    isDataless: process.env.GRAPHY_FORCE_DATALESS === "1" ? () => true : undefined,
  };
}

if (isMain()) {
  const root = process.env.GRAPHY_NODE_MODULES_ROOT || process.cwd();
  if (process.argv.includes("--check")) {
    const result = checkLocalNodeModules(root, cliOptions());
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
  } else {
    const result = ensureLocalNodeModules(root, {
      ...cliOptions(),
      cloudSynced:
        process.env.GRAPHY_FORCE_CLOUD === "1" ? true : pathIsCloudSynced(root),
    });
    if (result.action === "replaced-dataless") {
      console.error(
        "Graphy: node_modules was iCloud placeholders; installing into node_modules.nosync.",
      );
    }
  }
}
