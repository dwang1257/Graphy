/** LeetCode custom input is newline-separated, one JSON-ish literal per parameter. */

export type LCValue = string | number | boolean | null | LCValue[];

const TRAILING_COMMA = /,\s*([\]}])/g;

function lenient(raw: string): LCValue {
  try {
    return JSON.parse(raw) as LCValue;
  } catch {
    // Tolerate single quotes and trailing commas before giving up.
    const patched = raw.replace(/'/g, '"').replace(TRAILING_COMMA, "$1");
    try {
      return JSON.parse(patched) as LCValue;
    } catch {
      return raw;
    }
  }
}

/** Normalizes newlines and drops trailing blank lines. */
export function splitInputLines(input: string): string[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  return lines;
}

/**
 * Splits a testcase buffer into top-level parameter values. Unlike a raw
 * newline split, bracket depth is tracked so pretty-printed arrays stay one value.
 */
export function splitInputValues(input: string): string[] {
  const normalized = input.replace(/\r\n?/g, "\n");
  const values: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let quote = "";

  const push = (): void => {
    const trimmed = current.trim();
    if (trimmed) values.push(trimmed);
    current = "";
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized[i]!;
    const prev = i > 0 ? normalized[i - 1] : "";

    if (inString) {
      current += c;
      if (c === quote && prev !== "\\") inString = false;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      current += c;
      continue;
    }

    if (c === "[" || c === "{") {
      depth += 1;
      current += c;
      continue;
    }

    if (c === "]" || c === "}") {
      depth -= 1;
      current += c;
      continue;
    }

    if (c === "\n" && depth === 0) {
      push();
      continue;
    }

    current += c;
  }

  push();
  return values;
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
