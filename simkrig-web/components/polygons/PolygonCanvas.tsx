"use client";

import { useRef } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type Point,
  type PolygonMethod,
} from "@/lib/geometry/polygonTypes";

type PolygonCanvasProps = {
  vertices: readonly Point[];
  method: PolygonMethod;
  onAddVertex: (point: Omit<Point, "id">) => void;
  onMoveVertex: (index: number, point: Omit<Point, "id">) => void;
};

export default function PolygonCanvas({
  vertices,
  method,
  onAddVertex,
  onMoveVertex,
}: PolygonCanvasProps) {
  const draggingIndex = useRef<number | null>(null);

  function getCanvasPoint(
    event: React.PointerEvent<SVGSVGElement>,
  ): Omit<Point, "id"> {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          CANVAS_WIDTH,
          ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          CANVAS_HEIGHT,
          CANVAS_HEIGHT -
            ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
        ),
      ),
    };
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const target = event.target;
    const vertexTarget =
      target instanceof Element ? target.closest<SVGElement>("[data-vertex-index]") : null;

    if (vertexTarget) {
      draggingIndex.current = Number(vertexTarget.dataset.vertexIndex);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    onAddVertex(getCanvasPoint(event));
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (draggingIndex.current !== null) {
      onMoveVertex(draggingIndex.current, getCanvasPoint(event));
    }
  }

  function handlePointerEnd(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingIndex.current = null;
  }

  const pointY = (vertex: Point) => CANVAS_HEIGHT - vertex.y;
  const points = vertices
    .map((vertex) => `${vertex.x},${pointY(vertex)}`)
    .join(" ");
  const isComplete = vertices.length >= 3;

  return (
    <section className="canvas-panel" aria-label="Área de trabajo">
      <div className="canvas-topbar">
        <div className="canvas-title-group">
          <span className="canvas-status-dot" />
          <div>
            <h2>Área de trabajo</h2>
            <p>Plano cartesiano · unidades en metros</p>
          </div>
        </div>
        <div className="canvas-scale">
          <span className="scale-icon" aria-hidden="true">⌗</span>
          ESCALA 1:1
        </div>
      </div>

      <div className="canvas-frame">
        <div className="axis-label axis-label-x">X · ESTE (m)</div>
        <div className="axis-label axis-label-y">Y · NORTE (m)</div>
        <svg
          aria-label="Canvas SVG para crear y editar vértices del polígono"
          className="polygon-svg"
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          preserveAspectRatio="none"
          role="application"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        >
          <defs>
            <pattern
              height="50"
              id="minor-grid"
              patternUnits="userSpaceOnUse"
              width="50"
            >
              <path className="grid-line" d="M 50 0 L 0 0 0 50" fill="none" />
            </pattern>
            <pattern
              height="250"
              id="major-grid"
              patternUnits="userSpaceOnUse"
              width="250"
            >
              <path className="major-grid-line" d="M 250 0 L 0 0 0 250" fill="none" />
            </pattern>
          </defs>
          <rect fill="url(#minor-grid)" height={CANVAS_HEIGHT} width={CANVAS_WIDTH} />
          <rect fill="url(#major-grid)" height={CANVAS_HEIGHT} width={CANVAS_WIDTH} />
          <line
            className="canvas-axis"
            x1={CANVAS_WIDTH / 2}
            x2={CANVAS_WIDTH / 2}
            y1="0"
            y2={CANVAS_HEIGHT}
          />
          <line
            className="canvas-axis"
            x1="0"
            x2={CANVAS_WIDTH}
            y1={CANVAS_HEIGHT / 2}
            y2={CANVAS_HEIGHT / 2}
          />

          {vertices.length > 1 && !isComplete && (
            <polyline
              className={`polygon-outline ${isComplete ? "polygon-complete" : ""}`}
              points={points}
            />
          )}
          {isComplete && <polygon className="polygon-fill" points={points} />}
          {vertices.map((vertex, index) => (
            <g
              className="vertex-marker"
              data-vertex-index={index}
              key={vertex.id}
              aria-label={`Vértice ${index + 1}, X ${vertex.x.toFixed(1)} metros, Y ${vertex.y.toFixed(1)} metros. Usa las flechas para moverlo.`}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 10 : 1;
                let x = vertex.x;
                let y = vertex.y;

                if (event.key === "ArrowLeft") x -= step;
                else if (event.key === "ArrowRight") x += step;
                else if (event.key === "ArrowDown") y -= step;
                else if (event.key === "ArrowUp") y += step;
                else return;

                event.preventDefault();
                onMoveVertex(index, { x, y });
              }}
              role="button"
              tabIndex={0}
            >
              <circle className="vertex-hit-area" cx={vertex.x} cy={pointY(vertex)} r="18" />
              <circle className="vertex-halo" cx={vertex.x} cy={pointY(vertex)} r="9" />
              <circle className="vertex-core" cx={vertex.x} cy={pointY(vertex)} r="4" />
              <text className="vertex-label" x={vertex.x + 13} y={pointY(vertex) - 13}>
                V{index + 1}
              </text>
            </g>
          ))}
          {vertices.length === 0 && (
            <g className="canvas-empty-state" pointerEvents="none">
              <circle cx={CANVAS_WIDTH / 2} cy={CANVAS_HEIGHT / 2 - 20} r="25" />
              <path
                d={`M ${CANVAS_WIDTH / 2 - 10} ${CANVAS_HEIGHT / 2 - 20} h 20 M ${CANVAS_WIDTH / 2} ${CANVAS_HEIGHT / 2 - 30} v 20`}
              />
              <text x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2 + 28}>
                Haz clic para comenzar
              </text>
              <text className="canvas-empty-subtitle" x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2 + 52}>
                Define los vértices de tu polígono sobre la cuadrícula
              </text>
            </g>
          )}
        </svg>
        <div className="canvas-coordinate-origin">0, 0</div>
      </div>

      <div className="canvas-footer">
        <span>
          MÉTODO ACTIVO <strong>{method === "triangle" ? "TRIÁNGULO" : method === "rectangle" ? "RECTÁNGULO" : "POLÍGONO LIBRE"}</strong>
        </span>
        <span>
          {method === "triangle" && vertices.length < 3
            ? `VÉRTICES ${vertices.length} / 3`
            : `${vertices.length} VÉRTICES`}
        </span>
      </div>
    </section>
  );
}
