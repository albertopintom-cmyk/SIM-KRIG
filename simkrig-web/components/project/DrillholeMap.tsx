"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DrillholeRecord = {
  id: string;
  drillhole_id: string;
  easting: number | null;
  northing: number | null;
  elevation: number | null;
  thickness: number | null;
  density: number | null;
  grade: number | null;
};

type MappedDrillhole = DrillholeRecord & {
  x: number;
  y: number;
};

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LoadState = "loading" | "empty" | "available" | "error";

type DrillholeMapProps = {
  projectId: string;
};

const PAGE_SIZE = 1000;
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 600;
const MAP_PADDING = 48;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isDrillholeRecord(value: unknown): value is DrillholeRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.drillhole_id === "string" &&
    isNullableFiniteNumber(record.easting) &&
    isNullableFiniteNumber(record.northing) &&
    isNullableFiniteNumber(record.elevation) &&
    isNullableFiniteNumber(record.thickness) &&
    isNullableFiniteNumber(record.density) &&
    isNullableFiniteNumber(record.grade)
  );
}

function mapDrillholes(records: readonly DrillholeRecord[]): MappedDrillhole[] {
  const locatedRecords = records.filter(
    (record): record is DrillholeRecord & { easting: number; northing: number } =>
      record.easting !== null && record.northing !== null,
  );

  if (locatedRecords.length === 0) {
    return [];
  }

  const bounds = locatedRecords.reduce(
    (current, record) => ({
      minEasting: Math.min(current.minEasting, record.easting),
      maxEasting: Math.max(current.maxEasting, record.easting),
      minNorthing: Math.min(current.minNorthing, record.northing),
      maxNorthing: Math.max(current.maxNorthing, record.northing),
    }),
    {
      minEasting: Number.POSITIVE_INFINITY,
      maxEasting: Number.NEGATIVE_INFINITY,
      minNorthing: Number.POSITIVE_INFINITY,
      maxNorthing: Number.NEGATIVE_INFINITY,
    },
  );
  const { minEasting, maxEasting, minNorthing, maxNorthing } = bounds;
  const eastingSpan = maxEasting - minEasting || 1;
  const northingSpan = maxNorthing - minNorthing || 1;
  const scale = Math.min(
    (SVG_WIDTH - MAP_PADDING * 2) / eastingSpan,
    (SVG_HEIGHT - MAP_PADDING * 2) / northingSpan,
  );
  const centerEasting = (minEasting + maxEasting) / 2;
  const centerNorthing = (minNorthing + maxNorthing) / 2;

  return locatedRecords.map((record) => ({
    ...record,
    x: SVG_WIDTH / 2 + (record.easting - centerEasting) * scale,
    y: SVG_HEIGHT / 2 - (record.northing - centerNorthing) * scale,
  }));
}

function formatValue(value: number | null, unit = "") {
  return value === null ? "Sin dato" : `${numberFormat.format(value)}${unit}`;
}

export default function DrillholeMap({ projectId }: DrillholeMapProps) {
  const [records, setRecords] = useState<DrillholeRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [hoveredDrillholeId, setHoveredDrillholeId] = useState<string | null>(
    null,
  );
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: 0,
    y: 0,
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
  });

  const drillholes = useMemo(() => mapDrillholes(records), [records]);
  const hoveredDrillhole = drillholes.find(
    (drillhole) => drillhole.id === hoveredDrillholeId,
  );
  const unlocatedCount = records.length - drillholes.length;

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadDrillholes() {
      setLoadState("loading");
      setErrorMessage(null);

      try {
        const allRecords: DrillholeRecord[] = [];

        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("drillholes")
            .select(
              "id, drillhole_id, easting, northing, elevation, thickness, density, grade",
            )
            .eq("project_id", projectId)
            .order("id", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)
            .abortSignal(controller.signal);

          if (error) {
            throw error;
          }

          const batch: unknown[] = data ?? [];
          for (const row of batch) {
            if (!isDrillholeRecord(row)) {
              throw new Error(
                "La consulta devolvió un sondaje con un formato inesperado.",
              );
            }
            allRecords.push(row);
          }

          if (batch.length < PAGE_SIZE) {
            break;
          }
        }

        if (!isActive) {
          return;
        }

        setRecords(allRecords);
        setLoadState(allRecords.length > 0 ? "available" : "empty");
        setViewBox({
          x: 0,
          y: 0,
          width: SVG_WIDTH,
          height: SVG_HEIGHT,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron consultar los sondajes del proyecto.",
        );
        setLoadState("error");
      }
    }

    void loadDrillholes();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId]);

  function adjustExtent() {
    setViewBox({ x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT });
  }

  function zoom(factor: number) {
    setViewBox((current) => {
      const width = current.width * factor;
      const height = current.height * factor;
      return {
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
        width,
        height,
      };
    });
  }

  return (
    <section
      aria-labelledby="drillhole-map-heading"
      aria-live="polite"
      className="mt-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            VISUALIZACIÓN ESPACIAL
          </p>
          <h2 className="mt-2 text-2xl font-semibold" id="drillhole-map-heading">
            Mapa de sondajes
          </h2>
        </div>
        <p className="text-sm text-slate-400" role="status">
          {loadState === "loading" && "Cargando"}
          {loadState === "empty" && "Sin datos"}
          {loadState === "available" && "Visualización disponible"}
          {loadState === "error" && "No se pudo cargar"}
        </p>
      </div>

      {loadState === "loading" && (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Cargando sondajes del proyecto…
        </p>
      )}

      {loadState === "empty" && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
          Aún no hay sondajes registrados para este proyecto.
        </p>
      )}

      {loadState === "error" && (
        <p
          className="mt-5 rounded-xl border border-red-500/40 bg-red-950/40 p-5 text-sm text-red-200"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {loadState === "available" && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-300">
              Sondajes visualizados:{" "}
              <strong className="text-slate-100">{drillholes.length}</strong>
              {unlocatedCount > 0 && (
                <span className="ml-2 text-amber-300">
                  ({unlocatedCount} sin coordenadas Este/Norte)
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  checked={showLabels}
                  className="accent-cyan-400"
                  onChange={(event) => setShowLabels(event.target.checked)}
                  type="checkbox"
                />
                Mostrar etiquetas
              </label>
              <button
                className="rounded-lg border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
                onClick={adjustExtent}
                type="button"
              >
                Ajustar Extensión
              </button>
              <div aria-label="Controles de zoom" className="flex gap-2">
                <button
                  aria-label="Alejar mapa"
                  className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:border-cyan-400"
                  onClick={() => zoom(1.25)}
                  type="button"
                >
                  −
                </button>
                <button
                  aria-label="Acercar mapa"
                  className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:border-cyan-400"
                  onClick={() => zoom(0.8)}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {drillholes.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
              No hay sondajes con coordenadas Este y Norte válidas para dibujar.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <svg
                aria-label={`Mapa espacial de ${drillholes.length} sondajes`}
                className="block h-auto max-h-[75vh] min-h-80 w-full"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              >
                <defs>
                  <pattern
                    height="40"
                    id="drillhole-map-grid"
                    patternUnits="userSpaceOnUse"
                    width="40"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="#17232d"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect
                  fill="url(#drillhole-map-grid)"
                  height={SVG_HEIGHT}
                  width={SVG_WIDTH}
                  x="0"
                  y="0"
                />
                <line
                  stroke="#334155"
                  strokeDasharray="5 6"
                  x1={SVG_WIDTH / 2}
                  x2={SVG_WIDTH / 2}
                  y1={MAP_PADDING}
                  y2={SVG_HEIGHT - MAP_PADDING}
                />
                <line
                  stroke="#334155"
                  strokeDasharray="5 6"
                  x1={MAP_PADDING}
                  x2={SVG_WIDTH - MAP_PADDING}
                  y1={SVG_HEIGHT / 2}
                  y2={SVG_HEIGHT / 2}
                />
                {drillholes.map((drillhole) => (
                  <g
                    key={drillhole.id}
                    onBlur={() => setHoveredDrillholeId(null)}
                    onFocus={() => setHoveredDrillholeId(drillhole.id)}
                    onMouseEnter={() => setHoveredDrillholeId(drillhole.id)}
                    onMouseLeave={() => setHoveredDrillholeId(null)}
                  >
                    <circle
                      aria-label={`Sondaje ${drillhole.drillhole_id}`}
                      className="cursor-pointer outline-none focus:stroke-white"
                      cx={drillhole.x}
                      cy={drillhole.y}
                      fill="#67e8f9"
                      r={hoveredDrillholeId === drillhole.id ? 7 : 5}
                      stroke="#083344"
                      strokeWidth="2"
                      tabIndex={0}
                    >
                      <title>
                        {drillhole.drillhole_id} — Este:{" "}
                        {numberFormat.format(drillhole.easting ?? 0)}, Norte:{" "}
                        {numberFormat.format(drillhole.northing ?? 0)}
                      </title>
                    </circle>
                    {showLabels && (
                      <text
                        fill="#e2e8f0"
                        fontSize="12"
                        pointerEvents="none"
                        x={drillhole.x + 9}
                        y={drillhole.y - 9}
                      >
                        {drillhole.drillhole_id}
                      </text>
                    )}
                  </g>
                ))}
                <text
                  fill="#94a3b8"
                  fontSize="13"
                  textAnchor="middle"
                  x={SVG_WIDTH / 2}
                  y={SVG_HEIGHT - 14}
                >
                  Este (m E)
                </text>
                <text
                  fill="#94a3b8"
                  fontSize="13"
                  textAnchor="middle"
                  transform={`rotate(-90 18 ${SVG_HEIGHT / 2})`}
                  x="18"
                  y={SVG_HEIGHT / 2}
                >
                  Norte (m S)
                </text>
              </svg>
            </div>
          )}

          {hoveredDrillhole && (
            <dl
              aria-live="polite"
              className="mt-4 grid gap-3 rounded-xl border border-cyan-900 bg-slate-900 p-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  ID Sondaje
                </dt>
                <dd className="mt-1 font-semibold text-slate-100">
                  {hoveredDrillhole.drillhole_id}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Este
                </dt>
                <dd className="mt-1 text-slate-100">
                  {formatValue(hoveredDrillhole.easting, " m")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Norte
                </dt>
                <dd className="mt-1 text-slate-100">
                  {formatValue(hoveredDrillhole.northing, " m")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Cota
                </dt>
                <dd className="mt-1 text-slate-100">
                  {formatValue(hoveredDrillhole.elevation, " m")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Potencia
                </dt>
                <dd className="mt-1 text-slate-100">
                  {formatValue(hoveredDrillhole.thickness, " m")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Densidad
                </dt>
                <dd className="mt-1 text-slate-100">
                  {formatValue(hoveredDrillhole.density, " t/m³")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Ley
                </dt>
                <dd className="mt-1 text-slate-100">
                  {formatValue(hoveredDrillhole.grade, " %")}
                </dd>
              </div>
            </dl>
          )}
        </>
      )}
    </section>
  );
}
