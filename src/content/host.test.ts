import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PANEL_CHANNEL, type Snapshot, type ToPanel } from "../shared/protocol.js";

vi.mock("../settings/storage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../settings/storage.js")>();
  return {
    ...actual,
    loadPanelState: () => Promise.resolve({ ...actual.DEFAULT_PANEL, open: false }),
    savePanelState: () => Promise.resolve(),
  };
});

const { PanelHost, queuePanelMessage } = await import("./host.js");

const FRAME_URL = "chrome-extension://graphy/src/panel/index.html";

const snapshot = (at: number): Snapshot => ({ cases: ["[1]"], code: "", lang: "cpp", slug: "two-sum", source: "editor", at });

let dom: Window;

beforeEach(() => {
  dom = new Window({ settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } });
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("MessageEvent", dom.MessageEvent);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await dom.happyDOM.close();
});

async function readyHost() {
  const attachShadow = HTMLElement.prototype.attachShadow;
  let root: ShadowRoot | undefined;
  const spy = vi.spyOn(HTMLElement.prototype, "attachShadow").mockImplementation(function (this: HTMLElement, init) {
    root = attachShadow.call(this, init);
    return root;
  });
  const host = new PanelHost(FRAME_URL);
  spy.mockRestore();
  await host.restored;
  const frame = root?.querySelector("iframe");
  if (!frame?.contentWindow) throw new Error("no frame window");
  const delivered: ToPanel[] = [];
  vi.spyOn(frame.contentWindow, "postMessage").mockImplementation((message: unknown) => {
    delivered.push(message as ToPanel);
  });
  const signalReady = () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { channel: PANEL_CHANNEL, type: "ready" },
        origin: "chrome-extension://graphy",
        source: frame.contentWindow,
      }),
    );
  return { host, delivered, signalReady };
}

test("a clear queued after a snapshot wins when the panel becomes ready", async () => {
  const { host, delivered, signalReady } = await readyHost();
  host.send({ channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot(1) });
  host.send({ channel: PANEL_CHANNEL, type: "clear" });
  signalReady();
  expect(delivered.map((message) => message.type)).toEqual(["clear", "shrunk"]);
  host.destroy();
});

test("the latest snapshot queued after a clear is replayed without blanking the panel", async () => {
  const { host, delivered, signalReady } = await readyHost();
  host.send({ channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot(1) });
  host.send({ channel: PANEL_CHANNEL, type: "clear" });
  host.send({ channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot(2) });
  signalReady();
  expect(delivered).toEqual([
    { channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot(2) },
    { channel: PANEL_CHANNEL, type: "shrunk", shrunk: false },
  ]);
  host.destroy();
});

test("queues shrink state separately from panel content", () => {
  const pending = new Map<string, ToPanel>();
  queuePanelMessage(pending, { channel: PANEL_CHANNEL, type: "clear" });
  queuePanelMessage(pending, { channel: PANEL_CHANNEL, type: "shrunk", shrunk: true });
  queuePanelMessage(pending, { channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot(3) });
  expect([...pending.values()].map((message) => message.type)).toEqual(["snapshot", "shrunk"]);
});
