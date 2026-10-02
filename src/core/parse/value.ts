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

const PYTHON_LITERALS: ReadonlyArray<readonly [string, string]> = [
  ["None", "null"],
  ["True", "true"],
  ["False", "false"],
];

const INVALID_VALUE = "Invalid structured value.";
const VALUE_TOO_LARGE = `Input value is too large. Maximum is ${MAX_VALUE_LENGTH} characters.`;

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

    const literal = PYTHON_LITERALS.find(([word]) => raw.startsWith(word, i) && isWordBoundary(raw, i, word.length));
    if (literal) {
      result += literal[1];
      i += literal[0].length - 1;
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

function parseJson(text: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
}

function lenient(raw: string): { value: LCValue } | { error: string } {
  const parsed = parseJson(raw) ?? parseJson(normalizeLiteral(raw));
  if (!parsed) return /^[\[{(]/.test(raw) ? { error: INVALID_VALUE } : { value: raw };
  return isLCValue(parsed.value) ? { value: parsed.value } : { error: INVALID_VALUE };
}

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
      if (c === quote && !isEscapedQuote(normalized, i)) inString = false;
    } else if (c === '"' || c === "'") {
      inString = true;
      quote = c;
    } else if (c in OPEN_DELIMITERS) {
      if (stack.length >= MAX_VALUE_DEPTH) {
        return { values, error: `Input is too deeply nested. Maximum depth is ${MAX_VALUE_DEPTH}.` };
      }
      stack.push(c);
      current += c;
      continue;
    } else if (c in CLOSE_DELIMITERS) {
      if (stack.at(-1) === CLOSE_DELIMITERS[c]) stack.pop();
      else error ??= `Mismatched delimiter '${c}'.`;
      current += c;
      continue;
    } else if (c === "\n" && stack.length === 0) {
      if (!push()) return { values, error };
      continue;
    }

    current += c;
    if (current.length > MAX_VALUE_LENGTH) return { values, error: VALUE_TOO_LARGE };
  }

  if (!push()) return { values, error };

  if (inString) error ??= "Unclosed string.";
  const unclosed = stack.at(-1);
  if (unclosed !== undefined) error ??= `Unclosed delimiter '${unclosed}'.`;

  return error ? { values, error } : { values };
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

export function isNestedArray(v: LCValue): v is LCValue[][] {
  return isArray(v) && v.length > 0 && v.every(isArray);
}

export function isStringGrid(v: readonly LCValue[]): v is string[] {
  const first = v[0];
  return typeof first === "string" && first.length > 0 && v.every((row) => typeof row === "string" && row.length === first.length);
}

export function scalarText(v: LCValue): string {
  if (v === null) return "null";
  if (typeof v === "string") return v;
  return String(v);
}
