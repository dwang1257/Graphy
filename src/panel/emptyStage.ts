import { NODE_LIMIT } from "../settings/schema.js";

export const EMPTY_STAGE_COPY = "Run your code to see the graph.";

export function isTooLarge(nodeCount: number): boolean {
  return nodeCount > NODE_LIMIT;
}

export function tooLargeCopy(nodeCount: number): string {
  return `This graph has ${nodeCount} nodes. Graphy only shows graphs with ${NODE_LIMIT} nodes or fewer.`;
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
