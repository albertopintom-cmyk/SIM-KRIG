import type { Point } from "./polygonTypes";

export function calculateArea(vertices: readonly Point[]): number {
  if (vertices.length < 3) {
    return 0;
  }

  let twiceArea = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }

  return Math.abs(twiceArea) / 2;
}
