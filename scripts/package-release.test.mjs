import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectReleaseFiles, selectReleaseFiles } from "./package-release.mjs";

test("selectReleaseFiles keeps only deterministic extension runtime files", () => {
  const selected = selectReleaseFiles([
    "manifest.json",
    "injected.js",
    "service-worker-loader.js",
    "service-worker.ts-123.js",
    "src/panel/index.html",
    "icons/icon16.png",
    "assets/panel-123.js",
    "assets/panel-123.css",
    "assets/panel-123.js.map",
    "assets/feature.test.js",
    "docs/notes.md",
    ".DS_Store",
    "assets/.hidden.js",
    "node_modules/preact/index.js",
  ]);

  assert.deepEqual(selected, [
    "assets/panel-123.css",
    "assets/panel-123.js",
    "icons/icon16.png",
    "injected.js",
    "manifest.json",
    "service-worker-loader.js",
    "service-worker.ts-123.js",
    "src/panel/index.html",
  ]);
});

test("collectReleaseFiles follows runtime references and excludes stale assets", () => {
  const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
  mkdirSync(join(distDirectory, "assets"));
  mkdirSync(join(distDirectory, "icons"));
  mkdirSync(join(distDirectory, "src", "panel"), { recursive: true });
  writeFileSync(join(distDirectory, "manifest.json"), JSON.stringify({
    icons: { 16: "icons/icon16.png" },
    content_scripts: [{ js: ["assets/content-loader.js"] }],
    background: { service_worker: "service-worker-loader.js" },
    web_accessible_resources: [{ resources: ["src/panel/index.html"] }],
  }));
  writeFileSync(join(distDirectory, "service-worker-loader.js"), "import './assets/worker.js';");
  writeFileSync(join(distDirectory, "assets", "content-loader.js"), "import './content.js';");
  writeFileSync(join(distDirectory, "assets", "content.js"), "import './protocol.js';");
  writeFileSync(join(distDirectory, "assets", "worker.js"), "self.oninstall = () => {};" );
  writeFileSync(join(distDirectory, "assets", "protocol.js"), "export const protocol = true;");
  writeFileSync(join(distDirectory, "assets", "stale.js"), "export const stale = true;");
  writeFileSync(join(distDirectory, "assets", "panel.js"), "export const panel = true;");
  writeFileSync(join(distDirectory, "src", "panel", "index.html"), "<script type=\"module\" src=\"/assets/panel.js\"></script>");
  writeFileSync(join(distDirectory, "icons", "icon16.png"), "icon");

  assert.deepEqual(collectReleaseFiles(distDirectory), [
    "assets/content-loader.js",
    "assets/content.js",
    "assets/panel.js",
    "assets/protocol.js",
    "assets/worker.js",
    "icons/icon16.png",
    "manifest.json",
    "service-worker-loader.js",
    "src/panel/index.html",
  ]);
});

test("collectReleaseFiles rejects missing local references from manifest HTML and JavaScript", () => {
  const cases = [
    {
      manifest: { content_scripts: [{ js: ["assets/missing.js"] }] },
      files: [],
      source: "manifest.json",
    },
    {
      manifest: { web_accessible_resources: [{ resources: ["src/panel/index.html"] }] },
      files: [["src/panel/index.html", "<script src=\"/assets/missing.js\"></script>"]],
      source: "src/panel/index.html",
    },
    {
      manifest: { background: { service_worker: "service-worker-loader.js" } },
      files: [["service-worker-loader.js", "import './assets/missing.js';"]],
      source: "service-worker-loader.js",
    },
    {
      manifest: { web_accessible_resources: [{ resources: ["src/panel/missing.js"] }] },
      files: [],
      reference: "src/panel/missing.js",
      source: "manifest.json",
    },
    {
      manifest: { icons: { 16: "icons/missing.svg" } },
      files: [],
      reference: "icons/missing.svg",
      source: "manifest.json",
    },
  ];

  for (const testCase of cases) {
    const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
    mkdirSync(join(distDirectory, "assets"));
    mkdirSync(join(distDirectory, "src", "panel"), { recursive: true });
    writeFileSync(join(distDirectory, "manifest.json"), JSON.stringify(testCase.manifest));
    for (const [filePath, source] of testCase.files) {
      mkdirSync(join(distDirectory, filePath, ".."), { recursive: true });
      writeFileSync(join(distDirectory, filePath), source);
    }

    assert.throws(
      () => collectReleaseFiles(distDirectory),
      new RegExp(`missing local runtime file.*${testCase.reference ?? "assets/missing.js"}.*${testCase.source}`, "i"),
    );
  }
});

test("collectReleaseFiles rejects existing local references outside release candidates", () => {
  const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
  mkdirSync(join(distDirectory, "assets"));
  writeFileSync(join(distDirectory, "manifest.json"), JSON.stringify({
    web_accessible_resources: [{ resources: ["assets/feature.test.js"] }],
  }));
  writeFileSync(join(distDirectory, "assets", "feature.test.js"), "export const feature = true;");

  assert.throws(
    () => collectReleaseFiles(distDirectory),
    /assets\/feature\.test\.js.*manifest\.json.*outside deterministic release candidates/i,
  );
});

test("collectReleaseFiles ignores external and data runtime references", () => {
  const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
  mkdirSync(join(distDirectory, "src", "panel"), { recursive: true });
  writeFileSync(join(distDirectory, "manifest.json"), JSON.stringify({
    web_accessible_resources: [{ resources: ["https://cdn.example.com/assets/missing.js", "data:text/javascript,assets/missing.js"] }],
  }));

  assert.deepEqual(collectReleaseFiles(distDirectory), ["manifest.json"]);
});

test("collectReleaseFiles follows wildcard references that match release candidates", () => {
  const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
  mkdirSync(join(distDirectory, "assets"));
  writeFileSync(join(distDirectory, "manifest.json"), JSON.stringify({
    web_accessible_resources: [{ resources: ["assets/*.js"] }],
  }));
  writeFileSync(join(distDirectory, "assets", "runtime.js"), "export const runtime = true;");

  assert.deepEqual(collectReleaseFiles(distDirectory), ["assets/runtime.js", "manifest.json"]);
});

test("collectReleaseFiles rejects wildcard references without a release candidate", () => {
  const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
  mkdirSync(join(distDirectory, "assets"));
  writeFileSync(join(distDirectory, "manifest.json"), JSON.stringify({
    web_accessible_resources: [{ resources: ["assets/*.js"] }],
  }));

  assert.throws(
    () => collectReleaseFiles(distDirectory),
    /Missing local runtime file "assets\/\*\.js" referenced by manifest\.json/i,
  );
});
