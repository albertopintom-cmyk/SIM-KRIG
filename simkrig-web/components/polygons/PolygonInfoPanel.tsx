"use client";

import { calculateArea } from "@/lib/geometry/calculateArea";
import { calculatePerimeter } from "@/lib/geometry/calculatePerimeter";
import {
  METHOD_LABELS,
  type Point,
} from "@/lib/geometry/polygonTypes";
import type { Drillhole } from "@/types/Drillhole";
import type { InfluencePolygon } from "@/types/InfluencePolygon";
import type { Triangle } from "@/types/Triangle";
import PolygonVertexEditor from "./PolygonVertexEditor";

type PolygonInfoPanelProps = {
  polygon: InfluencePolygon;
  drillholes: readonly Drillhole[];
  triangles: readonly Triangle[];
  onMoveVertex: (index: number, point: Omit<Point, "id">) => void;
  onRemoveVertex: (index: number) => void;
  onToggleDrillhole: (id: string) => void;
};

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

export default function PolygonInfoPanel({
  polygon,
  drillholes,
  triangles,
  onMoveVertex,
  onRemoveVertex,
  onToggleDrillhole,
}: PolygonInfoPanelProps) {
  const { method, vertices, drillholeIds } = polygon;
  const isComplete = vertices.length >= 3;
  const area = calculateArea(vertices);
  const perimeter = calculatePerimeter(vertices);
  const triangulatedArea = triangles.reduce(
    (total, triangle) => total + triangle.area,
    0,
  );

  return (
    <aside className="polygon-panel polygon-info">
      <div className="panel-heading">
        <span className="section-index">04</span>
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
        <span>VÉRTICES DEL POLÍGONO</span>
        <strong>{String(vertices.length).padStart(2, "0")}</strong>
      </div>
      <div className="summary-vertex-count">
        <span>SONDAJES VINCULADOS</span>
        <strong>{String(drillholeIds.length).padStart(2, "0")}</strong>
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

      <section className="triangulation-summary" aria-labelledby="triangulation-summary-heading">
        <div className="subsection-title">
          <h3 id="triangulation-summary-heading">Red de triangulación</h3>
          <span>{triangles.length} TRIÁNGULOS</span>
        </div>
        <div className="triangulation-total-area">
          <span>ÁREA TRIANGULADA TOTAL</span>
          <strong>{triangles.length > 0 ? numberFormat.format(triangulatedArea) : "—"}</strong>
          <span>m²</span>
        </div>
        {triangles.length > 0 && (
          <div className="triangle-result-list">
            {triangles.map((triangle, index) => (
              <div className="triangle-result-row" key={triangle.id}>
                <strong>T{String(index + 1).padStart(2, "0")}</strong>
                <span className="triangle-drillhole-names">
                  {triangle.drillholeIds
                    .map(
                      (id) =>
                        drillholes.find((drillhole) => drillhole.id === id)?.name ??
                        id,
                    )
                    .join(" · ")}
                </span>
                <span className="triangle-result-measures">
                  {numberFormat.format(triangle.area)} m²
                  <small>{numberFormat.format(triangle.perimeter)} m</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="linked-drillholes" aria-labelledby="linked-drillholes-heading">
        <div className="subsection-title">
          <h3 id="linked-drillholes-heading">Sondajes vinculados</h3>
          <span>{drillholeIds.length} / {drillholes.length}</span>
        </div>
        {drillholes.length === 0 ? (
          <p className="vertex-empty">Agrega sondajes desde el gestor para vincularlos.</p>
        ) : (
          <div className="linked-drillhole-list">
            {drillholes.map((drillhole) => {
              const isLinked = drillholeIds.includes(drillhole.id);

              return (
                <div className="linked-drillhole-row" key={drillhole.id}>
                  <span className="drillhole-list-symbol" aria-hidden="true">⊕</span>
                  <div>
                    <strong>{drillhole.name}</strong>
                    <span>
                      X {drillhole.x.toFixed(1)} · Y {drillhole.y.toFixed(1)} m
                    </span>
                  </div>
                  <button
                    aria-label={`${isLinked ? "Desvincular" : "Vincular"} ${drillhole.name} ${isLinked ? "del" : "al"} polígono`}
                    aria-pressed={isLinked}
                    className={`link-drillhole-button ${isLinked ? "is-linked" : ""}`}
                    disabled={!isLinked && !isComplete}
                    onClick={() => onToggleDrillhole(drillhole.id)}
                    type="button"
                  >
                    {isLinked ? "Vinculado" : "Vincular"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
