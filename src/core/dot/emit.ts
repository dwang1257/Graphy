import type { GEdge, GNode, GraphModel, MatrixData } from "../types.js";
import type { Layout, Palette } from "../../settings/schema.js";

export interface EmitOptions {
  palette: Palette;
  layout: Layout;
}

/** Serializes a GraphModel to DOT. Matrices become one HTML-table node. */
export function emitDot(model: GraphModel, options: EmitOptions): string {
  const { palette, layout } = options;
  const nodeFontSize = layout.fontSize * layout.nodeSize;
  const nodeMargin = 0.04 * layout.nodeSize;
  const keyword = model.directed ? "digraph" : "graph";
  const lines: string[] = [`${keyword} G {`];

  // palette.backgroundImage is applied in CSS on the stage, not in DOT.
  lines.push(`  graph [${attrs({
    bgcolor: "transparent",
    rankdir: layout.rankdir,
    splines: layout.splines,
    nodesep: layout.nodeSep,
    ranksep: layout.rankSep,
    fontname: layout.fontFamily,
    // `dot` is free to reorder children without this; binary trees need it.
    ordering: model.kind === "binary-tree" ? "out" : undefined,
    pad: 0.2,
  })}];`);

  lines.push(`  node [${attrs({
    shape: layout.nodeShape,
    style: "filled",
    fillcolor: palette.nodeFill,
    color: palette.nodeStroke,
    fontcolor: palette.nodeText,
    fontname: layout.fontFamily,
    fontsize: nodeFontSize,
    penwidth: layout.penWidth,
    margin: nodeMargin,
  })}];`);

  lines.push(`  edge [${attrs({
    color: palette.edgeColor,
    fontcolor: palette.edgeText,
    fontname: layout.fontFamily,
    fontsize: Math.max(8, layout.fontSize - 2) * layout.nodeSize,
    penwidth: layout.penWidth,
    style: layout.edgeStyle,
    arrowsize: 0.7,
    dir: model.directed && layout.showArrowheads ? undefined : "none",
  })}];`);

  if (model.matrix) {
    lines.push(`  m [${attrs({ shape: "plaintext", style: "", label: html(matrixTable(model.matrix, options)) })}];`);
    lines.push("}");
    return lines.join("\n");
  }

  for (const node of model.nodes) lines.push(`  ${nodeLine(node, options)}`);
  for (const edge of model.edges) lines.push(`  ${edgeLine(edge, model.directed, options)}`);
  for (const group of model.ranks) {
    if (group.ids.length < 2) continue;
    lines.push(`  { rank=same; ${group.ids.map(id).join(" ")} }`);
  }

  lines.push("}");
  return lines.join("\n");
}

function nodeLine(node: GNode, { palette, layout }: EmitOptions): string {
  const { nodeSize } = layout;
  const base: Record<string, string | number | undefined> = { label: node.label };

  switch (node.role) {
    case "root":
      Object.assign(base, { fillcolor: palette.rootFill, color: palette.rootStroke, fontcolor: "#ffffff" });
      break;
    case "spine":
      Object.assign(base, { label: "", shape: "point", width: 0.001, height: 0.001, style: "invis" });
      break;
    case "null":
      Object.assign(base, layout.showNullChildren
        ? { label: "", shape: "point", width: 0.09 * nodeSize, color: palette.terminalText, fillcolor: palette.terminalText, penwidth: 1 }
        : { label: "", shape: "point", width: 0.09 * nodeSize, style: "invis" });
      break;
    case "terminal":
      Object.assign(base, { shape: "plaintext", style: "", fontcolor: palette.terminalText, fontsize: (layout.fontSize + 2) * nodeSize });
      break;
    case "normal":
      break;
  }
  return `${id(node.id)} [${attrs(base)}];`;
}

function edgeLine(edge: GEdge, directed: boolean, { palette, layout }: EmitOptions): string {
  const op = directed ? "->" : "--";
  const base: Record<string, string | number | undefined> = { label: edge.label };

  if (edge.role === "spine") {
    Object.assign(base, { style: "invis", weight: 10 });
  } else if (edge.role === "null") {
    Object.assign(base, layout.showNullChildren
      ? { style: "dotted", color: palette.terminalText, penwidth: 1, arrowhead: "none" }
      : { style: "invis" });
  } else if (edge.role === "cycle") {
    Object.assign(base, {
      color: palette.cycleColor,
      fontcolor: palette.cycleColor,
      style: "solid",
      penwidth: layout.penWidth + 0.4,
      // Cycle edges must not drag their target back up a rank.
      constraint: "false",
    });
  }
  return `${id(edge.from)} ${op} ${id(edge.to)} [${attrs(base)}];`;
}

function matrixTable(matrix: MatrixData, { palette, layout }: EmitOptions): string {
  const { nodeSize } = layout;
  const cellSize = Math.round(26 * nodeSize);
  const cellFontSize = layout.fontSize * nodeSize;
  let width = 0;
  for (const row of matrix.rows) width = Math.max(width, row.length);
  const cells: string[] = [];

  if (matrix.showIndices) {
    const header = [`<TD BORDER="0"></TD>`];
    for (let c = 0; c < width; c += 1) header.push(gutter(String(c), palette, layout));
    cells.push(`<TR>${header.join("")}</TR>`);
  }

  matrix.rows.forEach((row, r) => {
    const tds: string[] = [];
    if (matrix.showIndices) tds.push(gutter(String(r), palette, layout));
    for (let c = 0; c < width; c += 1) {
      const cell = row[c];
      if (!cell) {
        tds.push(`<TD BORDER="0"></TD>`);
        continue;
      }
      const fill = cell.filled ? palette.cellFill : palette.cellEmptyFill;
      tds.push(
        `<TD HREF="graphy://cell/${r}/${c}" BGCOLOR="${esc(fill)}" WIDTH="${cellSize}" HEIGHT="${cellSize}" ALIGN="CENTER">` +
        `<FONT COLOR="${esc(palette.cellText)}" POINT-SIZE="${cellFontSize}">${htmlText(cell.text)}</FONT></TD>`,
      );
    }
    cells.push(`<TR>${tds.join("")}</TR>`);
  });

  return `<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="2" COLOR="${esc(palette.cellStroke)}">${cells.join("")}</TABLE>`;
}

function gutter(text: string, palette: Palette, layout: Layout): string {
  const fontSize = Math.max(7, layout.fontSize - 3) * layout.nodeSize;
  return `<TD BORDER="0"><FONT COLOR="${esc(palette.gutterText)}" POINT-SIZE="${fontSize}">${htmlText(text)}</FONT></TD>`;
}

/** Marks a value as a raw HTML-like label so `attrs` skips quoting. */
const RAW = Symbol("raw");
type Raw = { [RAW]: true; text: string };

function html(text: string): Raw {
  return { [RAW]: true, text: `<${text}>` };
}

function attrs(bag: Record<string, string | number | Raw | undefined>): string {
  return Object.entries(bag)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (typeof v === "object" && v !== null && RAW in v) return `${k}=${v.text}`;
      if (typeof v === "number") return `${k}=${v}`;
      return `${k}="${quote(String(v))}"`;
    })
    .join(", ");
}

function quote(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** DOT identifiers are always quoted so node labels can contain anything. */
function id(raw: string): string {
  return `"${quote(raw)}"`;
}

function htmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function esc(text: string): string {
  return htmlText(text).replace(/"/g, "&quot;");
}
