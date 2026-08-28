import { describe, expect, it } from "vitest";

import { isAllowedParentOrigin, resolveParentOrigin } from "./parentOrigin.js";

describe("resolveParentOrigin", () => {
  it("targets the LeetCode parent, not the panel iframe origin", () => {
    expect(
      resolveParentOrigin({
        ancestorOrigin: "https://leetcode.com",
        referrer: "https://leetcode.com/problems/two-sum/",
      }),
    ).toBe("https://leetcode.com");
  });

  it("accepts the .cn site", () => {
    expect(
      resolveParentOrigin({
        ancestorOrigin: "https://leetcode.cn",
        referrer: "",
      }),
    ).toBe("https://leetcode.cn");
  });

  it("falls back to the referrer when ancestorOrigins is empty", () => {
    expect(
      resolveParentOrigin({
        ancestorOrigin: "",
        referrer: "https://leetcode.com/problems/invert-binary-tree/",
      }),
    ).toBe("https://leetcode.com");
  });

  it("does not use the extension origin as the postMessage target", () => {
    expect(
      resolveParentOrigin({
        ancestorOrigin: "chrome-extension://abcdefghijklmnopqrstuvwxyz123456",
        referrer: "",
      }),
    ).toBeNull();
  });

  it("ignores an invalid referrer", () => {
    expect(
      resolveParentOrigin({
        ancestorOrigin: "",
        referrer: "not a url",
      }),
    ).toBeNull();
  });
});

describe("isAllowedParentOrigin", () => {
  it("accepts LeetCode page origins and rejects the extension origin", () => {
    expect(isAllowedParentOrigin("https://leetcode.com")).toBe(true);
    expect(isAllowedParentOrigin("https://leetcode.cn")).toBe(true);
    expect(isAllowedParentOrigin("chrome-extension://abcdefghijklmnopqrstuvwxyz123456")).toBe(false);
  });
});
