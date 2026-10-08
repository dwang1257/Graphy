import { SUGGESTION_FORM_URL } from "../src/panel/suggestion.js";

const FAKE_DELAY_MS = 400;

export function installFetchShim(): void {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== SUGGESTION_FORM_URL) return realFetch(input, init);
    const fields = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
    console.info("[graphy harness] suggestion intercepted", fields);
    await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS));
    return new Response(null);
  };
}
