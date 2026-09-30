import { TRACE_SENTINEL, traceLines } from "./traceWire.js";

export interface CaseStdoutSource {
  stdout?: string;
  stdoutByCase?: string[];
}

export function traceTextForCase(source: CaseStdoutSource | null | undefined, caseIndex: number): string {
  if (!source || caseIndex < 0) return "";
  if (source.stdoutByCase) {
    const text = source.stdoutByCase[caseIndex] ?? "";
    return traceLines(text)[0] ?? text;
  }
  const stdout = source.stdout ?? "";
  const lines = traceLines(stdout);
  if (lines.length === 0) return caseIndex === 0 ? stdout : "";
  return lines.find((line) => line.startsWith(`${TRACE_SENTINEL}${caseIndex} `)) ?? "";
}
