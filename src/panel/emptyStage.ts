/** True when the stage should show "No Nodes" instead of a graph. */
export function isEmptyStage(input: {
  caseInput: string;
  nodeCount: number;
  hasFailure: boolean;
}): boolean {
  if (!input.caseInput.trim()) return true;
  return input.nodeCount === 0 && !input.hasFailure;
}
