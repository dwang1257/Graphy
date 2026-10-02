import type { GEdge, GNode, GraphModel, MatrixData } from "../types.js";
import { gridPaneOf } from "../scene.js";
import type { Layout } from "../../settings/schema.js";
import { PLACEHOLDER as paint } from "./paintRoles.js";

export interface EmitOptions {
  layout: Layout;
}

export function emitDot(model: GraphModel, options: EmitOptions): string {
  const { layout } = options;
  const s = layout.nodeSize;
  const keyword = model.directed ? "digraph" : "graph";
  const lines = [
    `${keyword} G {`,
    `  graph [${attrs({
      bgcolor: "transparent",
      rankdir: layout.rankdir,
      splines: layout.splines,
      nodesep: layout.nodeSep,
      ranksep: layout.rankSep,
      fontname: layout.fontFamily,
      ordering: model.kind === "binary-tree" ? "out" : undefined,
      pad: 0.2,
    })}];`,
    `  node [${attrs({
      shape: layout.nodeShape,
      style: "filled",
      fillcolor: paint.nodeFill,
      color: paint.nodeStroke,
      fontcolor: paint.nodeInk,
      fontname: layout.fontFamily,
      fontsize: layout.fontSize * s,
      penwidth: layout.penWidth,
      margin: 0.04 * s,
    })}];`,
    `  edge [${attrs({
      color: paint.edge,
      fontcolor: paint.edgeText,
      fontname: layout.fontFamily,
      fontsize: Math.max(8, layout.fontSize - 2) * s,
      penwidth: layout.penWidth,
      style: layout.edgeStyle,
      arrowsize: 0.7,
      dir: model.directed && layout.showArrowheads ? undefined : "none",
    })}];`,
  ];

  if (model.nodes.length === 0) {
    lines.push(`  empty [${attrs({
      shape: "plaintext",
      style: "",
      label: "∅",
      fontcolor: paint.terminal,
      fontsize: (layout.fontSize + 2) * s,
    })}];`);
  }
  const ranked = new Set(model.ranks.flatMap((group) => group.ids));
  for (const node of model.nodes) lines.push(`  ${nodeLine(node, options, ranked.has(node.id))}`);
  for (const edge of model.edges) lines.push(`  ${edgeLine(edge, model.directed, options)}`);
  for (const group of model.ranks) {
    if (group.ids.length >= 2) lines.push(`  { rank=same; ${group.ids.map(id).join(" ")} }`);
  }

  lines.push("}");
  return lines.join("\n");
}

function nodeLine(node: GNode, options: EmitOptions, ranked: boolean): string {
  const { layout } = options;
  const { nodeSize } = layout;
  if (node.matrix) {
    return `${id(node.id)} [${attrs({ shape: "plaintext", style: "", label: html(matrixTable(node.matrix, gridPaneOf(node.id) ?? "a", options)) })}];`;
  }
  const base: Record<string, string | number | undefined> = { label: node.label };
  switch (node.role) {
    case "root":
      Object.assign(base, {
        fillcolor: paint.rootFill,
        color: paint.rootStroke,
        fontcolor: paint.rootInk,
      });
      break;
    case "spine":
      Object.assign(base, { label: "", shape: "point", width: 0.001, height: 0.001, style: "invis" });
      break;
    case "null":
      Object.assign(
        base,
        { label: "", shape: "point", width: 0.09 * nodeSize },
        layout.showNullChildren
          ? { color: paint.terminal, fillcolor: paint.terminal, penwidth: 1 }
          : { style: "invis" },
      );
      break;
    case "title":
      Object.assign(base, {
        shape: "plaintext",
        style: "",
        fontcolor: paint.edgeText,
        fontsize: Math.max(8, layout.fontSize - 3) * nodeSize,
        height: 0,
        margin: 0,
      }, ranked ? { width: 0 } : { fixedsize: "true" });
      break;
    case "terminal":
      Object.assign(base, {
        shape: "plaintext",
        style: "",
        fontcolor: paint.terminal,
        fontsize: (layout.fontSize + 2) * nodeSize,
        width: 0,
        height: 0,
        margin: 0,
      });
      break;
  }
  return `${id(node.id)} [${attrs(base)}];`;
}

function edgeLine(edge: GEdge, directed: boolean, { layout }: EmitOptions): string {
  const base: Record<string, string | number | undefined> = { label: edge.label };
  if ("constraint" in edge && edge.constraint === false) base.constraint = "false";
  if (edge.role === "spine") Object.assign(base, { style: "invis", weight: 10 });
  else if (edge.role === "null") {
    Object.assign(base, layout.showNullChildren
      ? { style: "dotted", color: paint.terminal, penwidth: 1, arrowhead: "none" }
      : { style: "invis" });
  } else if (edge.role === "cycle") {
    Object.assign(base, {
      color: paint.cycle,
      fontcolor: paint.cycle,
      style: "solid",
      penwidth: layout.penWidth + 0.4,
      constraint: "false",
    });
  }
  return `${id(edge.from)} ${directed ? "->" : "--"} ${id(edge.to)} [${attrs(base)}];`;
}

function matrixTable(matrix: MatrixData, pane: string, { layout }: EmitOptions): string {
  const s = layout.nodeSize;
  const cellSize = Math.round(26 * s);
  const cellFontSize = layout.fontSize * s;
  const width = matrix.rows.reduce((w, row) => Math.max(w, row.length), 0);
  const rows: string[] = [];

  if (matrix.showIndices) {
    const header = [`<TD BORDER="0"></TD>`, ...Array.from({ length: width }, (_, c) => gutter(String(c), layout))];
    rows.push(`<TR>${header.join("")}</TR>`);
  }

  matrix.rows.forEach((row, r) => {
    const tds = matrix.showIndices ? [gutter(String(r), layout)] : [];
    for (let c = 0; c < width; c += 1) {
      const cell = row[c];
      if (!cell) {
        tds.push(`<TD BORDER="0"></TD>`);
        continue;
      }
      const fill = cell.filled ? paint.cellFill : paint.cellEmptyFill;
      tds.push(
        `<TD HREF="graphy://cell/${pane}/${r}/${c}" BGCOLOR="${fill}" WIDTH="${cellSize}" HEIGHT="${cellSize}" ALIGN="CENTER">` +
        `<FONT COLOR="${paint.cellText}" POINT-SIZE="${cellFontSize}">${htmlText(cell.text)}</FONT></TD>`,
      );
    }
    rows.push(`<TR>${tds.join("")}</TR>`);
  });

  return `<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="2" COLOR="${paint.cellStroke}">${rows.join("")}</TABLE>`;
}

function gutter(text: string, layout: Layout): string {
  const fontSize = Math.max(7, layout.fontSize - 3) * layout.nodeSize;
  return `<TD BORDER="0"><FONT COLOR="${paint.gutterText}" POINT-SIZE="${fontSize}">${htmlText(text)}</FONT></TD>`;
}

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

function id(raw: string): string {
  return `"${quote(raw)}"`;
}

function htmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
