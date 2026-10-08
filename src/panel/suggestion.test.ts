import { afterEach, describe, expect, it, vi } from "vitest";

import { SUGGESTION_FORM_URL, extensionVersion, submitSuggestion, suggestionBody } from "./suggestion.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("suggestionBody", () => {
  it("sends the kind and the trimmed text with hidden context", () => {
    const body = suggestionBody({ kind: "Bug fix", text: "  Trees overlap  \n", slug: "two-sum", version: "1.2.3" });

    expect(body.get("entry.1514885710")).toBe("Bug fix");
    expect(body.get("entry.1464379200")).toBe("Trees overlap\n\n---\nGraphy 1.2.3 | two-sum");
    expect(body.get("fvv")).toBe("1");
    expect(body.get("pageHistory")).toBe("0");
  });

  it("omits the kind when none is chosen and notes a missing problem", () => {
    const body = suggestionBody({ kind: undefined, text: "Hi", slug: "", version: "dev" });

    expect(body.has("entry.1514885710")).toBe(false);
    expect(body.get("entry.1464379200")).toBe("Hi\n\n---\nGraphy dev | no problem");
  });
});

describe("submitSuggestion", () => {
  it("posts the form without reading the opaque response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null));

    await submitSuggestion({ kind: "New feature", text: "Dark grids", slug: "number-of-islands", version: "1.0.3" }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SUGGESTION_FORM_URL);
    expect(init.method).toBe("POST");
    expect(init.mode).toBe("no-cors");
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get("entry.1514885710")).toBe("New feature");
  });

  it("rejects when the network request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(submitSuggestion({ kind: undefined, text: "x", slug: "", version: "dev" }, fetchImpl)).rejects.toThrow(
      "Failed to fetch",
    );
  });
});

describe("extensionVersion", () => {
  it("reads the manifest version", () => {
    vi.stubGlobal("chrome", { runtime: { getManifest: () => ({ version: "1.0.3" }) } });
    expect(extensionVersion()).toBe("1.0.3");
  });

  it("falls back when the runtime is unavailable", () => {
    vi.stubGlobal("chrome", {});
    expect(extensionVersion()).toBe("dev");
    vi.stubGlobal("chrome", undefined);
    expect(extensionVersion()).toBe("dev");
  });
});
