/** LeetCode custom input is newline-separated, one JSON-ish literal per parameter. */

export type LCValue = string | number | boolean | null | LCValue[];

const TRAILING_CLOSE = /[\]}]/;

const OPEN_DELIMITERS: Record<string, string> = {
  "[": "]",
  "{": "}",
  "(": ")",
};

const CLOSE_DELIMITERS: Record<string, string> = {
  "]": "[",
  "}": "{",
  ")": "(",
};

function isEscapedQuote(raw: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && raw[i] === "\\"; i -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function isWordBoundary(raw: string, start: number, length: number): boolean {
  const word = /[A-Za-z0-9_]/;
  const before = start > 0 ? raw[start - 1]! : "";
  const after = start + length < raw.length ? raw[start + length]! : "";
  return !word.test(before) && !word.test(after);
}

function normalizeLiteral(raw: string): string {
  let result = "";
  let inString = false;
  let quote = "";

  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i]!;

    if (inString) {
      if (c === quote && !isEscapedQuote(raw, i)) {
        inString = false;
        quote = "";
        result += '"';
      } else {
        result += c;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      result += '"';
      continue;
    }

    if (c === "N" && raw.startsWith("None", i) && isWordBoundary(raw, i, 4)) {
      result += "null";
      i += 3;
      continue;
    }

    if (c === "T" && raw.startsWith("True", i) && isWordBoundary(raw, i, 4)) {
      result += "true";
      i += 3;
      continue;
    }

    if (c === "F" && raw.startsWith("False", i) && isWordBoundary(raw, i, 5)) {
      result += "false";
      i += 4;
      continue;
    }

    if (c === ",") {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j]!)) j += 1;
      if (j < raw.length && TRAILING_CLOSE.test(raw[j]!)) continue;
    }

    result += c;
  }

  return result;
}

function lenient(raw: string): LCValue {
  try {
    return JSON.parse(raw) as LCValue;
  } catch {
    try {
      return JSON.parse(normalizeLiteral(raw)) as LCValue;
    } catch {
      return raw;
    }
  }
}

/**
 * Splits a testcase buffer into top-level parameter values while tracking
 * delimiter nesting and quoted regions.
 */
export function scanInputValues(input: string): { values: string[]; error?: string } {
  const normalized = input.replace(/\r\n?/g, "\n");
  const values: string[] = [];
  let current = "";
  let inString = false;
  let quote = "";
  const stack: string[] = [];

  const push = (): void => {
    const trimmed = current.trim();
    if (trimmed) values.push(trimmed);
    current = "";
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized[i]!;

    if (inString) {
      current += c;
      if (c === quote && !isEscapedQuote(normalized, i)) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      current += c;
      continue;
    }

    if (c in OPEN_DELIMITERS) {
      stack.push(c);
      current += c;
      continue;
    }

    if (c in CLOSE_DELIMITERS) {
      const expected = CLOSE_DELIMITERS[c]!;
      if (stack.length > 0 && stack[stack.length - 1] === expected) {
        stack.pop();
      }
      current += c;
      continue;
    }

    if (c === "\n" && stack.length === 0) {
      push();
      continue;
    }

    current += c;
  }

  push();

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1]!;
    return {
      values,
      error: `Unclosed delimiter '${unclosed}'.`,
    };
  }

  return { values };
}

/**
 * Splits a testcase buffer into top-level parameter values. Unlike a raw
 * newline split, bracket depth is tracked so pretty-printed arrays stay one value.
 */
export function splitInputValues(input: string): string[] {
  return scanInputValues(input).values;
}

/** Splits a custom-testcase blob into one parsed value per parameter. */
export function parseInput(input: string): LCValue[] {
  return splitInputValues(input).map((value) => lenient(value));
}

export function isArray(v: LCValue): v is LCValue[] {
  return Array.isArray(v);
}

/** True for [[..], [..]] shapes. */
export function isNestedArray(v: LCValue): v is LCValue[][] {
  return isArray(v) && v.length > 0 && v.every(isArray);
}

export function scalarText(v: LCValue): string {
  if (v === null) return "null";
  if (typeof v === "string") return v;
  return String(v);
}
