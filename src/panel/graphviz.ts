import { Graphviz } from "@hpcc-js/wasm-graphviz";

let loading: Promise<Graphviz> | null = null;

/**
 * The wasm binary ships inlined in the bundle, so this needs no network fetch -
 * only `wasm-unsafe-eval` in the extension page CSP.
 */
function engine(): Promise<Graphviz> {
  loading ??= Graphviz.load();
  return loading;
}

export async function renderDot(dot: string): Promise<string> {
  const graphviz = await engine();
  return graphviz.layout(dot, "svg", "dot");
}

/** Warms the wasm module so the first real render is not the one that pays. */
export function preload(): void {
  void engine().catch(() => {
    loading = null;
  });
}
