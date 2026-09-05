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

function asLines(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    const lines = value.filter((entry): entry is string => typeof entry === "string");
    if (lines.length === 0) return undefined;
    return lines.join("\n");
  }
  return undefined;
}
