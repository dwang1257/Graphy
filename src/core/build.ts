import { detectRole, type Role } from "./detect.js";
import { parseBinaryTree } from "./parse/binaryTree.js";
import { parseLinkedList } from "./parse/linkedList.js";
import { parseMatrix } from "./parse/matrix.js";
import { isNestedArray, parseInput, type LCValue } from "./parse/value.js";
import type { Signature } from "./signature.js";
import type { Pane, ParseResult, StructureKind } from "./types.js";

export interface BuildOptions {
  /** User's manual structure override; wins over every detected signal. */
  override?: StructureKind;
  showTerminal?: boolean;
  showIndices?: boolean;
}

/** Chooses the one pane shown by the tab-free panel. */
export function selectPrimaryPane(
  panes: Pane[],
  override?: StructureKind,
): Pane | undefined {
  if (override) {
    const matching = panes.find((pane) => pane.model.kind === override);
    if (matching) return matching;
  }
  return panes[0];
}

/**
 * Maps `data_input` lines onto signature parameters, then renders every
 * visualizable parameter into its own pane. Scalars like `n` and `pos` are not
 * panes of their own - they feed the linked-list builder.
 */
export function buildPanes(
  input: string,
  signature: Signature | null,
  options: BuildOptions = {},
): ParseResult {
  const values = parseInput(input);
  const result: ParseResult = { panes: [], failures: [] };
  if (values.length === 0) return result;

  const entries = values.map((value, i) => {
    const param = signature?.params[i];
    return { index: i, value, param, role: detectRole(param, value) };
  });

  const cyclePos = numberFor(entries, "cycle-pos");

  const visual = entries.filter((e) => isStructure(e.role.kind));
  const targets = visual.length > 0 || !options.override
    ? visual
    : entries.filter((e) => Array.isArray(e.value)).slice(0, 1);

  for (const entry of targets) {
    const kind = options.override ?? (entry.role.kind as StructureKind);
    const title = entry.param?.name ?? `arg ${entry.index + 1}`;

    try {
      result.panes.push(
        ...buildFor(kind, entry.value, title, `p${entry.index}`, {
          cyclePos,
          showTerminal: options.showTerminal,
          showIndices: options.showIndices,
        }),
      );
    } catch (error) {
      result.failures.push({ paramName: title, reason: String(error) });
    }
  }

  if (result.panes.length === 0 && result.failures.length === 0) {
    result.failures.push({
      paramName: "input",
      reason: "No visualizable parameter found for this structure.",
    });
  }
  return result;
}

interface BuildContext {
  cyclePos?: number;
  showTerminal?: boolean;
  showIndices?: boolean;
}

function buildFor(
  kind: StructureKind,
  value: LCValue,
  title: string,
  id: string,
  ctx: BuildContext,
): Pane[] {
  switch (kind) {
    case "binary-tree":
      return [{ id, title, model: parseBinaryTree(value, title) }];

    case "linked-list":
      // `vector<ListNode*> lists` arrives as an array of arrays - one pane each.
      if (isNestedArray(value)) {
        return value.map((sub, j) => ({
          id: `${id}_${j}`,
          title: `${title}[${j}]`,
          model: parseLinkedList(sub, `${title}[${j}]`, { showTerminal: ctx.showTerminal }),
        }));
      }
      return [{
        id,
        title,
        model: parseLinkedList(value, title, {
          cyclePos: ctx.cyclePos,
          showTerminal: ctx.showTerminal,
        }),
      }];

    case "matrix":
      return [{ id, title, model: parseMatrix(value, title, ctx.showIndices !== false) }];
  }
}

function isStructure(kind: Role["kind"]): kind is StructureKind {
  return kind !== "ignore" && kind !== "node-count" && kind !== "cycle-pos";
}

function numberFor(
  entries: Array<{ value: LCValue; role: Role }>,
  kind: "cycle-pos",
): number | undefined {
  const hit = entries.find((e) => e.role.kind === kind && typeof e.value === "number");
  return hit ? (hit.value as number) : undefined;
}
