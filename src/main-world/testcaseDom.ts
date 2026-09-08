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
const RESULT_SELECTOR = '[data-e2e-locator="console-result"]';
const CASE_PILL_TEXT = /^Case\s+\d+$/i;
const INPUT_HEADING = /^(Input|输入)$/;
const SETTLE_TIMEOUT_MS = 2_000;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isOfficiallySelected(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-selected") === "true" ||
    element.getAttribute("aria-current") === "true" ||
    element.getAttribute("data-state") === "active"
  );
}

function isVisuallySelected(element: HTMLElement): boolean {
  return String(element.className).includes("bg-fill-3");
}

function textareaValue(element: HTMLElement): string | null {
  if (element.matches("textarea")) {
    return (element as HTMLTextAreaElement).value;
  }

  return element.querySelector<HTMLTextAreaElement>("textarea")?.value ?? null;
}

function parameterValue(wrapper: HTMLElement): string | null {
  const content = wrapper.querySelector<CodeMirrorContent>(".cm-content");
  const codeMirrorValue = content?.cmView?.rootView?.view?.state?.doc?.toString();
  if (typeof codeMirrorValue === "string") return codeMirrorValue;

  const fromTextarea = textareaValue(wrapper);
  if (fromTextarea !== null) return fromTextarea;

  return typeof wrapper.textContent === "string" ? wrapper.textContent : null;
}

function firstMatch(root: ParentNode, selector: string): HTMLElement | null {
  return (
    root.querySelector?.<HTMLElement>(selector) ??
    root.querySelectorAll?.<HTMLElement>(selector)[0] ??
    null
  );
}

function isCasePillLabel(element: HTMLElement): boolean {
  return CASE_PILL_TEXT.test(normalizeText(element.textContent ?? ""));
}

function collectResultPills(root: ParentNode): HTMLElement[] {
  const labeled = Array.from(root.querySelectorAll<HTMLElement>("div,button")).filter(isCasePillLabel);
  const clickable = labeled.filter((element) => {
    const className = String(element.className);
    return element.tagName === "BUTTON" || className.includes("cursor-pointer");
  });
  const pool = clickable.length > 0 ? clickable : labeled;
  return pool.filter((element) => !pool.some((other) => other !== element && other.contains?.(element)));
}

function findResultPanel(doc: Document): HTMLElement | null {
  const badge = firstMatch(doc, RESULT_SELECTOR);
  if (!badge) return null;

  let node: HTMLElement | null = badge;
  for (let depth = 0; depth < 10 && node; depth += 1) {
    if (collectResultPills(node).length > 0) return node;
    node = node.parentElement;
  }
  return badge.parentElement;
}

function resultParamValue(block: HTMLElement): string | null {
  const menlo = Array.from(block.querySelectorAll<HTMLElement>("div")).find((element) =>
    String(element.className).includes("font-menlo"),
  );
  if (menlo) return (menlo.textContent ?? "").trim();

  const text = (block.textContent ?? "").trim();
  if (!text) return null;
  return text.replace(/^[^\n=]*=\s*/, "").trim() || null;
}

function readResultParameters(doc: Document): string[] | null {
  const panel = findResultPanel(doc);
  if (!panel) return null;

  const heading = Array.from(panel.querySelectorAll<HTMLElement>("div")).find(
    (element) =>
      INPUT_HEADING.test(normalizeText(element.textContent ?? "")) && element.children.length === 0,
  );
  const section = heading?.nextElementSibling as HTMLElement | null;
  if (!section) return null;

  const values = Array.from(section.children, (child) => resultParamValue(child as HTMLElement));
  return values.length > 0 && values.every((value): value is string => value !== null) ? values : null;
}

function readOfficialParameters(doc: Document): string[] | null {
  const wrappers = Array.from(doc.querySelectorAll<HTMLElement>(INPUT_SELECTOR));
  if (wrappers.length === 0) return null;

  const values = wrappers.map(parameterValue);
  return values.every((value): value is string => value !== null) ? values : null;
}

function sameParameters(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isTabSelected(tab: CaseTab, lastClicked: HTMLElement | null): boolean {
  if (lastClicked) {
    if (lastClicked === tab.element) return true;
    if (typeof lastClicked.isConnected !== "boolean" || lastClicked.isConnected) {
      return false;
    }
  }
  return isOfficiallySelected(tab.element) || isVisuallySelected(tab.element);
}

export function createTestcaseDomAdapter(
  doc: Document,
  win: Window,
): TestcaseDomAdapter {
  let lastClicked: HTMLElement | null = null;

  const tabs = (): CaseTab[] => {
    const official = Array.from(doc.querySelectorAll<HTMLElement>(TAB_SELECTOR), (element, index) => ({
      element,
      index,
    }));
    if (official.length > 0) return official;

    const panel = findResultPanel(doc);
    if (!panel) return [];
    return collectResultPills(panel).map((element, index) => ({ element, index }));
  };

  const selectedIndex = (caseTabs: CaseTab[]): number => {
    if (lastClicked) {
      const clicked = caseTabs.find((tab) => tab.element === lastClicked);
      if (clicked) return clicked.index;
    }
    return (
      caseTabs.find((tab) => isOfficiallySelected(tab.element) || isVisuallySelected(tab.element))
        ?.index ?? -1
    );
  };

  const readMountedParameters = (): string[] | null =>
    readOfficialParameters(doc) ?? readResultParameters(doc);

  const waitUntilSettled = (
    tab: CaseTab,
    isCurrent: () => boolean,
  ): Promise<string[]> =>
    new Promise((resolve, reject) => {
      let previous: string[] | null = null;
      let finished = false;
      let framePending = false;

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

        const parameters = isTabSelected(tab, lastClicked) ? readMountedParameters() : null;
        if (parameters !== null) {
          if (previous !== null && sameParameters(previous, parameters)) {
            finish(() => resolve(parameters));
            return;
          }
          previous = parameters;
        } else {
          previous = null;
        }

        scheduleCheck();
      };

      const scheduleCheck = (): void => {
        if (finished || framePending) return;
        framePending = true;
        win.requestAnimationFrame(() => {
          framePending = false;
          check();
        });
      };

      scheduleCheck();
    });

  return {
    tabs,
    selectedIndex,
    select: (tab) => {
      lastClicked = tab.element;
      tab.element.click();
    },
    readMountedParameters,
    waitUntilSettled,
  };
}
