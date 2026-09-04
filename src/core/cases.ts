export function clampCaseIndex(index: number, caseCount: number): number {
  if (caseCount <= 0) return 0;
  return Math.min(Math.max(0, index), caseCount - 1);
}
