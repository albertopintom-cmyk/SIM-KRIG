"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateCutoff,
  type CutoffAnalysis,
} from "@/lib/cutoff/calculateCutoff";
import { loadPersistedBlocks } from "@/lib/blocks/loadPersistedBlocks";
import type { LoadedEstimationBlock } from "@/lib/blocks/loadPersistedBlocks";

type LoadState = "loading" | "empty" | "available" | "error";

type CutoffGradeAnalysisProps = {
  projectId: string;
};

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function formatValue(value: number | null, unit = "") {
  return value === null
    ? "—"
    : `${numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;
}

function getCutoffAnalysis(
  blocks: readonly LoadedEstimationBlock[],
  cutoffInput: string,
):
  | { analysis: CutoffAnalysis; error: null }
  | { analysis: null; error: string | null } {
  if (cutoffInput.trim() === "") {
    return { analysis: null, error: "Ingresa una ley de corte para calcular." };
  }

  const cutoffGrade = Number(cutoffInput);
  if (!Number.isFinite(cutoffGrade) || cutoffGrade < 0) {
    return {
      analysis: null,
      error: "Ingresa una ley de corte numérica y no negativa.",
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
  const [cutoffInput, setCutoffInput] = useState("");

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

  const result = useMemo(
    () => getCutoffAnalysis(blocks, cutoffInput),
    [blocks, cutoffInput],
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
          Ley de corte (%)
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-lg text-slate-100 focus:border-cyan-400 focus:outline-none"
            min="0"
            onChange={(event) => setCutoffInput(event.target.value)}
            placeholder="Ej.: 0,5"
            step="any"
            type="number"
            value={cutoffInput}
          />
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
          {result.error && (
            <p
              className="mt-5 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200"
              role="status"
            >
              {result.error}
            </p>
          )}

          {result.analysis && (
            <>
              <section
                aria-label="Resumen global de ley de corte"
                className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
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
              </section>

              <section
                aria-label="Detalle de bloques y clasificación"
                className="mt-8"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">
                      Trazabilidad por bloque
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Ley de corte aplicada:{" "}
                      {formatValue(result.analysis.cutoffGrade, "%")}
                    </p>
                  </div>
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
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
