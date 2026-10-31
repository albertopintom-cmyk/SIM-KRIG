import { CANVAS_HEIGHT } from "./polygonTypes";
import type { Drillhole } from "@/types/Drillhole";
import type { Point } from "./polygonTypes";

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MINIMUM_EXTENT = 100;
const EXTENT_PADDING = 0.1;

export function calculateWorkspaceExtents(
  drillholes: readonly Drillhole[],
  vertices: readonly Point[],
  aspectRatio = 1000 / 650,
): ViewBox {
  const coordinates = [
    ...drillholes.map(({ x, y }) => ({ x, y })),
    ...vertices.map(({ x, y }) => ({ x, y })),
  ];
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1000 / 650;

  if (coordinates.length === 0) {
    const width = Math.max(1000, CANVAS_HEIGHT * safeAspectRatio);
    const height = Math.max(640, 1000 / safeAspectRatio);
    return {
      x: 500 - width / 2,
      y: CANVAS_HEIGHT - 320 - height / 2,
      width,
      height,
    };
  }

  const minX = Math.min(...coordinates.map(({ x }) => x));
  const maxX = Math.max(...coordinates.map(({ x }) => x));
  const minY = Math.min(...coordinates.map(({ y }) => y));
  const maxY = Math.max(...coordinates.map(({ y }) => y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const paddedWidth = Math.max(maxX - minX, MINIMUM_EXTENT) * (1 + EXTENT_PADDING * 2);
  const paddedHeight =
    Math.max(maxY - minY, MINIMUM_EXTENT) * (1 + EXTENT_PADDING * 2);
  const width = Math.max(paddedWidth, paddedHeight * safeAspectRatio);
  const height = Math.max(paddedHeight, paddedWidth / safeAspectRatio);

  return {
    x: centerX - width / 2,
    y: CANVAS_HEIGHT - centerY - height / 2,
    width,
    height,
  };
}
