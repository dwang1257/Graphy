import { installChromeShim } from "./chromeShim.js";
import { installFetchShim } from "./fetchShim.js";

installChromeShim();
installFetchShim();

const [{ render }, { App }] = await Promise.all([import("preact"), import("../src/panel/App.js")]);
await import("../src/panel/tokens.css");
await import("../src/panel/styles.css");

const root = document.getElementById("app");
if (root) render(<App />, root);
