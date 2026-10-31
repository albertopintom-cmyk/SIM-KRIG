"use client";

import { useState } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
} from "@/lib/geometry/polygonTypes";
import type { Drillhole } from "@/types/Drillhole";

type DrillholeManagerProps = {
  drillholes: readonly Drillhole[];
  nextName: string;
  onAdd: (coordinates: { x: number; y: number }) => void;
  onDelete: (id: string) => void;
};

export default function DrillholeManager({
  drillholes,
  nextName,
  onAdd,
  onDelete,
}: DrillholeManagerProps) {
  const [x, setX] = useState("500");
  const [y, setY] = useState("320");
  const parsedX = Number(x);
  const parsedY = Number(y);
  const isValid =
    x.trim() !== "" &&
    y.trim() !== "" &&
    Number.isFinite(parsedX) &&
    Number.isFinite(parsedY) &&
    parsedX >= 0 &&
    parsedX <= CANVAS_WIDTH &&
    parsedY >= 0 &&
    parsedY <= CANVAS_HEIGHT;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) {
      return;
    }

    onAdd({ x: parsedX, y: parsedY });
  }

  return (
    <section className="polygon-panel drillhole-manager">
      <div className="panel-heading">
        <span className="section-index">02</span>
        <div>
          <h2>Gestor de sondajes</h2>
          <p>Agrega puntos de perforación</p>
        </div>
      </div>

      <form className="drillhole-form" onSubmit={handleSubmit}>
        <div className="subsection-title">
          <h3>Nuevo sondaje</h3>
          <span>{nextName}</span>
        </div>
        <div className="dimension-inputs">
          <label>
            Coordenada X
            <span className="input-with-unit">
              <input
                aria-label="Coordenada X del nuevo sondaje"
                max={CANVAS_WIDTH}
                min={0}
                onChange={(event) => setX(event.target.value)}
                step="0.1"
                type="number"
                value={x}
              />
              <span>m</span>
            </span>
          </label>
          <label>
            Coordenada Y
            <span className="input-with-unit">
              <input
                aria-label="Coordenada Y del nuevo sondaje"
                max={CANVAS_HEIGHT}
                min={0}
                onChange={(event) => setY(event.target.value)}
                step="0.1"
                type="number"
                value={y}
              />
              <span>m</span>
            </span>
          </label>
        </div>
        <button className="add-drillhole-button" disabled={!isValid} type="submit">
          <span aria-hidden="true">＋</span>
          Agregar sondaje
        </button>
      </form>

      <div className="drillhole-list-section">
        <div className="subsection-title">
          <h3>Sondajes en canvas</h3>
          <span>{drillholes.length} TOTAL</span>
        </div>
        {drillholes.length === 0 ? (
          <p className="vertex-empty">Todavía no hay sondajes en el área de trabajo.</p>
        ) : (
          <div className="drillhole-list">
            {drillholes.map((drillhole) => (
              <div className="drillhole-list-row" key={drillhole.id}>
                <span className="drillhole-list-symbol" aria-hidden="true">⊕</span>
                <div>
                  <strong>{drillhole.name}</strong>
                  <span>
                    X {drillhole.x.toFixed(1)} · Y {drillhole.y.toFixed(1)} m
                  </span>
                </div>
                <button
                  aria-label={`Eliminar sondaje ${drillhole.name}`}
                  className="remove-vertex"
                  onClick={() => onDelete(drillhole.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="drillhole-manager-hint">
        Puedes arrastrar los puntos directamente en el canvas para moverlos.
      </p>
    </section>
  );
}
