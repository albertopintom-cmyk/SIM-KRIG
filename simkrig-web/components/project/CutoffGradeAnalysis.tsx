"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateCutoff,
  calculateCutoffCurve,
  getMaximumCutoffGrade,
  type CutoffAnalysis,
  type CutoffCurvePoint,
} from "@/lib/cutoff/calculateCutoff";
import { loadPersistedBlocks } from "@/lib/blocks/loadPersistedBlocks";
import type { LoadedEstimationBlock } from "@/lib/blocks/loadPersistedBlocks";
import TonnageGradeCurveChart from "@/components/project/TonnageGradeCurveChart";

type LoadState = "loading" | "empty" | "available" | "error";

type CutoffGradeAnalysisProps = {
  projectId: string;
};

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});
const CUTOFF_STEP = 0.01;

function formatValue(value: number | null, unit = "") {
  return value === null
    ? "—"
    : `${numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;
}

function getCutoffGrades(maximumCutoffGrade: number): number[] {
  const stepCount = Math.floor(maximumCutoffGrade / CUTOFF_STEP);
  const grades = Array.from(
    { length: stepCount + 1 },
    (_, index) => Number((index * CUTOFF_STEP).toFixed(2)),
  );
  if (
    grades[grades.length - 1] !== maximumCutoffGrade &&
    maximumCutoffGrade - (grades[grades.length - 1] ?? 0) > 1e-9
  ) {
    grades.push(maximumCutoffGrade);
  }
  return grades;
}

function getCutoffAnalysis(
  blocks: readonly LoadedEstimationBlock[],
  cutoffGrade: number,
):
  | { analysis: CutoffAnalysis; error: null }
  | { analysis: null; error: string | null } {
  if (!Number.isFinite(cutoffGrade) || cutoffGrade < 0) {
    return {
      analysis: null,
      error: "La ley de corte debe ser un número no negativo.",
    };
  }

  try {
    return { analysis: calculateCutoff(blocks, cutoffGrade), error: null };
  } catch (error) {
    return {
      analysis: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo calcular la ley de corte.",
    };
  }
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-sm font-medium text-slate-400">{label}</h3>
      <p className="mt-3 text-2xl font-semibold text-slate-100">{value}</p>
    </article>
  );
}

function classifyColor(classification: string) {
  if (classification === "mineral") {
    return "text-emerald-300";
  }
  if (classification === "estéril") {
    return "text-amber-300";
  }
  return "text-slate-400";
}

export default function CutoffGradeAnalysis({
  projectId,
}: CutoffGradeAnalysisProps) {
  const [blocks, setBlocks] = useState<LoadedEstimationBlock[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cutoffGrade, setCutoffGrade] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function fetchBlocks() {
      setState("loading");
      setErrorMessage(null);

      try {
        const persistedBlocks = await loadPersistedBlocks(
          projectId,
          controller.signal,
        );
        if (!isActive) {
          return;
        }

        setBlocks(persistedBlocks);
        setState(persistedBlocks.length > 0 ? "available" : "empty");
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

    void fetchBlocks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId]);

  const curveResult = useMemo((): {
    maximumCutoffGrade: number;
    points: CutoffCurvePoint[];
    error: string | null;
  } => {
    try {
      const maximumCutoffGrade = getMaximumCutoffGrade(blocks);
      return {
        maximumCutoffGrade,
        points: calculateCutoffCurve(
          blocks,
          getCutoffGrades(maximumCutoffGrade),
        ),
        error: null,
      };
    } catch (error) {
      return {
        maximumCutoffGrade: 0,
        points: [],
        error:
          error instanceof Error
            ? error.message
            : "No se pudo calcular la curva tonelaje-ley.",
      };
    }
  }, [blocks]);
  const selectedCutoffGrade = Math.min(
    cutoffGrade,
    curveResult.maximumCutoffGrade,
  );
  const result = useMemo(
    () => getCutoffAnalysis(blocks, selectedCutoffGrade),
    [blocks, selectedCutoffGrade],
  );
  const curveSeries = useMemo(
    () => [
      {
        id: "tonnage",
        label: "Tonelaje recuperable",
        axis: "left" as const,
        color: "#22d3ee",
        values: curveResult.points.map((point) => ({
          cutoffGrade: point.cutoffGrade,
          value: point.recoverableTonnage,
        })),
      },
      {
        id: "average-grade",
        label: "Ley media recuperable",
        axis: "right" as const,
        color: "#fbbf24",
        values: curveResult.points.map((point) => ({
          cutoffGrade: point.cutoffGrade,
          value: point.recoverableAverageGrade,
        })),
      },
    ],
    [curveResult.points],
  );

  return (
    <section aria-labelledby="cutoff-analysis-heading" className="mt-8">
      <header className="rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-cyan-300">
          ANÁLISIS DE RECURSOS
        </p>
        <h2
          className="mt-3 text-2xl font-bold"
          id="cutoff-analysis-heading"
        >
          Ley de Corte
        </h2>
        <p className="mt-3 max-w-3xl text-slate-300">
          Clasifica cada bloque según su ley y calcula el tonelaje y metal fino
          recuperables a partir de las variables persistidas del proyecto.
        </p>
        <label className="mt-6 flex max-w-sm flex-col gap-2 text-sm text-slate-300">
          Ley de corte ({numberFormat.format(cutoffGrade)} %)
          <input
            aria-label="Ley de Corte (%)"
            className="accent-cyan-400"
            disabled={curveResult.maximumCutoffGrade === 0}
            max={curveResult.maximumCutoffGrade}
            min="0"
            onChange={(event) => setCutoffGrade(Number(event.target.value))}
            step={CUTOFF_STEP}
            type="range"
            value={selectedCutoffGrade}
          />
          <span className="flex justify-between text-xs text-slate-500">
            <span>0,00 %</span>
            <span>{formatValue(curveResult.maximumCutoffGrade, "%")}</span>
          </span>
        </label>
      </header>

      {state === "loading" && (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Cargando bloques persistidos…
        </p>
      )}

      {state === "empty" && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
          Este proyecto todavía no tiene bloques persistidos. Genera y guarda
          bloques antes de calcular la ley de corte.
        </p>
      )}

      {state === "error" && (
        <p
          className="mt-5 rounded-xl border border-red-500/40 bg-red-950/40 p-5 text-sm text-red-200"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {state === "available" && (
        <>
          {(result.error || curveResult.error) && (
            <p
              className="mt-5 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200"
              role="status"
            >
              {result.error ?? curveResult.error}
            </p>
          )}

          {result.analysis && !curveResult.error && (
            <>
              <TonnageGradeCurveChart
                maximumCutoffGrade={curveResult.maximumCutoffGrade}
                selectedCutoffGrade={selectedCutoffGrade}
                series={curveSeries}
              />

              <section
                aria-label="Resumen global de ley de corte"
                className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <Metric
                  label="Ley de corte seleccionada"
                  value={formatValue(result.analysis.cutoffGrade, "%")}
                />
                <Metric
                  label="Bloques clasificados como mineral"
                  value={numberFormat.format(
                    result.analysis.mineralBlockCount,
                  )}
                />
                <Metric
                  label="Tonelaje recuperable"
                  value={formatValue(
                    result.analysis.recoverableTonnage,
                    " t",
                  )}
                />
                <Metric
                  label="Ley media recuperable"
                  value={formatValue(
                    result.analysis.recoverableAverageGrade,
                    "%",
                  )}
                />
                <Metric
                  label="Metal fino recuperable"
                  value={formatValue(
                    result.analysis.recoverableFineMetal,
                    " t",
                  )}
                />
                <Metric
                  label="Bloques estériles"
                  value={numberFormat.format(result.analysis.wasteBlockCount)}
                />
              </section>

              <details
                aria-label="Detalle de bloques y clasificación"
                className="mt-8"
              >
                <summary className="cursor-pointer text-xl font-semibold">
                  Trazabilidad por bloque
                </summary>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    Estéril: {result.analysis.wasteBlockCount} · Sin ley:{" "}
                    {result.analysis.blocksWithoutGrade} · Sin tonelaje:{" "}
                    {result.analysis.blocksWithoutTonnage}
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                    <thead className="bg-slate-950 text-slate-300">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Bloque
                        </th>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Área (m²)
                        </th>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Ley (%)
                        </th>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Tonelaje del bloque (t)
                        </th>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Clasificación
                        </th>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Tonelaje recuperable (t)
                        </th>
                        <th className="whitespace-nowrap px-4 py-3" scope="col">
                          Metal fino recuperable (t)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {result.analysis.blocks.map((block) => (
                        <tr className="bg-slate-900/70" key={block.blockId}>
                          <th
                            className="whitespace-nowrap px-4 py-3 font-medium"
                            scope="row"
                          >
                            {block.blockName}
                          </th>
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatValue(block.area)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatValue(block.grade)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatValue(block.blockTonnage)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 font-semibold ${classifyColor(block.classification)}`}
                          >
                            {block.classification}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatValue(block.recoverableTonnage)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatValue(block.recoverableFineMetal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
