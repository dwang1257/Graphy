/**
 * iCloud Desktop evicts node_modules to dataless placeholders. Vite then hangs
 * before printing a startup line while each CRXJS/RxJS file is downloaded.
 * Folders named *.nosync are not synced, so packages stay on disk.
 */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join, resolve } from "node:path";

const NOSYNC_NAME = "node_modules.nosync";
const DATALESS_MESSAGE =
  "Graphy's node_modules is stored as iCloud placeholders, so Vite hangs while macOS downloads each file.\n" +
  "Run: npm install\n" +
  "Graphy keeps packages in node_modules.nosync, which iCloud does not evict.";

const root = resolve(process.env.GRAPHY_NODE_MODULES_ROOT || process.cwd());
const forceDataless = process.env.GRAPHY_FORCE_DATALESS === "1";
const modules = join(root, "node_modules");
const nosync = join(root, NOSYNC_NAME);
const trash = join(root, "node_modules.icloud-trash");

function capture(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function isCloudSynced() {
  if (process.env.GRAPHY_FORCE_CLOUD === "1") return true;
  if (platform() !== "darwin") return false;
  for (let current = root; ; current = dirname(current)) {
    if (capture("xattr", ["-p", "com.apple.file-provider-domain-id", current]).includes("iCloud")) return true;
    if (dirname(current) === current) return false;
  }
}

function hasDatalessFiles(dir) {
  if (!existsSync(dir)) return false;
  if (forceDataless) return capture("find", [dir, "-type", "f", "-print", "-quit"]).trim().length > 0;
  if (platform() !== "darwin") return false;
  return capture("find", [dir, "-flags", "+dataless", "-print", "-quit"]).trim().length > 0;
}

function isLinked() {
  try {
    return lstatSync(modules).isSymbolicLink() && resolve(root, readlinkSync(modules)) === nosync;
  } catch {
    return false;
  }
}

function isRealDirectory(path) {
  return existsSync(path) && lstatSync(path).isDirectory();
}

function quarantine(dir) {
  rmSync(trash, { recursive: true, force: true });
  renameSync(dir, trash);
}

function linkNosync() {
  mkdirSync(nosync, { recursive: true });
  rmSync(modules, { recursive: true, force: true });
  symlinkSync(NOSYNC_NAME, modules);
}

function reportReplaced() {
  console.error("Graphy: node_modules was iCloud placeholders; installing into node_modules.nosync.");
}

function ensure() {
  if (isLinked()) {
    if (!hasDatalessFiles(nosync)) return;
    quarantine(nosync);
    linkNosync();
    reportReplaced();
    return;
  }

  if (isRealDirectory(modules)) {
    if (hasDatalessFiles(modules)) {
      quarantine(modules);
      rmSync(nosync, { recursive: true, force: true });
      linkNosync();
      reportReplaced();
      return;
    }
    if (!isCloudSynced()) return;
    rmSync(nosync, { recursive: true, force: true });
    renameSync(modules, nosync);
    symlinkSync(NOSYNC_NAME, modules);
    return;
  }

  if (!isCloudSynced()) return;
  linkNosync();
}

if (process.argv.includes("--check")) {
  if (hasDatalessFiles(isLinked() ? nosync : modules)) {
    console.error(DATALESS_MESSAGE);
    process.exit(1);
  }
} else {
  ensure();
}
