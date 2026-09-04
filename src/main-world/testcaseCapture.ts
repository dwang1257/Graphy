import type { CaseTab, TestcaseDomAdapter } from "./testcaseDom.js";

export interface DomCaseCapture {
  cases: string[];
  captureError?: string;
}

export async function captureCasesFromTabs(
  adapter: TestcaseDomAdapter,
  isCurrent?: () => boolean,
): Promise<DomCaseCapture> {
  const stillCurrent = isCurrent ?? (() => true);
  const tabs = adapter.tabs();
  const originalIndex = adapter.selectedIndex(tabs);

  try {
    if (tabs.length === 0) {
      if (!stillCurrent()) {
        return { cases: [], captureError: "Testcase capture was cancelled" };
      }
      const mounted = adapter.readMountedParameters();
      return mounted === null ? { cases: [] } : { cases: [mounted.join("\n")] };
    }

    const cases: string[] = [];
    for (const tab of tabs) {
      if (!stillCurrent()) {
        return { cases: [], captureError: "Testcase capture was cancelled" };
      }

      adapter.select(tab);
      try {
        const parameters = await adapter.waitUntilSettled(tab, stillCurrent);
        cases.push(parameters.join("\n"));
      } catch (error) {
        if (!stillCurrent()) {
          return { cases: [], captureError: "Testcase capture was cancelled" };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { cases: [], captureError: `Case ${tab.index + 1}: ${message}` };
      }
    }

    return { cases };
  } finally {
    await restoreSelection(adapter, tabs, originalIndex);
  }
}

async function restoreSelection(
  adapter: TestcaseDomAdapter,
  tabs: CaseTab[],
  originalIndex: number,
): Promise<void> {
  if (originalIndex < 0) return;

  const originalTab = tabs.find((tab) => tab.index === originalIndex);
  if (!originalTab) return;
  if (adapter.selectedIndex(tabs) === originalIndex) return;

  try {
    adapter.select(originalTab);
    await adapter.waitUntilSettled(originalTab, () => true);
  } catch {
    /* Restoration must not replace the capture result. */
  }
}
