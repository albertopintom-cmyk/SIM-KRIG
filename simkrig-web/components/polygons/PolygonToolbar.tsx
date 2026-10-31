"use client";

import {
  METHOD_LABELS,
  type PolygonMethod,
} from "@/lib/geometry/polygonTypes";

type PolygonToolbarProps = {
  method: PolygonMethod;
  width: number;
  height: number;
  vertexCount: number;
  canUndo: boolean;
  onMethodChange: (method: PolygonMethod) => void;
  onDimensionsChange: (dimensions: { width: number; height: number }) => void;
  onUndo: () => void;
  onClear: () => void;
};

const availableMethods: PolygonMethod[] = ["triangle", "rectangle", "free"];
const upcomingMethods: PolygonMethod[] = [
  "voronoi",
  "convex-hull",
  "alpha-shape",
];

export default function PolygonToolbar({
  method,
  width,
  height,
  vertexCount,
  canUndo,
  onMethodChange,
  onDimensionsChange,
  onUndo,
  onClear,
}: PolygonToolbarProps) {
  return (
    <aside className="polygon-panel polygon-toolbar">
      <div className="panel-heading">
        <span className="section-index">01</span>
        <div>
          <h2>Método de construcción</h2>
          <p>Selecciona una geometría para comenzar</p>
        </div>
      </div>

      <div className="method-list" role="group" aria-label="Método de construcción">
        {availableMethods.map((availableMethod) => (
          <button
            aria-pressed={method === availableMethod}
            className={`method-option ${method === availableMethod ? "is-selected" : ""}`}
            key={availableMethod}
            onClick={() => onMethodChange(availableMethod)}
            type="button"
          >
            <span className="method-symbol" aria-hidden="true">
              {availableMethod === "triangle"
                ? "△"
                : availableMethod === "rectangle"
                  ? "□"
                  : "⬡"}
            </span>
            <span>{METHOD_LABELS[availableMethod]}</span>
            <span className="method-check" aria-hidden="true">
              {method === availableMethod ? "●" : ""}
            </span>
          </button>
        ))}

        <div className="method-divider" />

        {upcomingMethods.map((upcomingMethod) => (
          <div className="method-option method-option-disabled" key={upcomingMethod}>
            <span className="method-symbol" aria-hidden="true">
              {upcomingMethod === "voronoi"
                ? "◈"
                : upcomingMethod === "convex-hull"
                  ? "⬡"
                  : "⌁"}
            </span>
            <span>{METHOD_LABELS[upcomingMethod]}</span>
            <span className="coming-soon">Próximamente</span>
          </div>
        ))}
      </div>

      {method === "rectangle" && (
        <section className="dimensions-section" aria-labelledby="dimensions-heading">
          <div className="subsection-title">
            <h3 id="dimensions-heading">Dimensiones</h3>
            <span>METROS</span>
          </div>
          <div className="dimension-inputs">
            <label>
              Ancho
              <span className="input-with-unit">
                <input
                  aria-label="Ancho del rectángulo en metros"
                  max={1000}
                  min={1}
                  onChange={(event) =>
                    onDimensionsChange({
                      width: Number(event.target.value),
                      height,
                    })
                  }
                  type="number"
                  value={width}
                />
                <span>m</span>
              </span>
            </label>
            <label>
              Alto
              <span className="input-with-unit">
                <input
                  aria-label="Alto del rectángulo en metros"
                  max={640}
                  min={1}
                  onChange={(event) =>
                    onDimensionsChange({
                      width,
                      height: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={height}
                />
                <span>m</span>
              </span>
            </label>
          </div>
          <p className="helper-text">Se genera centrado en el área de trabajo.</p>
        </section>
      )}

      <section className="editing-section">
        <div className="subsection-title">
          <h3>Edición</h3>
          <span>{vertexCount} VÉRTICES</span>
        </div>
        <button
          className="tool-button"
          disabled={!canUndo}
          onClick={onUndo}
          type="button"
        >
          <span aria-hidden="true">↶</span>
          Deshacer último vértice
        </button>
        <button
          className="tool-button tool-button-muted"
          disabled={vertexCount === 0}
          onClick={onClear}
          type="button"
        >
          <span aria-hidden="true">⌫</span>
          Limpiar geometría
        </button>
      </section>

      <div className="toolbar-hint">
        <span className="hint-icon" aria-hidden="true">i</span>
        <p>
          {method === "triangle"
            ? "Haz clic en el canvas para marcar exactamente 3 vértices."
            : method === "rectangle"
              ? "Ajusta las dimensiones o arrastra sus vértices."
              : "Haz clic para agregar vértices y arrástralos para ajustar su posición."}
        </p>
      </div>
    </aside>
  );
}
