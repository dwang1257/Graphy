import { Graphviz } from "@hpcc-js/wasm-graphviz";

let loading: Promise<Graphviz> | null = null;

function engine(): Promise<Graphviz> {
  loading ??= Graphviz.load();
  return loading;
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

export async function renderDot(dot: string): Promise<string> {
  const graphviz = await engine();
  await yieldToMain();
  return graphviz.layout(dot, "svg", "dot");
}

export function preload(): void {
  void engine().catch(() => {
    loading = null;
  });
}
