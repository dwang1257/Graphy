export interface CaseTab {
  element: HTMLElement;
  index: number;
}

export interface TestcaseDomAdapter {
  tabs(): CaseTab[];
  selectedIndex(tabs: CaseTab[]): number;
  select(tab: CaseTab): void;
  readMountedParameters(): string[] | null;
  waitUntilSettled(tab: CaseTab, isCurrent: () => boolean): Promise<string[]>;
}

interface CodeMirrorContent extends HTMLElement {
  cmView?: {
    rootView?: {
      view?: {
        state?: {
          doc?: { toString(): string };
        };
      };
    };
  };
}

const TAB_SELECTOR = '[data-e2e-locator="console-testcase-tag"]';
const INPUT_SELECTOR = '[data-e2e-locator="console-testcase-input"]';
const SETTLE_TIMEOUT_MS = 2_000;

function isSelected(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-selected") === "true" ||
    element.getAttribute("aria-current") === "true" ||
    element.getAttribute("data-state") === "active"
  );
}

function textareaValue(element: HTMLElement): string | null {
  if (element.matches("textarea")) {
    return (element as HTMLTextAreaElement).value;
  }

  return element.querySelector<HTMLTextAreaElement>("textarea")?.value ?? null;
}

export function createTestcaseDomAdapter(
  doc: Document,
  win: Window,
): TestcaseDomAdapter {
  const tabs = (): CaseTab[] =>
    Array.from(doc.querySelectorAll<HTMLElement>(TAB_SELECTOR), (element, index) => ({
      element,
      index,
    }));

  const selectedIndex = (caseTabs: CaseTab[]): number =>
    caseTabs.find((tab) => isSelected(tab.element))?.index ?? -1;

  const readMountedParameters = (): string[] | null => {
    const wrappers = Array.from(doc.querySelectorAll<HTMLElement>(INPUT_SELECTOR));
    if (wrappers.length === 0) return null;

    const values = wrappers.map((wrapper) => {
      const content = wrapper.querySelector<CodeMirrorContent>(".cm-content");
      const codeMirrorValue = content?.cmView?.rootView?.view?.state?.doc?.toString();
      return codeMirrorValue ?? textareaValue(wrapper);
    });

    return values.every((value): value is string => value !== null) ? values : null;
  };

  const waitUntilSettled = (
    tab: CaseTab,
    isCurrent: () => boolean,
  ): Promise<string[]> =>
    new Promise((resolve, reject) => {
      let previousFingerprint: string | null = null;
      let finished = false;

      const finish = (action: () => void): void => {
        if (finished) return;
        finished = true;
        win.clearTimeout(timeout);
        action();
      };

      const timeout = win.setTimeout(() => {
        finish(() => reject(new Error("Timed out waiting for testcase inputs to settle")));
      }, SETTLE_TIMEOUT_MS);

      const check = (): void => {
        if (finished) return;
        if (!isCurrent()) {
          finish(() => reject(new Error("Testcase capture was superseded")));
          return;
        }

        const parameters =
          selectedIndex(tabs()) === tab.index ? readMountedParameters() : null;
        if (parameters !== null) {
          const fingerprint = JSON.stringify(parameters);
          if (fingerprint === previousFingerprint) {
            finish(() => resolve(parameters));
            return;
          }
          previousFingerprint = fingerprint;
        } else {
          previousFingerprint = null;
        }

        win.requestAnimationFrame(check);
      };

      win.requestAnimationFrame(check);
    });

  return {
    tabs,
    selectedIndex,
    select: (tab) => tab.element.click(),
    readMountedParameters,
    waitUntilSettled,
  };
}
