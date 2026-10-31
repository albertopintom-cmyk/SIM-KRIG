"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculateWorkspaceExtents,
  getCoordinateBounds,
  type ViewBox,
} from "@/lib/geometry/calculateWorkspaceExtents";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type Point,
  type PolygonMethod,
} from "@/lib/geometry/polygonTypes";
import type { Drillhole } from "@/types/Drillhole";
import type { Triangle } from "@/types/Triangle";
import DrillholeLayer from "./DrillholeLayer";
import TriangulationLayer from "./TriangulationLayer";

function isNearBounds(
  point: { x: number; y: number },
  bounds: NonNullable<ReturnType<typeof getCoordinateBounds>>,
): boolean {
  const marginX = Math.max((bounds.maxX - bounds.minX) * 0.1, 50);
  const marginY = Math.max((bounds.maxY - bounds.minY) * 0.1, 50);

  return (
    point.x >= bounds.minX - marginX &&
    point.x <= bounds.maxX + marginX &&
    point.y >= bounds.minY - marginY &&
    point.y <= bounds.maxY + marginY
  );
}

type PolygonCanvasProps = {
  vertices: readonly Point[];
  drillholes: readonly Drillhole[];
  triangles: readonly Triangle[];
  selectedDrillholeId: string | null;
  linkedDrillholeIds: readonly string[];
  method: PolygonMethod;
  onAddVertex: (point: Omit<Point, "id">) => void;
  onMoveVertex: (index: number, point: Omit<Point, "id">) => void;
  onMoveDrillhole: (id: string, point: { x: number; y: number }) => void;
  onSelectDrillhole: (id: string) => void;
};

export default function PolygonCanvas({
  vertices,
  drillholes,
  triangles,
  selectedDrillholeId,
  linkedDrillholeIds,
  method,
  onAddVertex,
  onMoveVertex,
  onMoveDrillhole,
  onSelectDrillhole,
}: PolygonCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingTarget = useRef<
    { type: "vertex"; index: number } | { type: "drillhole"; id: string } | null
  >(null);
  const [dragViewBox, setDragViewBox] = useState<ViewBox | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1000 / 650);
  const [viewportWidth, setViewportWidth] = useState(1000);
  const importedDrillholes = drillholes.filter(
    (drillhole) => drillhole.source === "excel",
  );
  const importedBounds = getCoordinateBounds(importedDrillholes);
  const fitDrillholes = importedBounds
    ? drillholes.filter(
        (drillhole) =>
          drillhole.source === "excel" ||
          isNearBounds(drillhole, importedBounds),
      )
    : drillholes;
  const fitVertices = importedBounds
    ? vertices.filter((vertex) => isNearBounds(vertex, importedBounds))
    : vertices;
  const autoFitViewBox = calculateWorkspaceExtents(
    fitDrillholes,
    fitVertices,
    aspectRatio,
  );
  const viewBox = dragViewBox ?? autoFitViewBox;
  const importedMinX = importedBounds?.minX;
  const importedMaxX = importedBounds?.maxX;
  const importedMinY = importedBounds?.minY;
  const importedMaxY = importedBounds?.maxY;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setAspectRatio(width / height);
        setViewportWidth(width);
      }
    });

    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "development" ||
      importedMinX === undefined ||
      importedMaxX === undefined ||
      importedMinY === undefined ||
      importedMaxY === undefined
    ) {
      return;
    }

    console.debug("[SIM-KRIG] Drillhole Auto-Fit", {
      minX: importedMinX,
      maxX: importedMaxX,
      minY: importedMinY,
      maxY: importedMaxY,
      viewBox: {
        x: autoFitViewBox.x,
        y: autoFitViewBox.y,
        width: autoFitViewBox.width,
        height: autoFitViewBox.height,
      },
    });
  }, [
    drillholes,
    importedMinX,
    importedMaxX,
    importedMinY,
    importedMaxY,
    autoFitViewBox.x,
    autoFitViewBox.y,
    autoFitViewBox.width,
    autoFitViewBox.height,
  ]);

  function getCanvasPoint(
    event: React.PointerEvent<SVGSVGElement>,
  ): Omit<Point, "id"> {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = event.clientX;
      screenPoint.y = event.clientY;
      const worldPoint = screenPoint.matrixTransform(matrix.inverse());

      return {
        x: worldPoint.x,
        y: CANVAS_HEIGHT - worldPoint.y,
      };
    }

    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
      y:
        CANVAS_HEIGHT -
        ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
    };
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const target = event.target;
    const drillholeTarget =
      target instanceof Element
        ? target.closest<SVGElement>("[data-drillhole-id]")
        : null;

    if (drillholeTarget) {
      const drillholeId = drillholeTarget.dataset.drillholeId ?? "";
      draggingTarget.current = {
        type: "drillhole",
        id: drillholeId,
      };
      setDragViewBox(viewBox);
      onSelectDrillhole(drillholeId);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    const vertexTarget =
      target instanceof Element ? target.closest<SVGElement>("[data-vertex-index]") : null;

    if (vertexTarget) {
      draggingTarget.current = {
        type: "vertex",
        index: Number(vertexTarget.dataset.vertexIndex),
      };
      setDragViewBox(viewBox);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    onAddVertex(getCanvasPoint(event));
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = getCanvasPoint(event);
    if (draggingTarget.current?.type === "vertex") {
      onMoveVertex(draggingTarget.current.index, point);
    } else if (draggingTarget.current?.type === "drillhole") {
      onMoveDrillhole(draggingTarget.current.id, point);
    }
  }

  function handlePointerEnd(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingTarget.current = null;
    setDragViewBox(null);
  }

  const pointY = (vertex: Point) => CANVAS_HEIGHT - vertex.y;
  const selectedDrillhole = drillholes.find(
    (drillhole) => drillhole.id === selectedDrillholeId,
  );
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
        <div className="canvas-toolbar">
          {selectedDrillhole && (
            <div className="selected-drillhole-coordinates" aria-live="polite">
              <strong>{selectedDrillhole.name}</strong>
              <span>X {selectedDrillhole.x.toFixed(1)} m</span>
              <span>Y {selectedDrillhole.y.toFixed(1)} m</span>
            </div>
          )}
          <div
            aria-label="Encuadre automático activo, extensión centrada con 10% de margen"
            className="auto-fit-status"
          >
            <span className="scale-icon" aria-hidden="true">⌗</span>
            AUTO-FIT · 10%
          </div>
        </div>
      </div>

      <div className="canvas-frame">
        <div className="axis-label axis-label-x">X · ESTE (m)</div>
        <div className="axis-label axis-label-y">Y · NORTE (m)</div>
        <svg
          aria-label="Canvas SVG para crear y editar vértices del polígono"
          className="polygon-svg"
          ref={svgRef}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
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
          <rect
            fill="url(#minor-grid)"
            height={viewBox.height}
            width={viewBox.width}
            x={viewBox.x}
            y={viewBox.y}
          />
          <rect
            fill="url(#major-grid)"
            height={viewBox.height}
            width={viewBox.width}
            x={viewBox.x}
            y={viewBox.y}
          />
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
          <TriangulationLayer triangles={triangles} />
          <DrillholeLayer
            drillholes={drillholes}
            linkedDrillholeIds={linkedDrillholeIds}
            selectedDrillholeId={selectedDrillholeId}
            screenScale={viewBox.width / Math.max(viewportWidth, 1)}
            viewBox={viewBox}
            onMove={onMoveDrillhole}
          />
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
          {vertices.length === 0 && drillholes.length === 0 && (
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
        <div className="canvas-coordinate-origin">
          X {viewBox.x.toFixed(0)} · Y{" "}
          {(CANVAS_HEIGHT - viewBox.y - viewBox.height).toFixed(0)}
        </div>
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
