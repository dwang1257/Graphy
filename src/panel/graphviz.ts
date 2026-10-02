import { Graphviz } from "@hpcc-js/wasm-graphviz";

let loading: Promise<Graphviz> | null = null;
let engine: Graphviz | null = null;

export function loadEngine(): Promise<Graphviz> {
  loading ??= Graphviz.load().then(
    (loaded) => {
      engine = loaded;
      return loaded;
    },
    (cause: unknown) => {
      loading = null;
      throw cause;
    },
  );
  return loading;
}

export function isEngineReady(): boolean {
  return engine !== null;
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
      return;
    }
    setTimeout(resolve, 0);
  });
}

export function layoutNow(dot: string): string {
  if (!engine) throw new Error("Graphviz is still loading");
  return engine.layout(dot, "svg", "dot");
}

export async function renderDot(dot: string): Promise<string> {
  const graphviz = await loadEngine();
  return graphviz.layout(dot, "svg", "dot");
}

export function preload(): void {
  void loadEngine().catch(() => undefined);
}
