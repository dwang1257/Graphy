import { installChromeShim } from "./chromeShim.js";

installChromeShim();

const [{ render }, { App }] = await Promise.all([import("preact"), import("../src/panel/App.js")]);
await import("../src/panel/tokens.css");
await import("../src/panel/styles.css");

const root = document.getElementById("app");
if (root) render(<App />, root);
