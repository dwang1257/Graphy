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

/** Splits a custom-testcase blob into one parsed value per line. */
export function parseInput(input: string): LCValue[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  return lines.map((line) => lenient(line.trim()));
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
