/** Case-break token emitted at the start of each top-level Solution call. */
const CASE_BREAK = /^(\s*#?g(?:raphy)?)\s*\/(.*)$/i;

function caseBreakRemainder(line: string): { prefix: string; rest: string } | null {
  const match = CASE_BREAK.exec(line);
  if (!match) return null;
  return { prefix: match[1] ?? "", rest: (match[2] ?? "").trim() };
}

/**
 * Splits a joined Run stdout blob on `#g/` / `#g /` / `#graphy /`.
 * `#graphy clear` is a highlight reset, not a case boundary.
 */
export function splitStdoutByCase(stdout: string): string[] {
  const lines = stdout.split(/\r?\n/);
  const segments: string[][] = [[]];
  let sawBreak = false;

  for (const line of lines) {
    const broken = caseBreakRemainder(line);
    if (broken === null) {
      segments[segments.length - 1]?.push(line);
      continue;
    }
    sawBreak = true;
    const restLine = broken.rest ? `${broken.prefix} ${broken.rest}` : "";
    const current = segments[segments.length - 1];
    if (segments.length === 1 && current && current.length === 0) {
      if (restLine) current.push(restLine);
    } else {
      segments.push(restLine ? [restLine] : []);
    }
  }

  if (!sawBreak) return [stdout];
  return segments.map((part) => part.join("\n")).filter((segment) => segment.length > 0);
}

/** Snapshot fields needed to pick one case's trace. */
export interface CaseStdoutSource {
  stdout?: string;
  stdoutByCase?: string[];
}

/**
 * Stdout for Case N only. Prefers `stdoutByCase[n]`; otherwise splits a joined
 * blob on case-break markers. Never returns a later case's trace.
 */
export function stdoutForCase(
  snapshot: CaseStdoutSource | null | undefined,
  caseIndex: number,
): string {
  if (!snapshot || caseIndex < 0) return "";
  const byCase = snapshot.stdoutByCase;
  if (byCase) {
    if (caseIndex >= byCase.length) return "";
    return byCase[caseIndex] ?? "";
  }
  if (!snapshot.stdout) return "";
  const parts = splitStdoutByCase(snapshot.stdout);
  return parts[caseIndex] ?? "";
}
