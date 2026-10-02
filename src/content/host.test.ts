import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PANEL_CHANNEL, type FromPanel, type Snapshot, type ToPanel } from "../shared/protocol.js";
import type { PanelState } from "../settings/storage.js";

const storage = vi.hoisted(() => ({
  initial: null as PanelState | null,
  saved: [] as PanelState[],
}));

vi.mock("../settings/storage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../settings/storage.js")>();
  return {
    ...actual,
    loadPanelState: () => Promise.resolve(storage.initial ?? { ...actual.DEFAULT_PANEL, open: false }),
    savePanelState: (state: PanelState) => {
      storage.saved.push({ ...state });
      return Promise.resolve();
    },
  };
});

const { PanelHost, queuePanelMessage } = await import("./host.js");

const FRAME_URL = "chrome-extension://graphy/src/panel/index.html";

const snapshot = (at: number): Snapshot => ({ cases: ["[1]"], code: "", lang: "cpp", slug: "two-sum", source: "editor", at });

let dom: Window;
let frames: Array<FrameRequestCallback | undefined>;

function runFrame(): void {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback?.(0);
}

beforeEach(() => {
  dom = new Window({
    width: 1200,
    height: 800,
    settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true },
  });
  frames = [];
  storage.initial = null;
  storage.saved = [];
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("HTMLButtonElement", dom.HTMLButtonElement);
  vi.stubGlobal("MessageEvent", dom.MessageEvent);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = undefined;
  });
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
  const shadow = root;
  if (!shadow || !frame?.contentWindow) throw new Error("no frame window");
  const delivered: ToPanel[] = [];
  vi.spyOn(frame.contentWindow, "postMessage").mockImplementation((message: unknown) => {
    delivered.push(message as ToPanel);
  });
  const fromPanel = (data: FromPanel) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data,
        origin: "chrome-extension://graphy",
        source: frame.contentWindow,
      }),
    );
  const signalReady = () => fromPanel({ channel: PANEL_CHANNEL, type: "ready" });
  const find = <T extends Element>(selector: string): T => {
    const found = shadow.querySelector<T>(selector);
    if (!found) throw new Error(`missing ${selector}`);
    return found;
  };
  return { host, root: shadow, frame, delivered, signalReady, fromPanel, find };
}

async function openHost(state: Partial<PanelState> = {}) {
  storage.initial = { x: 100, y: 120, width: 460, height: 520, open: true, shrunk: false, ...state };
  const ctx = await readyHost();
  const layer = ctx.find<HTMLDivElement>(".layer");
  const shell = ctx.find<HTMLDivElement>(".shell");
  const resizeHit = (corner: string) => ctx.find<HTMLButtonElement>(`.resize-hit[data-corner="${corner}"]`);
  const move = (dx: number, dy: number) => ctx.fromPanel({ channel: PANEL_CHANNEL, type: "move", dx, dy });
  const persist = () => ctx.fromPanel({ channel: PANEL_CHANNEL, type: "persist" });
  return { ...ctx, layer, shell, resizeHit, move, persist };
}

function spyStyleWrites(...elements: HTMLElement[]): Array<[string, string]> {
  const writes: Array<[string, string]> = [];
  for (const el of elements) {
    const setProperty = el.style.setProperty.bind(el.style);
    vi.spyOn(el.style, "setProperty").mockImplementation((prop: string, value: string | null) => {
      writes.push([prop, value ?? ""]);
      setProperty(prop, value);
    });
  }
  return writes;
}

function pointer(type: string, clientX: number, clientY: number): Event {
  return new dom.PointerEvent(type, { button: 0, pointerId: 1, clientX, clientY }) as unknown as Event;
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

test("drags the shell with one transform per frame and commits left and top on persist", async () => {
  const { host, layer, shell, resizeHit, move, persist } = await openHost();
  expect(shell.style.left).toBe("100px");
  expect(shell.style.top).toBe("120px");
  const cornerLeft = resizeHit("ne").style.left;

  const writes = spyStyleWrites(layer, shell, resizeHit("ne"));
  move(5, 3);
  move(7, 2);
  expect(writes).toEqual([]);
  expect(frames).toHaveLength(1);

  runFrame();
  expect(writes).toEqual([["transform", "translate3d(12px, 5px, 0px)"]]);
  expect(shell.style.left).toBe("100px");
  expect(shell.style.top).toBe("120px");
  expect(resizeHit("ne").style.left).toBe(cornerLeft);

  writes.length = 0;
  persist();
  expect(shell.style.left).toBe("112px");
  expect(shell.style.top).toBe("125px");
  expect(layer.style.transform).toBe("");
  expect(resizeHit("ne").style.left).toBe(`${Number.parseFloat(cornerLeft) + 12}px`);
  expect(writes.map(([prop]) => prop).sort()).toEqual(["left", "left", "top", "top", "transform"]);
  host.destroy();
});

test("persist applies moves that have not been painted yet", async () => {
  const { host, layer, shell, move, persist } = await openHost();
  move(-20, 10);
  persist();
  expect(frames.filter(Boolean)).toHaveLength(0);
  expect(shell.style.left).toBe("80px");
  expect(shell.style.top).toBe("130px");
  expect(layer.style.transform).toBe("");
  host.destroy();
});

test("clamps drag moves to the viewport", async () => {
  const { host, layer, shell, move, persist } = await openHost();
  move(5000, -5000);
  runFrame();
  expect(layer.style.transform).toBe(`translate3d(${1200 - 460 - 100}px, -120px, 0px)`);
  persist();
  expect(shell.style.left).toBe(`${1200 - 460}px`);
  expect(shell.style.top).toBe("0px");
  await dom.happyDOM.waitUntilComplete();
  expect(storage.saved.at(-1)).toMatchObject({ x: 1200 - 460, y: 0, width: 460, height: 520 });
  host.destroy();
});

test("skips style and attribute writes when nothing changed", async () => {
  const { host, layer, shell, frame, resizeHit, persist } = await openHost();
  const writes = spyStyleWrites(layer, shell, frame, resizeHit("se"));
  const setAttribute = vi.spyOn(resizeHit("se"), "setAttribute");
  persist();
  window.dispatchEvent(new dom.Event("resize") as unknown as Event);
  expect(writes).toEqual([]);
  expect(setAttribute).not.toHaveBeenCalled();
  host.destroy();
});

test("throttles live resize to one layout per animation frame", async () => {
  const { host, shell, frame, resizeHit } = await openHost();
  const hit = resizeHit("se");
  hit.dispatchEvent(pointer("pointerdown", 560, 640));
  const writes = spyStyleWrites(shell, frame);

  hit.dispatchEvent(pointer("pointermove", 570, 650));
  hit.dispatchEvent(pointer("pointermove", 600, 660));
  hit.dispatchEvent(pointer("pointermove", 620, 680));
  expect(writes).toEqual([]);
  expect(frames).toHaveLength(1);

  runFrame();
  expect(shell.style.width).toBe("520px");
  expect(shell.style.height).toBe("560px");
  expect(frame.style.width).toBe("520px");
  expect(frame.style.height).toBe("560px");
  expect(writes.map(([prop]) => prop).sort()).toEqual(["height", "height", "width", "width"]);

  hit.dispatchEvent(pointer("pointermove", 640, 690));
  hit.dispatchEvent(pointer("pointerup", 650, 700));
  expect(frames.filter(Boolean)).toHaveLength(0);
  expect(shell.style.width).toBe("550px");
  expect(shell.style.height).toBe("580px");
  await dom.happyDOM.waitUntilComplete();
  expect(storage.saved.at(-1)).toMatchObject({ x: 100, y: 120, width: 550, height: 580 });
  host.destroy();
});

test("a cancelled resize keeps the last tracked pointer position", async () => {
  const { host, shell, resizeHit } = await openHost();
  const hit = resizeHit("nw");
  hit.dispatchEvent(pointer("pointerdown", 100, 120));
  hit.dispatchEvent(pointer("pointermove", 80, 100));
  hit.dispatchEvent(pointer("pointercancel", 0, 0));
  expect(shell.style.left).toBe("80px");
  expect(shell.style.top).toBe("100px");
  expect(shell.style.width).toBe("480px");
  expect(shell.style.height).toBe("540px");
  host.destroy();
});

test("keeps resize hit areas labelled and positioned over the shell", async () => {
  const { host, root, resizeHit } = await openHost();
  expect(root.querySelector(".shrink-hit")).toBeNull();
  expect(resizeHit("se").style.left).toBe(`${100 + 460 - 4}px`);
  expect(resizeHit("se").style.top).toBe(`${120 + 520 - 4}px`);
  expect(resizeHit("nw").style.left).toBe(`${100 - 12}px`);
  expect(resizeHit("nw").style.top).toBe(`${120 - 12}px`);
  expect(resizeHit("nw").getAttribute("aria-label")).toBe("Resize panel from top left");
  host.destroy();
});

test("shrinks through the panel's own titlebar button", async () => {
  const { host, delivered, fromPanel, signalReady } = await openHost();
  signalReady();
  delivered.length = 0;
  fromPanel({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: true });
  expect(delivered).toEqual([{ channel: PANEL_CHANNEL, type: "shrunk", shrunk: true }]);
  await dom.happyDOM.waitUntilComplete();
  expect(storage.saved.at(-1)).toMatchObject({ shrunk: true });
  host.destroy();
});

test("does not load remote fonts into the host page", async () => {
  const { host, root, find } = await readyHost();
  expect(root.querySelector("link")).toBeNull();
  expect(find<HTMLStyleElement>("style").textContent).not.toMatch(/fonts\.googleapis|text-transform/);
  expect(find<HTMLButtonElement>(".launcher").textContent).toBe("Graphy");
  host.destroy();
});
