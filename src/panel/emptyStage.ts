import { NODE_LIMIT } from "../settings/schema.js";

export const EMPTY_STAGE_COPY = "Add a testcase to see its graph.";

export const EMPTY_CUSTOM_COPY = "Fill in the inputs and press Enter.";

export function isTooLarge(nodeCount: number): boolean {
  return nodeCount > NODE_LIMIT;
}

export function tooLargeCopy(nodeCount: number): string {
  return `This graph has ${nodeCount} nodes. Graphy only shows graphs with ${NODE_LIMIT} nodes or fewer.`;
}

export function isEmptyStage(input: {
  caseInput: string;
  nodeCount: number;
  hasFailure: boolean;
  hasPane: boolean;
}): boolean {
  if (!input.caseInput.trim()) return true;
  return input.nodeCount === 0 && !input.hasFailure && !input.hasPane;
}
