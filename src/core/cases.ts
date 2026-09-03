import { splitInputValues } from "./parse/value.js";

/** Splits LeetCode's concatenated custom-testcase buffer into ordered cases. */

export interface CaseCapture {
  cases: string[];
  captureError?: string;
}

function sliceCases(values: string[], caseCount: number, paramCount: number): string[] {
  const cases: string[] = [];
  for (let i = 0; i < caseCount; i += 1) {
    cases.push(values.slice(i * paramCount, (i + 1) * paramCount).join("\n"));
  }
  return cases;
}

/**
 * LeetCode stores every Case N as a contiguous block of parameter lines.
 * `caseCount` comes from the Case tabs; `paramCount` from the selected-case fields.
 *
 * Counts are hints, not a hard contract: extra result editors, a selected-case-only
 * view, or pretty-printed leftovers must still yield something drawable.
 */
export function groupTestCases(
  buffer: string,
  caseCount: number,
  paramCount: number,
): CaseCapture {
  const values = splitInputValues(buffer);
  if (values.length === 0) return { cases: [] };

  if (caseCount <= 0) {
    return { cases: [values.join("\n")] };
  }

  let params = paramCount;
  if (params <= 0) {
    if (values.length % caseCount === 0) params = values.length / caseCount;
    else return { cases: [values.join("\n")] };
  }

  const expected = caseCount * params;

  if (values.length === expected) {
    return { cases: sliceCases(values, caseCount, params) };
  }

  if (values.length > expected) {
    const complete = Math.floor(values.length / params);
    if (complete >= caseCount) {
      return { cases: sliceCases(values.slice(0, expected), caseCount, params) };
    }
    if (complete > 0) {
      return { cases: sliceCases(values.slice(0, complete * params), complete, params) };
    }
  }

  if (values.length === params) {
    return { cases: [values.join("\n")] };
  }

  if (values.length % params === 0) {
    const inferred = values.length / params;
    return { cases: sliceCases(values, inferred, params) };
  }

  if (values.length % caseCount === 0) {
    const inferred = values.length / caseCount;
    return { cases: sliceCases(values, caseCount, inferred) };
  }

  if (values.length === caseCount) {
    return { cases: [...values] };
  }

  return { cases: [values.join("\n")] };
}

/**
 * Chooses which captured editor buffers to split. LeetCode often keeps both the
 * full Case collection and a duplicate editor for the selected case; prefer the
 * buffer that already contains the whole collection.
 */
export function pickCaseBuffers(
  buffers: string[],
  caseCount: number,
  paramCount: number,
): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of buffers) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    unique.push(text);
  }
  if (unique.length <= 1) return unique;

  const expected = caseCount > 0 && paramCount > 0 ? caseCount * paramCount : 0;
  const ranked = [...unique].sort((a, b) => b.length - a.length);
  for (const text of ranked) {
    const count = splitInputValues(text).length;
    if (expected > 0 && count === expected) return [text];
    if (caseCount > 0 && paramCount <= 1 && count === caseCount) return [text];
  }

  if (caseCount > 0 && unique.length === caseCount) return unique;
  if (paramCount > 0 && unique.length === paramCount) return unique;
  return unique;
}

export function clampCaseIndex(index: number, caseCount: number): number {
  if (caseCount <= 0) return 0;
  return Math.min(Math.max(0, index), caseCount - 1);
}
