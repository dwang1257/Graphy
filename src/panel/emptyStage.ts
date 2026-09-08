import { NODE_LIMIT } from "../settings/schema.js";

/** Copy shown on the stage before a test case produces a graph. */
export const EMPTY_STAGE_COPY = "Run your code to see the graph.";

/** True when the graph is over the hard node cap. */
export function isTooLarge(nodeCount: number, limit = NODE_LIMIT): boolean {
  return nodeCount > limit;
}

/** On-screen error when a graph has more nodes than Graphy will draw. */
export function tooLargeCopy(nodeCount: number, limit = NODE_LIMIT): string {
  return `This graph has ${nodeCount} nodes. Graphy only shows graphs with ${limit} nodes or fewer.`;
}

/** True when the stage should show the empty prompt instead of a graph. */
export function isEmptyStage(input: {
  caseInput: string;
  nodeCount: number;
  hasFailure: boolean;
}): boolean {
  if (!input.caseInput.trim()) return true;
  return input.nodeCount === 0 && !input.hasFailure;
}
