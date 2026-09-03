import { splitInputValues } from "./parse/value.js";

/** Splits LeetCode's concatenated custom-testcase buffer into ordered cases. */

export interface CaseCapture {
  cases: string[];
  captureError?: string;
}

/**
 * LeetCode stores every Case N as a contiguous block of parameter lines.
 * `caseCount` comes from the Case tabs; `paramCount` from the selected-case fields.
 */
export function groupTestCases(
  buffer: string,
  caseCount: number,
  paramCount: number,
): CaseCapture {
  const values = splitInputValues(buffer);

  if (caseCount <= 0) {
    const text = values.join("\n").trim();
    return { cases: text ? [text] : [] };
  }

  let params = paramCount;
  if (params <= 0) {
    if (values.length > 0 && values.length % caseCount === 0) {
      params = values.length / caseCount;
    } else {
      return {
        cases: [],
        captureError: `Could not separate test cases (${caseCount} cases, ${values.length} values).`,
      };
    }
  }

  const expected = caseCount * params;
  if (values.length !== expected) {
    return {
      cases: [],
      captureError: `Could not separate test cases (${caseCount} cases × ${params} params, found ${values.length} values).`,
    };
  }

  const cases: string[] = [];
  for (let i = 0; i < caseCount; i += 1) {
    cases.push(values.slice(i * params, (i + 1) * params).join("\n"));
  }
  return { cases };
}

export function clampCaseIndex(index: number, caseCount: number): number {
  if (caseCount <= 0) return 0;
  return Math.min(Math.max(0, index), caseCount - 1);
}
