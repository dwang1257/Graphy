export const TRACE_SENTINEL = "\u{E000}";
export const PYTHON_SENTINEL = "\\ue000";

const TRACE_TAIL = /\u{E000}[^\n]*\n?/gu;

export function traceLines(text: string): string[] {
  return text.split("\n").flatMap((line) => {
    const at = line.indexOf(TRACE_SENTINEL);
    return at < 0 ? [] : [line.slice(at).replace(/\r$/, "")];
  });
}

function strip(text: string): string {
  return text.includes(TRACE_SENTINEL) ? text.replace(TRACE_TAIL, "") : text;
}

function stripList(list: unknown[], dropTraceOnly: boolean): unknown[] {
  return list.flatMap((entry) => {
    if (typeof entry !== "string") return [entry];
    if (dropTraceOnly && entry.startsWith(TRACE_SENTINEL) && strip(entry) === "") return [];
    return [strip(entry)];
  });
}

export function stripCheckBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const cleaned: Record<string, unknown> = { ...body };
  const code = body.code_output;
  if (typeof code === "string") cleaned.code_output = strip(code);
  else if (Array.isArray(code)) cleaned.code_output = stripList(code, true);
  if (Array.isArray(body.std_output_list)) cleaned.std_output_list = stripList(body.std_output_list, false);
  if (typeof body.std_output === "string") cleaned.std_output = strip(body.std_output);
  return JSON.stringify(cleaned) === JSON.stringify(body) ? null : cleaned;
}
