/** Copy shown on the stage before a test case produces a graph. */
export const EMPTY_STAGE_COPY = "Run your code to see the graph.";

/** True when the stage should show the empty prompt instead of a graph. */
export function isEmptyStage(input: {
  caseInput: string;
  nodeCount: number;
  hasFailure: boolean;
}): boolean {
  if (!input.caseInput.trim()) return true;
  return input.nodeCount === 0 && !input.hasFailure;
}
