import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

const SITES = ["https://leetcode.com/*", "https://leetcode.cn/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Graphy - LeetCode Graph Visualizer",
  version: pkg.version,
  description: "LeetCode Graph Visualizer: turn test cases into binary trees, linked lists, and graphs, then watch your solution run step by step.",
  permissions: ["storage"],
  action: { default_title: "Toggle Graphy" },
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
  web_accessible_resources: [
    {
      resources: ["injected.js", "src/panel/index.html"],
      matches: SITES,
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'",
  },
});
