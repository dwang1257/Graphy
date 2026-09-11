import type { GEdge, GNode, GraphModel, MatrixData } from "../types.js";
import { contrastInkFromCss } from "../../panel/imageInk.js";
import type { Layout, Palette } from "../../settings/schema.js";

export interface EmitOptions {
  palette: Palette;
  layout: Layout;
}

export function emitDot(model: GraphModel, options: EmitOptions): string {
  const { palette, layout } = options;
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
      fillcolor: palette.nodeFill,
      color: palette.nodeStroke,
      fontcolor: contrastInkFromCss(palette.nodeFill),
      fontname: layout.fontFamily,
      fontsize: layout.fontSize * s,
      penwidth: layout.penWidth,
      margin: 0.04 * s,
    })}];`,
    `  edge [${attrs({
      color: palette.edgeColor,
      fontcolor: palette.edgeText,
      fontname: layout.fontFamily,
      fontsize: Math.max(8, layout.fontSize - 2) * s,
      penwidth: layout.penWidth,
      style: layout.edgeStyle,
      arrowsize: 0.7,
      dir: model.directed && layout.showArrowheads ? undefined : "none",
    })}];`,
  ];

  if (model.matrix) {
    lines.push(`  m [${attrs({ shape: "plaintext", style: "", label: html(matrixTable(model.matrix, options)) })}];`);
  } else {
    for (const node of model.nodes) lines.push(`  ${nodeLine(node, options)}`);
    for (const edge of model.edges) lines.push(`  ${edgeLine(edge, model.directed, options)}`);
    for (const group of model.ranks) {
      if (group.ids.length >= 2) lines.push(`  { rank=same; ${group.ids.map(id).join(" ")} }`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function nodeLine(node: GNode, { palette, layout }: EmitOptions): string {
  const { nodeSize } = layout;
  const base: Record<string, string | number | undefined> = { label: node.label };
  switch (node.role) {
    case "root":
      Object.assign(base, {
        fillcolor: palette.rootFill,
        color: palette.rootStroke,
        fontcolor: contrastInkFromCss(palette.rootFill),
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
          ? { color: palette.terminalText, fillcolor: palette.terminalText, penwidth: 1 }
          : { style: "invis" },
      );
      break;
    case "terminal":
      Object.assign(base, {
        shape: "plaintext",
        style: "",
        fontcolor: palette.terminalText,
        fontsize: (layout.fontSize + 2) * nodeSize,
      });
      break;
  }
  return `${id(node.id)} [${attrs(base)}];`;
}

function edgeLine(edge: GEdge, directed: boolean, { palette, layout }: EmitOptions): string {
  const base: Record<string, string | number | undefined> = { label: edge.label };
  if (edge.role === "spine") Object.assign(base, { style: "invis", weight: 10 });
  else if (edge.role === "null") {
    Object.assign(base, layout.showNullChildren
      ? { style: "dotted", color: palette.terminalText, penwidth: 1, arrowhead: "none" }
      : { style: "invis" });
  } else if (edge.role === "cycle") {
    Object.assign(base, {
      color: palette.cycleColor,
      fontcolor: palette.cycleColor,
      style: "solid",
      penwidth: layout.penWidth + 0.4,
      constraint: "false",
    });
  }
  return `${id(edge.from)} ${directed ? "->" : "--"} ${id(edge.to)} [${attrs(base)}];`;
}

function matrixTable(matrix: MatrixData, { palette, layout }: EmitOptions): string {
  const s = layout.nodeSize;
  const cellSize = Math.round(26 * s);
  const cellFontSize = layout.fontSize * s;
  const width = matrix.rows.reduce((w, row) => Math.max(w, row.length), 0);
  const rows: string[] = [];

  if (matrix.showIndices) {
    const header = [`<TD BORDER="0"></TD>`, ...Array.from({ length: width }, (_, c) => gutter(String(c), palette, layout))];
    rows.push(`<TR>${header.join("")}</TR>`);
  }

  matrix.rows.forEach((row, r) => {
    const tds = matrix.showIndices ? [gutter(String(r), palette, layout)] : [];
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
    rows.push(`<TR>${tds.join("")}</TR>`);
  });

  return `<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="2" COLOR="${esc(palette.cellStroke)}">${rows.join("")}</TABLE>`;
}

function gutter(text: string, palette: Palette, layout: Layout): string {
  const fontSize = Math.max(7, layout.fontSize - 3) * layout.nodeSize;
  return `<TD BORDER="0"><FONT COLOR="${esc(palette.gutterText)}" POINT-SIZE="${fontSize}">${htmlText(text)}</FONT></TD>`;
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

function esc(text: string): string {
  return htmlText(text).replace(/"/g, "&quot;");
}
