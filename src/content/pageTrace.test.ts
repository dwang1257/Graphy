import { afterEach, expect, test, vi } from "vitest";

import { PAGE_CHANNEL } from "../shared/protocol.js";
import { notifyPageTrace } from "./pageTrace.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("posts a page-channel trace flag to the page world", () => {
  const posted: Array<{ message: unknown; origin: string }> = [];
  vi.stubGlobal("window", {
    postMessage: (message: unknown, origin: string) => {
      posted.push({ message, origin });
    },
  });
  vi.stubGlobal("location", { origin: "https://leetcode.com" });

  notifyPageTrace(true);
  notifyPageTrace(false);

  expect(posted).toEqual([
    {
      message: { channel: PAGE_CHANNEL, type: "trace", enabled: true },
      origin: "https://leetcode.com",
    },
    {
      message: { channel: PAGE_CHANNEL, type: "trace", enabled: false },
      origin: "https://leetcode.com",
    },
  ]);
});
