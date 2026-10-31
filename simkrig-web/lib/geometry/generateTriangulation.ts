import { calculateArea } from "./calculateArea";
import { calculatePerimeter } from "./calculatePerimeter";
import type { Drillhole } from "@/types/Drillhole";
import type { Triangle } from "@/types/Triangle";
import type { Vertex } from "@/types/Vertex";

type Coordinate = Pick<Vertex, "x" | "y">;
type TriangleVertices = [Vertex, Vertex, Vertex];

const GEOMETRY_EPSILON = 1e-8;

function cross(a: Coordinate, b: Coordinate, point: Coordinate): number {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

function compareVertices(a: Vertex, b: Vertex): number {
  return a.x - b.x || a.y - b.y || a.id.localeCompare(b.id);
}

function convexHull(vertices: readonly Vertex[]): Vertex[] {
  const sorted = [...vertices].sort(compareVertices);
  if (sorted.length <= 1) {
    return sorted;
  }

  const lower: Vertex[] = [];
  for (const vertex of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], vertex) <=
        GEOMETRY_EPSILON
    ) {
      lower.pop();
    }
    lower.push(vertex);
  }

  const upper: Vertex[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const vertex = sorted[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], vertex) <=
        GEOMETRY_EPSILON
    ) {
      upper.pop();
    }
    upper.push(vertex);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function pointOnSegment(
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
): boolean {
  if (Math.abs(cross(start, end, point)) > GEOMETRY_EPSILON) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - GEOMETRY_EPSILON &&
    point.x <= Math.max(start.x, end.x) + GEOMETRY_EPSILON &&
    point.y >= Math.min(start.y, end.y) - GEOMETRY_EPSILON &&
    point.y <= Math.max(start.y, end.y) + GEOMETRY_EPSILON
  );
}

function containsPoint(triangle: TriangleVertices, point: Coordinate): boolean {
  const [a, b, c] = triangle;
  const ab = cross(a, b, point);
  const bc = cross(b, c, point);
  const ca = cross(c, a, point);

  return (
    (ab >= -GEOMETRY_EPSILON &&
      bc >= -GEOMETRY_EPSILON &&
      ca >= -GEOMETRY_EPSILON) ||
    (ab <= GEOMETRY_EPSILON &&
      bc <= GEOMETRY_EPSILON &&
      ca <= GEOMETRY_EPSILON)
  );
}

function findContainingEdge(
  triangle: TriangleVertices,
  point: Coordinate,
): [Vertex, Vertex] | null {
  const edges: [Vertex, Vertex][] = [
    [triangle[0], triangle[1]],
    [triangle[1], triangle[2]],
    [triangle[2], triangle[0]],
  ];

  return (
    edges.find(([start, end]) => pointOnSegment(point, start, end)) ?? null
  );
}

function sameEdge(
  first: [Vertex, Vertex],
  second: [Vertex, Vertex],
): boolean {
  return (
    (first[0].id === second[0].id && first[1].id === second[1].id) ||
    (first[0].id === second[1].id && first[1].id === second[0].id)
  );
}

function splitTriangle(
  triangle: TriangleVertices,
  point: Vertex,
): TriangleVertices[] {
  const edge = findContainingEdge(triangle, point);
  if (edge) {
    const opposite = triangle.find(
      (vertex) => vertex.id !== edge[0].id && vertex.id !== edge[1].id,
    );
    if (!opposite) {
      return [];
    }

    return [
      [edge[0], point, opposite],
      [point, edge[1], opposite],
    ];
  }

  return [
    [triangle[0], triangle[1], point],
    [triangle[1], triangle[2], point],
    [triangle[2], triangle[0], point],
  ];
}

function triangleArea(vertices: TriangleVertices): number {
  return calculateArea(vertices);
}

export function generateTriangulation(
  drillholes: readonly Drillhole[],
): Triangle[] {
  if (drillholes.length < 3) {
    return [];
  }

  const vertices: Vertex[] = [];
  const seenCoordinates = new Set<string>();

  for (const drillhole of drillholes) {
    const coordinateKey = `${drillhole.x},${drillhole.y}`;
    if (seenCoordinates.has(coordinateKey)) {
      continue;
    }

    seenCoordinates.add(coordinateKey);
    vertices.push({
      id: drillhole.id,
      x: drillhole.x,
      y: drillhole.y,
    });
  }

  if (vertices.length < 3) {
    return [];
  }

  const hull = convexHull(vertices);
  if (hull.length < 3) {
    return [];
  }

  const hullIds = new Set(hull.map((vertex) => vertex.id));
  const triangles: TriangleVertices[] = [];

  for (let index = 1; index < hull.length - 1; index += 1) {
    triangles.push([hull[0], hull[index], hull[index + 1]]);
  }

  const interiorVertices = vertices
    .filter((vertex) => !hullIds.has(vertex.id))
    .sort(compareVertices);

  for (const vertex of interiorVertices) {
    const containingTriangles = triangles.filter((triangle) =>
      containsPoint(triangle, vertex),
    );
    if (containingTriangles.length === 0) {
      continue;
    }

    const containingEdge = containingTriangles
      .map((triangle) => findContainingEdge(triangle, vertex))
      .find((edge): edge is [Vertex, Vertex] => edge !== null);
    const remaining = triangles.filter(
      (triangle) => !containingTriangles.includes(triangle),
    );

    for (const triangle of containingTriangles) {
      const triangleEdge = findContainingEdge(triangle, vertex);
      if (containingEdge && triangleEdge && sameEdge(containingEdge, triangleEdge)) {
        remaining.push(...splitTriangle(triangle, vertex));
      } else if (!containingEdge && !triangleEdge) {
        remaining.push(...splitTriangle(triangle, vertex));
      } else if (!triangleEdge) {
        remaining.push(...splitTriangle(triangle, vertex));
      } else {
        remaining.push(triangle);
      }
    }

    triangles.splice(0, triangles.length, ...remaining);
  }

  return triangles
    .filter((triangle) => triangleArea(triangle) > GEOMETRY_EPSILON)
    .map((triangle, index) => {
      const verticesForTriangle: Vertex[] = triangle.map((vertex) => ({ ...vertex }));
      return {
        id: `triangle-${index + 1}`,
        drillholeIds: verticesForTriangle.map((vertex) => vertex.id),
        vertices: verticesForTriangle,
        area: triangleArea(triangle),
        perimeter: calculatePerimeter(triangle),
      };
    });
}
