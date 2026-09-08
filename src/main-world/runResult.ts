/** Pulls printable stdout out of a LeetCode `/check` response body. */
export function extractRunStdout(body: Record<string, unknown> | null): string | undefined {
  if (!body) return undefined;

  const fromCode = asLines(body.code_output);
  if (fromCode !== undefined) return fromCode;

  const fromList = asLines(body.std_output_list);
  if (fromList !== undefined) return fromList;

  if (typeof body.std_output === "string" && body.std_output.length > 0) {
    return body.std_output;
  }
  return undefined;
}

/**
 * LeetCode `std_output_list` is one string per custom test case.
 * Keep that array intact so playback can scope frames to the selected case.
 */
export function extractRunStdoutByCase(
  body: Record<string, unknown> | null,
): string[] | undefined {
  if (!body) return undefined;
  const list = body.std_output_list;
  if (!Array.isArray(list) || list.length === 0) return undefined;
  if (!list.every((entry): entry is string => typeof entry === "string")) return undefined;
  return list;
}

function asLines(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    const lines = value.filter((entry): entry is string => typeof entry === "string");
    if (lines.length === 0) return undefined;
    return lines.join("\n");
  }
  return undefined;
}
