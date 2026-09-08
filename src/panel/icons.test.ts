/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";

import {
  BoxIcon,
  CircleIcon,
  CloseIcon,
  DiamondIcon,
  DoubleCircleIcon,
  EdgeBoldIcon,
  EdgeDashedIcon,
  EdgeDottedIcon,
  EdgeSolidIcon,
  EllipseIcon,
  ExpandIcon,
  FitIcon,
  HexagonIcon,
  PauseIcon,
  PlayIcon,
  ShrinkIcon,
  SquareIcon,
  StepBackIcon,
  StepForwardIcon,
} from "./icons.js";

describe("icons", () => {
  it("exports a consistent stroke set for chrome controls", () => {
    const icons = [
      CloseIcon(),
      FitIcon(),
      ShrinkIcon(),
      ExpandIcon(),
      PlayIcon(),
      PauseIcon(),
      StepBackIcon(),
      StepForwardIcon(),
      CircleIcon(),
      EllipseIcon(),
      BoxIcon(),
      SquareIcon(),
      DiamondIcon(),
      HexagonIcon(),
      DoubleCircleIcon(),
      EdgeSolidIcon(),
      EdgeDashedIcon(),
      EdgeDottedIcon(),
      EdgeBoldIcon(),
    ];

    for (const icon of icons) {
      expect(icon.type).toBe("svg");
      expect(icon.props.viewBox).toBe("0 0 16 16");
      expect(icon.props["stroke-width"]).toBe(1.5);
    }
  });
});
