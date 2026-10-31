import type { Point } from "./polygonTypes";

export function calculatePerimeter(vertices: readonly Point[]): number {
  if (vertices.length < 3) {
    return 0;
  }

  let perimeter = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    perimeter += Math.hypot(next.x - current.x, next.y - current.y);
  }

  return perimeter;
}
