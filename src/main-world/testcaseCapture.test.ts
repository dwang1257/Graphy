import { expect, it } from "vitest";

import type { CaseTab, TestcaseDomAdapter } from "./testcaseDom.js";
import { captureCasesFromTabs } from "./testcaseCapture.js";

interface FakeAdapterOptions {
  selected: number;
  cases: Array<string[] | Error>;
  mounted?: string[] | null;
}

function fakeAdapter(
  options: FakeAdapterOptions,
): TestcaseDomAdapter & { currentIndex(): number } {
  let selected = options.selected;
  const caseEntries = options.cases;
  let mounted: string[] | null =
    options.mounted !== undefined
      ? options.mounted
      : mountedFor(caseEntries, selected);

  const tabs = (): CaseTab[] =>
    caseEntries.map((_, index) => ({
      element: { id: `case-${index}` } as HTMLElement,
      index,
    }));

  return {
    tabs,
    selectedIndex: (caseTabs) =>
      caseTabs.some((tab) => tab.index === selected) ? selected : -1,
    select: (tab) => {
      selected = tab.index;
      mounted = mountedFor(caseEntries, tab.index);
    },
    readMountedParameters: () => mounted,
    waitUntilSettled: async (tab, isCurrent) => {
      if (!isCurrent()) {
        throw new Error("Testcase capture was superseded");
      }
      if (selected !== tab.index) {
        throw new Error("Requested tab is not selected");
      }
      const entry = caseEntries[tab.index];
      if (entry instanceof Error) throw entry;
      if (!entry) throw new Error("missing");
      return entry;
    },
    currentIndex: () => selected,
  };
}

function mountedFor(
  cases: Array<string[] | Error>,
  index: number,
): string[] | null {
  const entry = cases[index];
  return Array.isArray(entry) ? entry : null;
}

it("captures every tab in order and restores the original selection", async () => {
  const adapter = fakeAdapter({
    selected: 1,
    cases: [["[1]"], ["[2]", "4"], ["[3]"]],
  });
  await expect(captureCasesFromTabs(adapter)).resolves.toEqual({
    cases: ["[1]", "[2]\n4", "[3]"],
  });
  expect(adapter.currentIndex()).toBe(1);
});

it("restores selection and returns no partial cases after a tab failure", async () => {
  const adapter = fakeAdapter({ selected: 0, cases: [["[1]"], new Error("missing"), ["[3]"]] });
  const result = await captureCasesFromTabs(adapter);
  expect(result.cases).toEqual([]);
  expect(result.captureError).toMatch(/Case 2/);
  expect(adapter.currentIndex()).toBe(0);
});

it("returns one mounted case when no tabs exist", async () => {
  const adapter = fakeAdapter({
    selected: -1,
    cases: [],
    mounted: ["[1]", "2"],
  });
  await expect(captureCasesFromTabs(adapter)).resolves.toEqual({
    cases: ["[1]\n2"],
  });
});

it("restores selection and returns no partial cases after cancellation", async () => {
  const adapter = fakeAdapter({
    selected: 2,
    cases: [["[1]"], ["[2]"], ["[3]"]],
  });
  const isCurrent = () => adapter.currentIndex() !== 1;
  const result = await captureCasesFromTabs(adapter, isCurrent);
  expect(result.cases).toEqual([]);
  expect(result.captureError).toBeDefined();
  expect(adapter.currentIndex()).toBe(2);
});
