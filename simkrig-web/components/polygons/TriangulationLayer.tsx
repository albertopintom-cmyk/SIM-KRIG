"use client";

import type { Triangle } from "@/types/Triangle";
import { CANVAS_HEIGHT } from "@/lib/geometry/polygonTypes";

type TriangulationLayerProps = {
  triangles: readonly Triangle[];
};

export default function TriangulationLayer({
  triangles,
}: TriangulationLayerProps) {
  return (
    <g className="triangulation-layer" aria-label="Red de triangulación">
      {triangles.map((triangle, index) => {
        const points = triangle.vertices
          .map((vertex) => `${vertex.x},${CANVAS_HEIGHT - vertex.y}`)
          .join(" ");
        const centerX =
          triangle.vertices.reduce((total, vertex) => total + vertex.x, 0) / 3;
        const centerY =
          CANVAS_HEIGHT -
          triangle.vertices.reduce((total, vertex) => total + vertex.y, 0) / 3;

        return (
          <g className="triangulation-cell" key={triangle.id}>
            <polygon
              aria-label={`Triángulo ${index + 1}, área ${triangle.area.toFixed(2)} metros cuadrados`}
              points={points}
            />
            <text x={centerX} y={centerY}>
              T{String(index + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </g>
  );
}
