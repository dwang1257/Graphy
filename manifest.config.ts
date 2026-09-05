import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

const SITES = ["https://leetcode.com/*", "https://leetcode.cn/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Graphy",
  version: pkg.version,
  description: "Renders LeetCode custom test cases as interactive graphs.",
  permissions: ["storage"],
  action: { default_title: "Toggle Graphy" },
  // Distinct basename from content/index.ts so CRXJS does not wire the
  // service worker to the content-script chunk (window is not defined).
  background: { service_worker: "src/background/service-worker.ts", type: "module" },
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  content_scripts: [
    {
      matches: SITES,
      js: ["src/content/index.ts"],
      run_at: "document_start",
    },
  ],
  // `injected.js` is bundled separately and injected into the page world at
  // runtime; the panel is an extension page loaded in an iframe.
  web_accessible_resources: [
    {
      resources: ["injected.js", "src/panel/index.html", "assets/*"],
      matches: SITES,
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com",
  },
});
