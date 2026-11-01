"use client";

import { useState } from "react";

type TriangulationControlsProps = {
  drillholeCount: number;
  triangleCount: number;
  hasGenerated: boolean;
  onGenerate: () => void;
  onClear: () => void;
};

export default function TriangulationControls({
  drillholeCount,
  triangleCount,
  hasGenerated,
  onGenerate,
  onClear,
}: TriangulationControlsProps) {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const canGenerate = drillholeCount >= 3;

  return (
    <section className="polygon-panel triangulation-controls">
      <div className="panel-heading">
        <span className="section-index">03</span>
        <div>
          <h2>Triangulación</h2>
          <p>Red de triángulos desde sondajes</p>
        </div>
      </div>

      <div className="triangulation-algorithm">
        <span className="algorithm-status" />
        <span>ACTUAL</span>
        <strong>Abanico + inserción</strong>
      </div>

      <div className="triangulation-actions">
        <button
          className="generate-triangulation-button"
          disabled={!canGenerate}
          onClick={onGenerate}
          type="button"
        >
          <span aria-hidden="true">△</span>
          Generar triangulación
        </button>
        <button
          className="clear-triangulation-button"
          disabled={!hasGenerated && triangleCount === 0}
          onClick={() => setIsConfirmingClear(true)}
          type="button"
        >
          Clear Triangulation
        </button>
      </div>
      {isConfirmingClear && (
        <div
          aria-labelledby="clear-triangulation-heading"
          className="clear-triangulation-confirmation"
          role="group"
        >
          <p id="clear-triangulation-heading">Clear triangulation?</p>
          <div className="clear-triangulation-confirmation-actions">
            <button
              onClick={() => {
                onClear();
                setIsConfirmingClear(false);
              }}
              type="button"
            >
              Yes
            </button>
            <button
              onClick={() => setIsConfirmingClear(false)}
              type="button"
            >
              No
            </button>
          </div>
        </div>
      )}
      <p className="triangulation-hint">
        {canGenerate
          ? `${drillholeCount} sondajes disponibles para triangular.`
          : `Se requieren al menos 3 sondajes. Disponibles: ${drillholeCount}.`}
      </p>
      {triangleCount > 0 && (
        <div className="triangulation-ready">
          <span aria-hidden="true">✓</span>
          Red generada · {triangleCount} triángulos
        </div>
      )}
      {hasGenerated && triangleCount === 0 && (
        <div className="triangulation-error">
          No se pueden formar triángulos con estas posiciones.
        </div>
      )}
      <div className="future-algorithm">DELAUNAY · PRÓXIMAMENTE</div>
    </section>
  );
}
