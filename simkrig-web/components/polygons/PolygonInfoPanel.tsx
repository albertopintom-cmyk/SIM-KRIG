"use client";

import { calculateArea } from "@/lib/geometry/calculateArea";
import { calculatePerimeter } from "@/lib/geometry/calculatePerimeter";
import {
  METHOD_LABELS,
  type Point,
  type PolygonMethod,
} from "@/lib/geometry/polygonTypes";
import PolygonVertexEditor from "./PolygonVertexEditor";

type PolygonInfoPanelProps = {
  method: PolygonMethod;
  vertices: readonly Point[];
  onMoveVertex: (index: number, point: Omit<Point, "id">) => void;
  onRemoveVertex: (index: number) => void;
};

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

export default function PolygonInfoPanel({
  method,
  vertices,
  onMoveVertex,
  onRemoveVertex,
}: PolygonInfoPanelProps) {
  const isComplete = vertices.length >= 3;
  const area = calculateArea(vertices);
  const perimeter = calculatePerimeter(vertices);

  return (
    <aside className="polygon-panel polygon-info">
      <div className="panel-heading">
        <span className="section-index">03</span>
        <div>
          <h2>Resumen geométrico</h2>
          <p>Resultados en tiempo real</p>
        </div>
      </div>

      <div className="summary-method">
        <span className="summary-label">MÉTODO UTILIZADO</span>
        <strong>{METHOD_LABELS[method]}</strong>
        <span className="active-badge"><span /> ACTIVO</span>
      </div>

      <div className="summary-metrics">
        <div className="metric-card">
          <div className="metric-heading">
            <span className="metric-icon area-icon" aria-hidden="true">▧</span>
            <span>ÁREA</span>
          </div>
          <strong>{isComplete ? numberFormat.format(area) : "—"}</strong>
          <span className="metric-unit">m²</span>
        </div>
        <div className="metric-card">
          <div className="metric-heading">
            <span className="metric-icon perimeter-icon" aria-hidden="true">↗</span>
            <span>PERÍMETRO</span>
          </div>
          <strong>{isComplete ? numberFormat.format(perimeter) : "—"}</strong>
          <span className="metric-unit">m</span>
        </div>
      </div>

      <div className="summary-vertex-count">
        <span>VÉRTICES DEFINIDOS</span>
        <strong>{String(vertices.length).padStart(2, "0")}</strong>
      </div>

      <div className={`result-status ${isComplete ? "result-valid" : "result-pending"}`}>
        <span className="result-status-icon" aria-hidden="true">
          {isComplete ? "✓" : "◷"}
        </span>
        <div>
          <strong>{isComplete ? "Geometría válida" : "En construcción"}</strong>
          <p>
            {isComplete
              ? "El polígono está listo para analizar."
              : method === "triangle"
                ? `Agrega ${3 - vertices.length} vértice${vertices.length === 2 ? "" : "s"} para completar el triángulo.`
                : "Agrega al menos 3 vértices para calcular el polígono."}
          </p>
        </div>
      </div>

      <PolygonVertexEditor
        onMoveVertex={onMoveVertex}
        onRemoveVertex={onRemoveVertex}
        vertices={vertices}
      />

      <div className="calculation-note">
        <span aria-hidden="true">⌁</span>
        Área calculada mediante fórmula de Shoelace. Perímetro como suma de los lados.
      </div>
    </aside>
  );
}
