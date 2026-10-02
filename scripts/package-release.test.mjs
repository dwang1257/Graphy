import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { collectReleaseFiles, selectReleaseFiles } from "./package-release.mjs";

function createDist(manifest, files = {}) {
  const distDirectory = mkdtempSync(join(tmpdir(), "graphy-release-"));
  for (const [filePath, contents] of Object.entries({ "manifest.json": JSON.stringify(manifest), ...files })) {
    mkdirSync(dirname(join(distDirectory, filePath)), { recursive: true });
    writeFileSync(join(distDirectory, filePath), contents);
  }
  return distDirectory;
}

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
  const distDirectory = createDist(
    {
      icons: { 16: "icons/icon16.png" },
      content_scripts: [{ js: ["assets/content-loader.js"] }],
      background: { service_worker: "service-worker-loader.js" },
      web_accessible_resources: [{ resources: ["src/panel/index.html"] }],
    },
    {
      "service-worker-loader.js": "import './assets/worker.js';",
      "assets/content-loader.js": "import './content.js';",
      "assets/content.js": "import './protocol.js';",
      "assets/worker.js": "self.oninstall = () => {};",
      "assets/protocol.js": "export const protocol = true;",
      "assets/stale.js": "export const stale = true;",
      "assets/panel.js": "export const panel = true;",
      "src/panel/index.html": "<script type=\"module\" src=\"/assets/panel.js\"></script>",
      "icons/icon16.png": "icon",
    },
  );

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

test("collectReleaseFiles follows font references from stylesheets", () => {
  const distDirectory = createDist(
    { web_accessible_resources: [{ resources: ["src/panel/index.html"] }] },
    {
      "src/panel/index.html": "<link rel=\"stylesheet\" href=\"/assets/panel.css\">",
      "assets/panel.css":
        "@font-face{src:url(/assets/inter-latin.woff2) format(\"woff2\")}@font-face{src:url(./mono-latin.woff2)}",
      "assets/inter-latin.woff2": Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff]),
      "assets/mono-latin.woff2": Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0xfe]),
      "assets/unused.woff2": Buffer.from([0x77, 0x4f, 0x46, 0x32]),
    },
  );

  assert.deepEqual(collectReleaseFiles(distDirectory), [
    "assets/inter-latin.woff2",
    "assets/mono-latin.woff2",
    "assets/panel.css",
    "manifest.json",
    "src/panel/index.html",
  ]);
});

test("collectReleaseFiles rejects missing local references from manifest HTML and JavaScript", () => {
  const cases = [
    {
      manifest: { content_scripts: [{ js: ["assets/missing.js"] }] },
      source: "manifest.json",
    },
    {
      manifest: { web_accessible_resources: [{ resources: ["src/panel/index.html"] }] },
      files: { "src/panel/index.html": "<script src=\"/assets/missing.js\"></script>" },
      source: "src/panel/index.html",
    },
    {
      manifest: { background: { service_worker: "service-worker-loader.js" } },
      files: { "service-worker-loader.js": "import './assets/missing.js';" },
      source: "service-worker-loader.js",
    },
    {
      manifest: { web_accessible_resources: [{ resources: ["src/panel/missing.js"] }] },
      reference: "src/panel/missing.js",
      source: "manifest.json",
    },
    {
      manifest: { icons: { 16: "icons/missing.svg" } },
      reference: "icons/missing.svg",
      source: "manifest.json",
    },
  ];

  for (const testCase of cases) {
    const distDirectory = createDist(testCase.manifest, testCase.files);
    assert.throws(
      () => collectReleaseFiles(distDirectory),
      new RegExp(`missing local runtime file.*${testCase.reference ?? "assets/missing.js"}.*${testCase.source}`, "i"),
    );
  }
});

test("collectReleaseFiles rejects existing local references outside release candidates", () => {
  const distDirectory = createDist(
    { web_accessible_resources: [{ resources: ["assets/feature.test.js"] }] },
    { "assets/feature.test.js": "export const feature = true;" },
  );

  assert.throws(
    () => collectReleaseFiles(distDirectory),
    /assets\/feature\.test\.js.*manifest\.json.*outside deterministic release candidates/i,
  );
});

test("collectReleaseFiles ignores external and data runtime references", () => {
  const distDirectory = createDist({
    web_accessible_resources: [{ resources: ["https://cdn.example.com/assets/missing.js", "data:text/javascript,assets/missing.js"] }],
  });

  assert.deepEqual(collectReleaseFiles(distDirectory), ["manifest.json"]);
});

test("collectReleaseFiles ignores non-file relative runtime tokens", () => {
  const distDirectory = createDist(
    { content_scripts: [{ js: ["assets/runtime.js"] }] },
    { "assets/runtime.js": "const program = './this.program';" },
  );

  assert.deepEqual(collectReleaseFiles(distDirectory), ["assets/runtime.js", "manifest.json"]);
});

test("collectReleaseFiles follows wildcard references that match release candidates", () => {
  const distDirectory = createDist(
    { web_accessible_resources: [{ resources: ["assets/*.js"] }] },
    { "assets/runtime.js": "export const runtime = true;" },
  );

  assert.deepEqual(collectReleaseFiles(distDirectory), ["assets/runtime.js", "manifest.json"]);
});

test("collectReleaseFiles rejects wildcard references without a release candidate", () => {
  const distDirectory = createDist({ web_accessible_resources: [{ resources: ["assets/*.js"] }] });

  assert.throws(
    () => collectReleaseFiles(distDirectory),
    /Missing local runtime file "assets\/\*\.js" referenced by manifest\.json/i,
  );
});
