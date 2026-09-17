/** LeetCode custom input is newline-separated, one JSON-ish literal per parameter. */

export type LCValue = string | number | boolean | null | LCValue[];

export const MAX_INPUT_LENGTH = 256 * 1024;
export const MAX_INPUT_VALUES = 64;
export const MAX_VALUE_LENGTH = 64 * 1024;
export const MAX_VALUE_DEPTH = 128;
export const MAX_VALUE_ITEMS = 10_000;

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

function isLCValue(value: unknown): value is LCValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return Array.isArray(value) && value.every(isLCValue);
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

interface LenientValue {
  value: LCValue;
}

interface LenientError {
  error: string;
}

function lenient(raw: string): LenientValue | LenientError {
  try {
    const value: unknown = JSON.parse(raw);
    return isLCValue(value) ? { value } : { error: "Invalid structured value." };
  } catch {
    try {
      const value: unknown = JSON.parse(normalizeLiteral(raw));
      return isLCValue(value) ? { value } : { error: "Invalid structured value." };
    } catch {
      return /^[\[{(]/.test(raw) ? { error: "Invalid structured value." } : { value: raw };
    }
  }
}

/**
 * Splits a testcase buffer into top-level parameter values while tracking
 * delimiter nesting and quoted regions.
 */
export function scanInputValues(input: string): { values: string[]; error?: string } {
  if (input.length > MAX_INPUT_LENGTH) {
    return { values: [], error: `Input is too large. Maximum is ${MAX_INPUT_LENGTH} characters.` };
  }
  const normalized = input.replace(/\r\n?/g, "\n");
  const values: string[] = [];
  let current = "";
  let inString = false;
  let quote = "";
  const stack: string[] = [];
  let error: string | undefined;

  const push = (): boolean => {
    const trimmed = current.trim();
    if (trimmed) {
      if (values.length >= MAX_INPUT_VALUES) {
        error = `Input has too many values. Maximum is ${MAX_INPUT_VALUES}.`;
        return false;
      }
      values.push(trimmed);
    }
    current = "";
    return true;
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized[i]!;

    if (inString) {
      current += c;
      if (current.length > MAX_VALUE_LENGTH) {
        error = `Input value is too large. Maximum is ${MAX_VALUE_LENGTH} characters.`;
        return { values, error };
      }
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
      if (current.length > MAX_VALUE_LENGTH) {
        error = `Input value is too large. Maximum is ${MAX_VALUE_LENGTH} characters.`;
        return { values, error };
      }
      continue;
    }

    if (c in OPEN_DELIMITERS) {
      if (stack.length >= MAX_VALUE_DEPTH) {
        return { values, error: `Input is too deeply nested. Maximum depth is ${MAX_VALUE_DEPTH}.` };
      }
      stack.push(c);
      current += c;
      continue;
    }

    if (c in CLOSE_DELIMITERS) {
      const expected = CLOSE_DELIMITERS[c]!;
      if (stack.length > 0 && stack[stack.length - 1] === expected) {
        stack.pop();
      } else if (!error) {
        error = `Mismatched delimiter '${c}'.`;
      }
      current += c;
      continue;
    }

    if (c === "\n" && stack.length === 0) {
      if (!push()) return { values, error };
      continue;
    }

    current += c;
    if (current.length > MAX_VALUE_LENGTH) {
      return {
        values,
        error: `Input value is too large. Maximum is ${MAX_VALUE_LENGTH} characters.`,
      };
    }
  }

  if (!push()) return { values, error };

  if (!error && inString) {
    error = "Unclosed string.";
  }

  if (!error && stack.length > 0) {
    const unclosed = stack[stack.length - 1]!;
    error = `Unclosed delimiter '${unclosed}'.`;
  }

  return error ? { values, error } : { values };
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
  return parseInputResult(input).values;
}

export interface ParsedInput {
  values: LCValue[];
  error?: string;
}

export function parseInputResult(input: string): ParsedInput {
  const scanned = scanInputValues(input);
  if (scanned.error) return { values: [], error: scanned.error };
  const values: LCValue[] = [];
  for (const raw of scanned.values) {
    const parsed = lenient(raw);
    if ("error" in parsed) return { values: [], error: parsed.error };
    values.push(parsed.value);
  }
  for (let i = 0; i < values.length; i += 1) {
    const error = valueLimitError(values[i]!);
    if (error) return { values: [], error: `Value ${i + 1}: ${error}` };
  }
  return { values };
}

function valueLimitError(value: LCValue): string | undefined {
  const pending: LCValue[] = [value];
  let items = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    items += 1;
    if (items > MAX_VALUE_ITEMS) return `too many items. Maximum is ${MAX_VALUE_ITEMS}.`;
    if (!isArray(current)) continue;
    for (let i = current.length - 1; i >= 0; i -= 1) pending.push(current[i]!);
  }
  return undefined;
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
