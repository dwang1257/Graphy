import { render } from "preact";
import { App } from "./App.js";
import "./tokens.css";
import "./styles.css";

render(<App />, document.getElementById("app")!);
