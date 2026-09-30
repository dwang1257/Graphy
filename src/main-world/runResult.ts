import { MAX_STDOUT_CASES, MAX_STDOUT_LENGTH } from "../shared/protocol.js";

export function extractRunStdout(body: Record<string, unknown> | null): string | undefined {
  if (!body) return undefined;

  const fromCode = asLines(body.code_output);
  if (fromCode !== undefined) return fromCode;

  const fromList = asLines(body.std_output_list);
  if (fromList !== undefined) return fromList;

  if (typeof body.std_output === "string" && body.std_output.length > 0 && body.std_output.length <= MAX_STDOUT_LENGTH) {
    return body.std_output;
  }
  return undefined;
}

export function extractRunStdoutByCase(
  body: Record<string, unknown> | null,
): string[] | undefined {
  if (!body) return undefined;
  const list = body.std_output_list;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_STDOUT_CASES) return undefined;
  if (!list.every((entry): entry is string => typeof entry === "string" && entry.length <= MAX_STDOUT_LENGTH)) return undefined;
  return list;
}

function asLines(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0 && value.length <= MAX_STDOUT_LENGTH) return value;
  if (Array.isArray(value)) {
    if (value.length > MAX_STDOUT_CASES) return undefined;
    let totalLength = 0;
    const lines: string[] = [];
    for (const entry of value) {
      if (typeof entry !== "string") return undefined;
      totalLength += entry.length;
      if (totalLength + Math.max(0, lines.length - 1) > MAX_STDOUT_LENGTH) return undefined;
      lines.push(entry);
    }
    if (lines.length === 0) return undefined;
    return lines.join("\n");
  }
  return undefined;
}
