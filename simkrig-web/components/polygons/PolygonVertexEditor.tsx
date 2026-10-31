"use client";

import type { Point } from "@/lib/geometry/polygonTypes";

type PolygonVertexEditorProps = {
  vertices: readonly Point[];
  onMoveVertex: (index: number, point: Omit<Point, "id">) => void;
  onRemoveVertex: (index: number) => void;
};

export default function PolygonVertexEditor({
  vertices,
  onMoveVertex,
  onRemoveVertex,
}: PolygonVertexEditorProps) {
  return (
    <section className="vertex-editor">
      <div className="subsection-title">
        <h3>Coordenadas de vértices</h3>
        <span>EDITABLES</span>
      </div>
      {vertices.length === 0 ? (
        <p className="vertex-empty">Los vértices que agregues aparecerán aquí.</p>
      ) : (
        <div className="vertex-list">
          {vertices.map((vertex, index) => (
            <div className="vertex-row" key={vertex.id}>
              <span className="vertex-number">V{index + 1}</span>
              <label>
                X
                <input
                  aria-label={`Coordenada X del vértice ${index + 1}`}
                  max={1000}
                  min={0}
                  onChange={(event) =>
                    onMoveVertex(index, {
                      x: Number(event.target.value),
                      y: vertex.y,
                    })
                  }
                  step="0.1"
                  type="number"
                  value={Number(vertex.x.toFixed(1))}
                />
              </label>
              <label>
                Y
                <input
                  aria-label={`Coordenada Y del vértice ${index + 1}`}
                  max={640}
                  min={0}
                  onChange={(event) =>
                    onMoveVertex(index, {
                      x: vertex.x,
                      y: Number(event.target.value),
                    })
                  }
                  step="0.1"
                  type="number"
                  value={Number(vertex.y.toFixed(1))}
                />
              </label>
              <button
                aria-label={`Eliminar vértice ${index + 1}`}
                className="remove-vertex"
                onClick={() => onRemoveVertex(index)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
