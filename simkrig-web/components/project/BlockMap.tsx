"use client";

import { useMemo, useState } from "react";

export interface BlockVariable {
  name: string;
  value: number | null;
  unit: string;
}

export interface BlockVertex {
  easting: number;
  northing: number;
}

export interface BlockMapBlock {
  id: string;
  vertices: readonly [BlockVertex, BlockVertex, BlockVertex, BlockVertex];
  area: number;
  avg_thickness: number;
  avg_density: number;
  avg_grade: number;
  variables: readonly BlockVariable[];
}

type BlockMapProps = {
  blocks: readonly BlockMapBlock[];
  isLoading?: boolean;
};

type Bounds = {
  minEasting: number;
  maxEasting: number;
  minNorthing: number;
  maxNorthing: number;
};

type ProjectedBlock = {
  block: BlockMapBlock;
  points: string;
};

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 600;
const PADDING = 48;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function getBounds(blocks: readonly BlockMapBlock[]): Bounds {
  return blocks.flatMap((block) => block.vertices).reduce(
    (bounds, vertex) => ({
      minEasting: Math.min(bounds.minEasting, vertex.easting),
      maxEasting: Math.max(bounds.maxEasting, vertex.easting),
      minNorthing: Math.min(bounds.minNorthing, vertex.northing),
      maxNorthing: Math.max(bounds.maxNorthing, vertex.northing),
    }),
    {
      minEasting: Number.POSITIVE_INFINITY,
      maxEasting: Number.NEGATIVE_INFINITY,
      minNorthing: Number.POSITIVE_INFINITY,
      maxNorthing: Number.NEGATIVE_INFINITY,
    },
  );
}

function getVariableOptions(blocks: readonly BlockMapBlock[]) {
  const options = new Map<string, BlockVariable>();
  for (const block of blocks) {
    for (const variable of block.variables) {
      if (!options.has(variable.name)) {
        options.set(variable.name, variable);
      }
    }
  }
  return Array.from(options.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );
}

function getBlockVariable(
  block: BlockMapBlock,
  variableName: string,
): BlockVariable | undefined {
  return block.variables.find((variable) => variable.name === variableName);
}

function interpolateColor(value: number, minimum: number, maximum: number) {
  const blue = [59, 130, 246];
  const yellow = [250, 204, 21];
  const red = [239, 68, 68];
  const ratio =
    minimum === maximum
      ? 0.5
      : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  const start = ratio <= 0.5 ? blue : yellow;
  const end = ratio <= 0.5 ? yellow : red;
  const segmentRatio = ratio <= 0.5 ? ratio * 2 : (ratio - 0.5) * 2;
  const channels = start.map((channel, index) =>
    Math.round(channel + ((end[index] ?? channel) - channel) * segmentRatio),
  );
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function formatValue(value: number | null | undefined, unit = "") {
  return value === null || value === undefined
    ? "Sin dato"
    : `${numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;
}

function BlockTooltip({ block }: { block: BlockMapBlock }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Bloque</dt>
        <dd className="mt-1 break-all font-semibold text-slate-100">{block.id}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Área</dt>
        <dd className="mt-1 text-slate-100">{formatValue(block.area, "m²")}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Potencia</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(block.avg_thickness, "m")}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Densidad</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(block.avg_density, "t/m³")}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Ley</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(block.avg_grade, "%")}
        </dd>
      </div>
    </dl>
  );
}

export default function BlockMap({
  blocks,
  isLoading = false,
}: BlockMapProps) {
  const [activeVariableName, setActiveVariableName] = useState("");
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const variableOptions = useMemo(() => getVariableOptions(blocks), [blocks]);
  const selectedVariableName =
    variableOptions.find((variable) => variable.name === activeVariableName)
      ?.name ?? variableOptions[0]?.name;
  const selectedVariable = variableOptions.find(
    (variable) => variable.name === selectedVariableName,
  );

  const variableValues = blocks
    .map((block) => getBlockVariable(block, selectedVariableName ?? ""))
    .map((variable) => variable?.value)
    .filter((value): value is number => value !== null && value !== undefined);
  const minimum = variableValues.length > 0 ? Math.min(...variableValues) : null;
  const maximum = variableValues.length > 0 ? Math.max(...variableValues) : null;

  const projectedBlocks = useMemo<ProjectedBlock[]>(() => {
    if (blocks.length === 0) {
      return [];
    }

    const bounds = getBounds(blocks);
    const eastingSpan = bounds.maxEasting - bounds.minEasting || 1;
    const northingSpan = bounds.maxNorthing - bounds.minNorthing || 1;
    const scale = Math.min(
      (SVG_WIDTH - PADDING * 2) / eastingSpan,
      (SVG_HEIGHT - PADDING * 2) / northingSpan,
    );
    const centerEasting = (bounds.minEasting + bounds.maxEasting) / 2;
    const centerNorthing = (bounds.minNorthing + bounds.maxNorthing) / 2;

    return blocks.map((block) => ({
      block,
      points: block.vertices
        .map((vertex) => {
          const x =
            SVG_WIDTH / 2 + (vertex.easting - centerEasting) * scale;
          const y =
            SVG_HEIGHT / 2 - (vertex.northing - centerNorthing) * scale;
          return `${x},${y}`;
        })
        .join(" "),
    }));
  }, [blocks]);

  const hoveredBlock = blocks.find((block) => block.id === hoveredBlockId);

  if (isLoading) {
    return (
      <section
        aria-labelledby="block-map-heading"
        aria-live="polite"
        className="mt-8"
      >
        <h2 className="text-2xl font-semibold" id="block-map-heading">
          Bloques y Mapas Temáticos
        </h2>
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Cargando bloques…
        </p>
      </section>
    );
  }

  if (blocks.length === 0) {
    return (
      <section
        aria-labelledby="block-map-heading"
        aria-live="polite"
        className="mt-8"
      >
        <h2 className="text-2xl font-semibold" id="block-map-heading">
          Bloques y Mapas Temáticos
        </h2>
        <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
          No hay bloques disponibles para visualizar.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="block-map-heading"
      className="mt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            BLOQUES Y MAPAS TEMÁTICOS
          </p>
          <h2 className="mt-2 text-2xl font-semibold" id="block-map-heading">
            Visualización de bloques
          </h2>
        </div>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Variable a visualizar
          <select
            className="min-w-52 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
            onChange={(event) => setActiveVariableName(event.target.value)}
            value={selectedVariableName ?? ""}
          >
            {variableOptions.length === 0 ? (
              <option value="">Sin variables disponibles</option>
            ) : (
              variableOptions.map((variable) => (
                <option key={variable.name} value={variable.name}>
                  {variable.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Cantidad de bloques</p>
          <p className="mt-2 text-2xl font-semibold">{blocks.length}</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Variable activa</p>
          <p className="mt-2 text-2xl font-semibold">
            {selectedVariable?.name ?? "—"}
          </p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Rango mínimo</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatValue(minimum, selectedVariable?.unit)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Rango máximo</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatValue(maximum, selectedVariable?.unit)}
          </p>
        </article>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <svg
          aria-label={`Mapa temático de ${blocks.length} bloques`}
          className="block h-auto max-h-[75vh] min-h-80 w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        >
          <rect fill="#080d12" height={SVG_HEIGHT} width={SVG_WIDTH} />
          {projectedBlocks.map(({ block, points }) => {
            const value = getBlockVariable(
              block,
              selectedVariableName ?? "",
            )?.value;
            const fill =
              value === null ||
              value === undefined ||
              minimum === null ||
              maximum === null
                ? "#475569"
                : interpolateColor(value, minimum, maximum);

            return (
              <polygon
                aria-label={`Bloque ${block.id}`}
                className="cursor-pointer stroke-slate-950 transition-opacity hover:opacity-80 focus:stroke-white"
                fill={fill}
                key={block.id}
                onBlur={() => setHoveredBlockId(null)}
                onFocus={() => setHoveredBlockId(block.id)}
                onMouseEnter={() => setHoveredBlockId(block.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                points={points}
                strokeWidth="2"
                tabIndex={0}
              >
                <title>
                  Bloque {block.id} · {selectedVariable?.name ?? "Variable"}:{" "}
                  {formatValue(value, selectedVariable?.unit)}
                </title>
              </polygon>
            );
          })}
        </svg>
      </div>

      {minimum !== null && maximum !== null && selectedVariable && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
            <span>
              {formatValue(minimum, selectedVariable.unit)}
            </span>
            <span className="font-medium">
              {selectedVariable.name} ({selectedVariable.unit})
            </span>
            <span>
              {formatValue(maximum, selectedVariable.unit)}
            </span>
          </div>
          <div
            aria-label={`Leyenda de ${selectedVariable.name}`}
            className="mt-2 h-3 rounded-full"
            role="img"
            style={{
              background:
                "linear-gradient(to right, rgb(59, 130, 246), rgb(250, 204, 21), rgb(239, 68, 68))",
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>Mínimo · Azul</span>
            <span>Medio · Amarillo</span>
            <span>Máximo · Rojo</span>
          </div>
        </div>
      )}

      {hoveredBlock && (
        <div
          aria-live="polite"
          className="mt-4 rounded-xl border border-cyan-900 bg-slate-900 p-5"
        >
          <BlockTooltip block={hoveredBlock} />
        </div>
      )}
    </section>
  );
}
