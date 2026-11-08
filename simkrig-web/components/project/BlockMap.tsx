"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BlockVariable } from "@/types/BlockVariable";
import type {
  BlockGeometry,
  EstimationBlock,
} from "@/types/EstimationBlock";

type LoadedBlock = EstimationBlock & {
  variables: BlockVariable[];
};

type LoadState = "loading" | "empty" | "available" | "error";

type BlockMapProps = {
  projectId: string;
};

type Bounds = {
  minEasting: number;
  maxEasting: number;
  minNorthing: number;
  maxNorthing: number;
};

type ProjectedBlock = {
  block: LoadedBlock;
  points: string;
};

const PAGE_SIZE = 1000;
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 600;
const PADDING = 48;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBlockVertex(value: unknown): value is BlockGeometry[number] {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.easting) && isFiniteNumber(record.northing);
}

function isBlockGeometry(value: unknown): value is BlockGeometry {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(isBlockVertex)
  );
}

function isEstimationBlock(value: unknown): value is EstimationBlock {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.project_id === "string" &&
    typeof record.block_name === "string" &&
    isFiniteNumber(record.area) &&
    isBlockGeometry(record.geometry) &&
    typeof record.created_at === "string"
  );
}

function isBlockVariable(value: unknown): value is BlockVariable {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.block_id === "string" &&
    typeof record.variable_name === "string" &&
    (record.value === null || isFiniteNumber(record.value)) &&
    typeof record.unit === "string" &&
    typeof record.calculation_method === "string" &&
    typeof record.created_at === "string"
  );
}

function getBounds(blocks: readonly LoadedBlock[]): Bounds {
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

function getVariableOptions(blocks: readonly LoadedBlock[]) {
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

function findBlockVariable(block: LoadedBlock, name: string) {
  return block.variables.find((variable) => variable.variable_name === name);
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

function BlockTooltip({ block }: { block: LoadedBlock }) {
  const thickness = findBlockVariable(block, "Potencia");
  const density = findBlockVariable(block, "Densidad");
  const grade = findBlockVariable(block, "Ley");

  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Bloque</dt>
        <dd className="mt-1 break-all font-semibold text-slate-100">
          {block.block_name}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Área</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(block.area, "m²")}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Potencia</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(thickness?.value, thickness?.unit)}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Densidad</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(density?.value, density?.unit)}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">Ley</dt>
        <dd className="mt-1 text-slate-100">
          {formatValue(grade?.value, grade?.unit)}
        </dd>
      </div>
    </dl>
  );
}

export default function BlockMap({ projectId }: BlockMapProps) {
  const [blocks, setBlocks] = useState<LoadedBlock[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeVariableName, setActiveVariableName] = useState("");
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadBlocks() {
      setState("loading");
      setErrorMessage(null);

      try {
        const storedBlocks: EstimationBlock[] = [];

        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("estimation_blocks")
            .select("id, project_id, block_name, area, geometry, created_at")
            .eq("project_id", projectId)
            .order("block_name", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)
            .abortSignal(controller.signal);

          if (error) {
            throw error;
          }

          const batch: unknown[] = data ?? [];
          for (const row of batch) {
            if (!isEstimationBlock(row)) {
              throw new Error(
                "La base de datos devolvió un bloque con formato inválido.",
              );
            }
            storedBlocks.push(row);
          }
          if (batch.length < PAGE_SIZE) {
            break;
          }
        }

        const variables: BlockVariable[] = [];
        for (
          let startIndex = 0;
          startIndex < storedBlocks.length;
          startIndex += PAGE_SIZE
        ) {
          const blockIds = storedBlocks
            .slice(startIndex, startIndex + PAGE_SIZE)
            .map((block) => block.id);

          for (let offset = 0; ; offset += PAGE_SIZE) {
            const { data, error } = await supabase
              .from("block_variables")
              .select(
                "id, block_id, variable_name, value, unit, calculation_method, created_at",
              )
              .in("block_id", blockIds)
              .order("variable_name", { ascending: true })
              .range(offset, offset + PAGE_SIZE - 1)
              .abortSignal(controller.signal);

            if (error) {
              throw error;
            }

            const batch: unknown[] = data ?? [];
            for (const row of batch) {
              if (!isBlockVariable(row)) {
                throw new Error(
                  "La base de datos devolvió una variable de bloque con formato inválido.",
                );
              }
              variables.push(row);
            }
            if (batch.length < PAGE_SIZE) {
              break;
            }
          }
        }

        if (!isActive) {
          return;
        }

        const variablesByBlock = new Map<string, BlockVariable[]>();
        for (const variable of variables) {
          const blockVariables =
            variablesByBlock.get(variable.block_id) ?? [];
          blockVariables.push(variable);
          variablesByBlock.set(variable.block_id, blockVariables);
        }

        const loadedBlocks = storedBlocks.map((block) => ({
          ...block,
          variables: variablesByBlock.get(block.id) ?? [],
        }));
        setBlocks(loadedBlocks);
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

    void loadBlocks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId]);

  const variableOptions = useMemo(() => getVariableOptions(blocks), [blocks]);
  const selectedVariableName =
    variableOptions.find(
      (variable) => variable.variable_name === activeVariableName,
    )?.variable_name ?? variableOptions[0]?.variable_name;
  const selectedVariable = variableOptions.find(
    (variable) => variable.variable_name === selectedVariableName,
  );
  const variableRange = blocks.reduce(
    (range, block) => {
      const value = findBlockVariable(
        block,
        selectedVariableName ?? "",
      )?.value;
      return value === null || value === undefined
        ? range
        : {
            minimum: Math.min(range.minimum, value),
            maximum: Math.max(range.maximum, value),
            count: range.count + 1,
          };
    },
    {
      minimum: Number.POSITIVE_INFINITY,
      maximum: Number.NEGATIVE_INFINITY,
      count: 0,
    },
  );
  const minimum =
    variableRange.count > 0 ? variableRange.minimum : null;
  const maximum =
    variableRange.count > 0 ? variableRange.maximum : null;

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

  const hoveredBlock = blocks.find((block) => block.id === hoveredBlockId);

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
          {state === "available" && "Bloques disponibles"}
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
              Cantidad de bloques:{" "}
              <strong className="text-slate-100">{blocks.length}</strong>
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Variable activa</p>
              <p className="mt-2 text-xl font-semibold">
                {selectedVariable?.variable_name ?? "Sin variables"}
              </p>
            </article>
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Rango mínimo</p>
              <p className="mt-2 text-xl font-semibold">
                {formatValue(minimum, selectedVariable?.unit)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Rango máximo</p>
              <p className="mt-2 text-xl font-semibold">
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
                const value = findBlockVariable(
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
                    aria-label={`Bloque ${block.block_name}`}
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
                      {block.block_name} · {selectedVariable?.variable_name}:{" "}
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

          {hoveredBlock && (
            <div className="mt-4 rounded-xl border border-cyan-900 bg-slate-900 p-5">
              <BlockTooltip block={hoveredBlock} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
