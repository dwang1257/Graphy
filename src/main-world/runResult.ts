import { MAX_STDOUT_CASES, MAX_STDOUT_LENGTH } from "../shared/protocol.js";

export function extractRunStdout(body: Record<string, unknown> | null): string | undefined {
  if (!body) return undefined;
  return asLines(body.code_output) ?? asLines(body.std_output_list) ?? nonEmptyText(body.std_output);
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

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STDOUT_LENGTH ? value : undefined;
}

function asLines(value: unknown): string | undefined {
  if (!Array.isArray(value)) return nonEmptyText(value);
  if (value.length === 0 || value.length > MAX_STDOUT_CASES) return undefined;
  if (!value.every((entry): entry is string => typeof entry === "string")) return undefined;
  const text = value.join("\n");
  return text.length <= MAX_STDOUT_LENGTH ? text : undefined;
}
