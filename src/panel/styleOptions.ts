import { EDGE_STYLES, NODE_SHAPES, type EdgeStyle, type NodeShape } from "../settings/schema.js";

const NODE_SHAPE_LABELS: Record<NodeShape, string> = {
  circle: "Circle",
  ellipse: "Ellipse",
  box: "Box",
  square: "Square",
  diamond: "Diamond",
  hexagon: "Hexagon",
  doublecircle: "Double",
  plaintext: "Text",
};

const EDGE_STYLE_LABELS: Record<EdgeStyle, string> = {
  solid: "Solid",
  dashed: "Dashed",
  dotted: "Dotted",
  bold: "Bold",
};

type PickableNodeShape = Exclude<NodeShape, "plaintext" | "box">;

export function styleNodeShapes(): Array<[PickableNodeShape, string]> {
  return NODE_SHAPES.filter((shape): shape is PickableNodeShape => shape !== "plaintext" && shape !== "box").map(
    (shape) => [shape, NODE_SHAPE_LABELS[shape]],
  );
}

export function styleEdgeStyles(): Array<[EdgeStyle, string]> {
  return EDGE_STYLES.map((style) => [style, EDGE_STYLE_LABELS[style]]);
}
