import { describe, expect, it } from "vitest";

import type { Signature } from "../core/signature.js";
import {
  EMPTY_CUSTOM_CASE,
  MAX_CUSTOM_FIELDS,
  addField,
  canAddField,
  customFields,
  customInput,
  customKinds,
  pasteValues,
  removeField,
  setFieldKind,
  setFieldValue,
  splitPastedValues,
  type CustomDraft,
} from "./customCase.js";

const EMPTY_DRAFT = EMPTY_CUSTOM_CASE.draft;

const LCA: Signature = {
  method: "lowestCommonAncestor",
  params: [
    { name: "root", type: "TreeNode" },
    { name: "p", type: "TreeNode" },
    { name: "q", type: "TreeNode" },
  ],
};

function draft(values: string[], kinds: CustomDraft["kinds"] = []): CustomDraft {
  return { values, kinds };
}

describe("customFields", () => {
  it("shows exactly one field per signature param with names, types, and detection", () => {
    const fields = customFields(draft(["[3,5,1]", "5"]), LCA);

    expect(fields.map((field) => [field.name, field.type, field.value, field.kind, field.detected, field.removable])).toEqual([
      ["root", "TreeNode", "[3,5,1]", "auto", "binary-tree", false],
      ["p", "TreeNode", "5", "auto", undefined, false],
      ["q", "TreeNode", "", "auto", undefined, false],
    ]);
    expect(fields[0]?.placeholder).toBe("[1,2,3,null,4]");
  });

  it("shows one removable-free field for an empty draft without a signature", () => {
    const fields = customFields(EMPTY_DRAFT, null);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ name: "arg 1", type: "", value: "", kind: "auto", removable: false, placeholder: "[1,2,3,null,4]" });
    expect(fields[0]?.detected).toBeUndefined();
  });

  it("grows with the draft values without a signature and marks them removable", () => {
    const fields = customFields(draft(["[1,null,2]", "[[1,0],[0,1]]"], ["auto", "none"]), null);

    expect(fields.map((field) => [field.name, field.kind, field.detected, field.removable])).toEqual([
      ["arg 1", "auto", "binary-tree", true],
      ["arg 2", "none", "matrix", true],
    ]);
  });

  it("treats an empty param list like a missing signature", () => {
    expect(customFields(draft(["1", "2"]), { method: "f", params: [] })).toHaveLength(2);
  });

  it("falls back to name detection for placeholders of untyped params", () => {
    const fields = customFields(EMPTY_DRAFT, {
      method: "f",
      params: [{ name: "head", type: "" }, { name: "grid", type: "" }, { name: "k", type: "" }],
    });

    expect(fields.map((field) => field.placeholder)).toEqual(["[1,2,3]", "[[1,0],[0,1]]", "[1,2,3]"]);
  });

  it("marks scalar-typed params so they get no structure picker", () => {
    const fields = customFields(EMPTY_DRAFT, {
      method: "f",
      params: [{ name: "nums", type: "integer[]" }, { name: "k", type: "integer" }, { name: "s", type: "string" }],
    });

    expect(fields.map((field) => field.scalar)).toEqual([false, true, true]);
    expect(customFields(EMPTY_DRAFT, null)[0]?.scalar).toBe(false);
  });
});

describe("draft edits", () => {
  it("sets values and kinds at any index, padding the gaps", () => {
    const withValue = setFieldValue(EMPTY_DRAFT, 2, "[1]");
    expect(withValue).toEqual({ values: ["", "", "[1]"], kinds: [] });

    const withKind = setFieldKind(withValue, 1, "linked-list");
    expect(withKind).toEqual({ values: ["", "", "[1]"], kinds: ["auto", "linked-list"] });
  });

  it("ignores out-of-range indices", () => {
    expect(setFieldValue(EMPTY_DRAFT, -1, "x")).toBe(EMPTY_DRAFT);
    expect(setFieldKind(EMPTY_DRAFT, MAX_CUSTOM_FIELDS, "matrix")).toBe(EMPTY_DRAFT);
  });

  it("adds an empty field after the displayed ones", () => {
    expect(addField(EMPTY_DRAFT)).toEqual({ values: ["", ""], kinds: ["auto", "auto"] });
    expect(addField(draft(["[1]", "[2]"], ["matrix"]))).toEqual({ values: ["[1]", "[2]", ""], kinds: ["matrix", "auto", "auto"] });
  });

  it("stops adding fields at the pane letter limit", () => {
    const full = draft(Array.from({ length: MAX_CUSTOM_FIELDS }, (_, i) => String(i)));

    expect(addField(full)).toBe(full);
    expect(canAddField(full, null)).toBe(false);
    expect(canAddField(EMPTY_DRAFT, null)).toBe(true);
    expect(canAddField(EMPTY_DRAFT, LCA)).toBe(false);
  });

  it("removes a field together with its kind", () => {
    const next = removeField(draft(["[1]", "[2]", "[3]"], ["none", "matrix"]), 1);

    expect(next).toEqual({ values: ["[1]", "[3]"], kinds: ["none", "auto"] });
  });

  it("ignores removal of a field that does not exist", () => {
    const current = draft(["[1]"]);
    expect(removeField(current, 3)).toBe(current);
  });
});

describe("pasteValues", () => {
  it("distributes values from the pasted field and caps them at the signature", () => {
    const next = pasteValues(draft(["old"]), 1, ["5", "1", "9"], LCA);

    expect(next.values).toEqual(["old", "5", "1"]);
  });

  it("grows fields without a signature", () => {
    const next = pasteValues(EMPTY_DRAFT, 0, ["[1,2]", "[3,4]", "[5]"], null);

    expect(next.values).toEqual(["[1,2]", "[3,4]", "[5]"]);
    expect(customFields(next, null)).toHaveLength(3);
  });

  it("never grows past the pane letter limit", () => {
    const values = Array.from({ length: MAX_CUSTOM_FIELDS + 5 }, (_, i) => String(i));
    expect(pasteValues(EMPTY_DRAFT, 0, values, null).values).toHaveLength(MAX_CUSTOM_FIELDS);
  });
});

describe("splitPastedValues", () => {
  it("splits newline-separated LeetCode testcases at the top level", () => {
    expect(splitPastedValues("[1,2,\n3]\n5\n")).toEqual(["[1,2,\n3]", "5"]);
  });

  it("returns null for a single value or malformed text", () => {
    expect(splitPastedValues("[1,2]")).toBeNull();
    expect(splitPastedValues("1, 2")).toBeNull();
    expect(splitPastedValues("[1,2\n3")).toBeNull();
  });
});

describe("customInput", () => {
  it("trims values, fills interior gaps with null, and drops trailing empties", () => {
    expect(customInput(draft([" [1,2] ", "", "5", " ", ""]))).toBe("[1,2]\nnull\n5");
  });

  it("collapses newlines inside a field so later fields keep their positions", () => {
    expect(customInput(draft(["[1,\n2]", "3\n4", "5"]))).toBe("[1, 2]\n3 4\n5");
  });

  it("returns an empty string when every field is blank", () => {
    expect(customInput(EMPTY_CUSTOM_CASE.applied)).toBe("");
  });

  it("maps auto kinds to undefined and keeps explicit choices", () => {
    expect(customKinds(draft([], ["auto", "none", "matrix"]))).toEqual([undefined, "none", "matrix"]);
  });
});

describe("placeholders", () => {
  it.each([
    ["TreeNode", "[1,2,3,null,4]"],
    ["Optional[TreeNode]", "[1,2,3,null,4]"],
    ["ListNode", "[1,2,3]"],
    ["ListNode[]", "[[1,4],[2,3]]"],
    ["List[Optional[ListNode]]", "[[1,4],[2,3]]"],
    ["integer[]", "[1,2,3]"],
    ["vector<int>&", "[1,2,3]"],
    ["integer[][]", "[[1,0],[0,1]]"],
    ["List[List[str]]", "[[1,0],[0,1]]"],
    ["character[][]", "[[1,0],[0,1]]"],
    ["", "[1,2,3]"],
    ["integer", ""],
    ["string", ""],
  ])("uses a shape example for %s", (type, placeholder) => {
    expect(customFields(EMPTY_DRAFT, { method: "f", params: [{ name: "x", type }] })[0]?.placeholder).toBe(placeholder);
  });

  it("uses the tree example without a signature", () => {
    expect(customFields(EMPTY_DRAFT, null)[0]?.placeholder).toBe("[1,2,3,null,4]");
  });
});
