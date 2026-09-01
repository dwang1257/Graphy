import { splitInputLines } from "./parse/value.js";

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
  const lines = splitInputLines(buffer);

  if (caseCount <= 0) {
    const text = lines.join("\n").trim();
    return { cases: text ? [text] : [] };
  }

  let params = paramCount;
  if (params <= 0) {
    if (lines.length > 0 && lines.length % caseCount === 0) {
      params = lines.length / caseCount;
    } else {
      return {
        cases: [],
        captureError: `Could not separate test cases (${caseCount} cases, ${lines.length} lines).`,
      };
    }
  }

  const expected = caseCount * params;
  if (lines.length !== expected) {
    return {
      cases: [],
      captureError: `Could not separate test cases (${caseCount} cases × ${params} params, found ${lines.length} lines).`,
    };
  }

  const cases: string[] = [];
  for (let i = 0; i < caseCount; i += 1) {
    cases.push(lines.slice(i * params, (i + 1) * params).join("\n"));
  }
  return { cases };
}

export function clampCaseIndex(index: number, caseCount: number): number {
  if (caseCount <= 0) return 0;
  return Math.min(Math.max(0, index), caseCount - 1);
}
