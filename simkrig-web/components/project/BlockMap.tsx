"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadPersistedBlocks,
  type LoadedEstimationBlock,
} from "@/lib/blocks/loadPersistedBlocks";
import type { BlockVariable } from "@/types/BlockVariable";

type LoadState = "loading" | "empty" | "available" | "error";
type SortKey = "block_name" | "area" | "Potencia" | "Densidad" | "Ley";
type SortDirection = "ascending" | "descending";

type BlockMapProps = {
  projectId: string;
  reloadToken?: number;
};

type Bounds = {
  minEasting: number;
  maxEasting: number;
  minNorthing: number;
  maxNorthing: number;
};

type ProjectedBlock = {
  block: LoadedEstimationBlock;
  points: string;
};

type MetricSummary = {
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 600;
const PADDING = 48;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function getVariable(block: LoadedEstimationBlock, name: string) {
  return block.variables.find((variable) => variable.variable_name === name);
}

function getVariableValue(block: LoadedEstimationBlock, name: string) {
  return getVariable(block, name)?.value ?? null;
}

function summarizeMetric(
  blocks: readonly LoadedEstimationBlock[],
  valueName: string,
  weightName: string,
): MetricSummary {
  const values = blocks
    .map((block) => getVariableValue(block, valueName))
    .filter((value): value is number => value !== null);
  const weighted = blocks.reduce(
    (result, block) => {
      const value = getVariableValue(block, valueName);
      const weight =
        weightName === "Área"
          ? block.area
          : getVariableValue(block, weightName);
      if (value === null || weight === null || weight <= 0) {
        return result;
      }
      return {
        weightedSum: result.weightedSum + value * weight,
        weightSum: result.weightSum + weight,
      };
    },
    { weightedSum: 0, weightSum: 0 },
  );

  return {
    average:
      weighted.weightSum > 0
        ? weighted.weightedSum / weighted.weightSum
        : null,
    minimum: values.length > 0 ? Math.min(...values) : null,
    maximum: values.length > 0 ? Math.max(...values) : null,
  };
}

function getBounds(blocks: readonly LoadedEstimationBlock[]): Bounds {
  return blocks.flatMap((block) => block.geometry).reduce(
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

function getVariableOptions(blocks: readonly LoadedEstimationBlock[]) {
  const options = new Map<string, BlockVariable>();
  for (const block of blocks) {
    for (const variable of block.variables) {
      if (!options.has(variable.variable_name)) {
        options.set(variable.variable_name, variable);
      }
    }
  }
  return Array.from(options.values()).sort((left, right) =>
    left.variable_name.localeCompare(right.variable_name, "es"),
  );
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
    ? "—"
    : `${numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;
}

function BlockDetails({ block }: { block: LoadedEstimationBlock }) {
  return (
    <aside
      aria-label={`Detalles del bloque ${block.block_name}`}
      className="rounded-xl border border-cyan-900 bg-slate-900 p-5"
    >
      <h3 className="text-lg font-semibold">Bloque seleccionado</h3>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Bloque
          </dt>
          <dd className="mt-1 break-all font-semibold text-slate-100">
            {block.block_name}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Área
          </dt>
          <dd className="mt-1 text-slate-100">
            {formatValue(block.area, "m²")}
          </dd>
        </div>
        {["Potencia", "Densidad", "Ley"].map((name) => {
          const variable = getVariable(block, name);
          return (
            <div key={name}>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                {name}
              </dt>
              <dd className="mt-1 text-slate-100">
                {formatValue(variable?.value, variable?.unit)}
              </dd>
            </div>
          );
        })}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            Coordenadas de vértices (Este, Norte)
          </dt>
          <dd className="mt-2 space-y-1 text-sm text-slate-200">
            {block.geometry.map((vertex, index) => (
              <p key={`${vertex.easting}-${vertex.northing}-${index}`}>
                V{index + 1}: {numberFormat.format(vertex.easting)},{" "}
                {numberFormat.format(vertex.northing)}
              </p>
            ))}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function SummaryMetric({
  label,
  summary,
  unit,
}: {
  label: string;
  summary: MetricSummary;
  unit: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-400">{label}</h3>
      <p className="mt-2 text-2xl font-semibold">
        {formatValue(summary.average, unit)}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        Mín {formatValue(summary.minimum, unit)} · Máx{" "}
        {formatValue(summary.maximum, unit)}
      </p>
    </article>
  );
}

export default function BlockMap({
  projectId,
  reloadToken = 0,
}: BlockMapProps) {
  const [blocks, setBlocks] = useState<LoadedEstimationBlock[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeVariableName, setActiveVariableName] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("block_name");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function refreshBlocks() {
      setState("loading");
      setErrorMessage(null);

      try {
        const loadedBlocks = await loadPersistedBlocks(
          projectId,
          controller.signal,
        );
        if (!isActive) {
          return;
        }
        setBlocks(loadedBlocks);
        setSelectedBlockId((current) =>
          loadedBlocks.some((block) => block.id === current) ? current : null,
        );
        setState(loadedBlocks.length > 0 ? "available" : "empty");
      } catch (error) {
        if (!isActive) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los bloques del proyecto.",
        );
        setState("error");
      }
    }

    void refreshBlocks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId, reloadToken]);

  const variableOptions = useMemo(() => getVariableOptions(blocks), [blocks]);
  const selectedVariableName =
    variableOptions.find(
      (variable) => variable.variable_name === activeVariableName,
    )?.variable_name ?? variableOptions[0]?.variable_name;
  const selectedVariable = variableOptions.find(
    (variable) => variable.variable_name === selectedVariableName,
  );
  const variableValues = blocks
    .map(
      (block) =>
        block.variables.find(
          (variable) => variable.variable_name === selectedVariableName,
        )?.value,
    )
    .filter((value): value is number => value !== null && value !== undefined);
  const variableRange = variableValues.reduce(
    (range, value) => ({
      minimum: Math.min(range.minimum, value),
      maximum: Math.max(range.maximum, value),
    }),
    {
      minimum: Number.POSITIVE_INFINITY,
      maximum: Number.NEGATIVE_INFINITY,
    },
  );
  const minimum = variableValues.length > 0 ? variableRange.minimum : null;
  const maximum = variableValues.length > 0 ? variableRange.maximum : null;
  const totalArea = blocks.reduce((total, block) => total + block.area, 0);
  const globalSummary = {
    thickness: summarizeMetric(blocks, "Potencia", "Área"),
    density: summarizeMetric(blocks, "Densidad", "Volumen"),
    grade: summarizeMetric(blocks, "Ley", "Tonelaje"),
  };

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
      points: block.geometry
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

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId);

  const sortedBlocks = useMemo(() => {
    return [...blocks].sort((left, right) => {
      let comparison = 0;
      if (sortKey === "block_name") {
        comparison = left.block_name.localeCompare(right.block_name, "es");
      } else {
        const leftValue =
          sortKey === "area" ? left.area : getVariableValue(left, sortKey);
        const rightValue =
          sortKey === "area" ? right.area : getVariableValue(right, sortKey);
        if (leftValue === null) {
          comparison = rightValue === null ? 0 : 1;
        } else if (rightValue === null) {
          comparison = -1;
        } else {
          comparison = leftValue - rightValue;
        }
      }
      return sortDirection === "ascending" ? comparison : -comparison;
    });
  }, [blocks, sortDirection, sortKey]);

  function changeSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((direction) =>
        direction === "ascending" ? "descending" : "ascending",
      );
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("ascending");
  }

  function sortLabel(label: string, key: SortKey) {
    const indicator =
      sortKey === key ? (sortDirection === "ascending" ? " ↑" : " ↓") : "";
    return `${label}${indicator}`;
  }

  return (
    <section
      aria-labelledby="block-map-heading"
      aria-live="polite"
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
        <p className="text-sm text-slate-400" role="status">
          {state === "loading" && "Cargando"}
          {state === "empty" && "Sin bloques"}
          {state === "available" && "Visualización disponible"}
          {state === "error" && "Error al cargar"}
        </p>
      </div>

      {state === "loading" && (
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Cargando bloques y variables…
        </p>
      )}

      {state === "empty" && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
          No hay bloques persistidos para este proyecto.
        </p>
      )}

      {state === "error" && (
        <p
          className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 p-5 text-sm text-red-200"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {state === "available" && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Cantidad bloques</p>
              <p className="mt-2 text-2xl font-semibold">{blocks.length}</p>
            </article>
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Área total</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatValue(totalArea, "m²")}
              </p>
            </article>
            <SummaryMetric
              label="Potencia promedio global"
              summary={globalSummary.thickness}
              unit="m"
            />
            <SummaryMetric
              label="Densidad promedio global"
              summary={globalSummary.density}
              unit="t/m³"
            />
            <SummaryMetric
              label="Ley promedio global"
              summary={globalSummary.grade}
              unit="%"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Variable a visualizar
              <select
                className="min-w-52 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                onChange={(event) =>
                  setActiveVariableName(event.target.value)
                }
                value={selectedVariableName ?? ""}
              >
                {variableOptions.map((variable) => (
                  <option
                    key={variable.variable_name}
                    value={variable.variable_name}
                  >
                    {variable.variable_name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-slate-300">
              Variable activa:{" "}
              <strong className="text-slate-100">
                {selectedVariable?.variable_name ?? "Sin variables"}
              </strong>
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <svg
                aria-label={`Mapa temático de ${blocks.length} bloques`}
                className="block h-auto max-h-[75vh] min-h-80 w-full"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              >
                <rect fill="#080d12" height={SVG_HEIGHT} width={SVG_WIDTH} />
                {projectedBlocks.map(({ block, points }) => {
                  const value = getVariableValue(
                    block,
                    selectedVariableName ?? "",
                  );
                  const isSelected = selectedBlockId === block.id;
                  const fill =
                    value === null || minimum === null || maximum === null
                      ? "#475569"
                      : interpolateColor(value, minimum, maximum);

                  return (
                    <polygon
                      aria-label={`Seleccionar bloque ${block.block_name}`}
                      aria-pressed={isSelected}
                      className="cursor-pointer transition-opacity hover:opacity-80 focus:stroke-white"
                      fill={fill}
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      onFocus={() => setSelectedBlockId(block.id)}
                      points={points}
                      stroke={isSelected ? "#f8fafc" : "#080d12"}
                      strokeWidth={isSelected ? 5 : 2}
                      tabIndex={0}
                    >
                      <title>
                        {block.block_name} · Área:{" "}
                        {formatValue(block.area, "m²")} · Potencia:{" "}
                        {formatValue(
                          getVariableValue(block, "Potencia"),
                          "m",
                        )}{" "}
                        · Densidad:{" "}
                        {formatValue(
                          getVariableValue(block, "Densidad"),
                          "t/m³",
                        )}{" "}
                        · Ley: {formatValue(getVariableValue(block, "Ley"), "%")}
                      </title>
                    </polygon>
                  );
                })}
              </svg>
            </div>
            {selectedBlock ? (
              <BlockDetails block={selectedBlock} />
            ) : (
              <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                Selecciona un bloque en el mapa o en la tabla para consultar
                sus detalles y vértices.
              </aside>
            )}
          </div>

          {minimum !== null && maximum !== null && selectedVariable && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{formatValue(minimum, selectedVariable.unit)}</span>
                <span className="font-medium">
                  {selectedVariable.variable_name} ({selectedVariable.unit})
                </span>
                <span>{formatValue(maximum, selectedVariable.unit)}</span>
              </div>
              <div
                aria-label={`Leyenda de ${selectedVariable.variable_name}`}
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

          <section aria-labelledby="block-table-heading" className="mt-8">
            <h3 className="text-xl font-semibold" id="block-table-heading">
              Tabla de bloques
            </h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950 text-slate-300">
                  <tr>
                    {(
                      [
                        ["block_name", "Bloque"],
                        ["area", "Área (m²)"],
                        ["Potencia", "Potencia (m)"],
                        ["Densidad", "Densidad (t/m³)"],
                        ["Ley", "Ley (%)"],
                      ] as const
                    ).map(([key, label]) => (
                      <th
                        className="whitespace-nowrap px-4 py-3"
                        key={key}
                        scope="col"
                      >
                        <button
                          aria-label={`Ordenar por ${label}`}
                          className="font-semibold hover:text-cyan-300"
                          onClick={() => changeSort(key)}
                          type="button"
                        >
                          {sortLabel(label, key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sortedBlocks.map((block) => (
                    <tr
                      aria-selected={selectedBlockId === block.id}
                      className={`cursor-pointer ${
                        selectedBlockId === block.id
                          ? "bg-cyan-950/50"
                          : "bg-slate-900/70 hover:bg-slate-800"
                      }`}
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedBlockId(block.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <th
                        className="whitespace-nowrap px-4 py-3 font-medium"
                        scope="row"
                      >
                        {block.block_name}
                      </th>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatValue(block.area)}
                      </td>
                      {["Potencia", "Densidad", "Ley"].map((name) => (
                        <td
                          className="whitespace-nowrap px-4 py-3"
                          key={name}
                        >
                          {formatValue(getVariableValue(block, name))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
