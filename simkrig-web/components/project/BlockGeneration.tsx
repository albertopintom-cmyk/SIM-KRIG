"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BlockMap from "@/components/project/BlockMap";
import {
  generateBlocks,
  type DrillholeForBlock,
} from "@/lib/blocks/generateBlocks";
import { loadPersistedBlocks } from "@/lib/blocks/loadPersistedBlocks";
import { saveBlocks } from "@/lib/blocks/saveBlocks";
import type { EstimationBlockInsert } from "@/types/EstimationBlock";
import { supabase } from "@/lib/supabase";

type LoadState =
  | "generating"
  | "preview"
  | "saving"
  | "available"
  | "empty"
  | "error";

type BlockGenerationProps = {
  projectId: string;
};

const PAGE_SIZE = 1000;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isDrillholeForBlock(value: unknown): value is DrillholeForBlock {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.drillhole_id === "string" &&
    typeof record.easting === "number" &&
    Number.isFinite(record.easting) &&
    typeof record.northing === "number" &&
    Number.isFinite(record.northing) &&
    isNullableFiniteNumber(record.thickness) &&
    isNullableFiniteNumber(record.density) &&
    isNullableFiniteNumber(record.grade)
  );
}

async function loadProjectDrillholes(
  projectId: string,
  signal: AbortSignal,
): Promise<DrillholeForBlock[]> {
  const drillholes: DrillholeForBlock[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("drillholes")
      .select("id, drillhole_id, easting, northing, thickness, density, grade")
      .eq("project_id", projectId)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
      .abortSignal(signal);

    if (error) {
      throw new Error(`No se pudieron cargar los sondajes: ${error.message}`);
    }

    const rows: unknown[] = data ?? [];
    for (const row of rows) {
      if (!isDrillholeForBlock(row)) {
        throw new Error(
          "La consulta devolvió un sondaje con datos inválidos para generar bloques.",
        );
      }
      drillholes.push(row);
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  return drillholes;
}

function PreviewTable({ blocks }: { blocks: EstimationBlockInsert[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
        <thead className="bg-slate-950 text-slate-300">
          <tr>
            <th className="whitespace-nowrap px-4 py-3" scope="col">Bloque</th>
            <th className="whitespace-nowrap px-4 py-3" scope="col">Área (m²)</th>
            <th className="whitespace-nowrap px-4 py-3" scope="col">Potencia (m)</th>
            <th className="whitespace-nowrap px-4 py-3" scope="col">Densidad (t/m³)</th>
            <th className="whitespace-nowrap px-4 py-3" scope="col">Ley (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {blocks.map((block) => (
            <tr className="bg-slate-900/70" key={block.block_name}>
              <th className="whitespace-nowrap px-4 py-3 font-medium" scope="row">
                {block.block_name}
              </th>
              <td className="whitespace-nowrap px-4 py-3">
                {numberFormat.format(block.area)}
              </td>
              {block.variables.map((variable) => (
                <td
                  className="whitespace-nowrap px-4 py-3"
                  key={variable.variable_name}
                >
                  {variable.value === null
                    ? "Sin dato"
                    : numberFormat.format(variable.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BlockGeneration({
  projectId,
}: BlockGenerationProps) {
  const [previewBlocks, setPreviewBlocks] = useState<EstimationBlockInsert[]>(
    [],
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>("generating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [persistedSummary, setPersistedSummary] = useState<{
    blockCount: number;
    variableCount: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function prepareBlocks() {
      setState("generating");
      setErrorMessage(null);

      try {
        const existingBlocks = await loadPersistedBlocks(
          projectId,
          controller.signal,
        );
        if (!isActive) {
          return;
        }

        if (existingBlocks.length > 0) {
          setState("available");
          return;
        }

        const drillholes = await loadProjectDrillholes(
          projectId,
          controller.signal,
        );
        if (!isActive) {
          return;
        }

        if (drillholes.length === 0) {
          setPreviewBlocks([]);
          setState("empty");
          return;
        }

        const generatedBlocks = generateBlocks(drillholes);
        setPreviewBlocks(generatedBlocks);
        setState(generatedBlocks.length > 0 ? "preview" : "empty");
      } catch (error) {
        if (!isActive) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron generar los bloques.",
        );
        setState("error");
      }
    }

    void prepareBlocks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId]);

  async function handleSave() {
    if (previewBlocks.length === 0 || state === "saving") {
      return;
    }

    setState("saving");
    setErrorMessage(null);
    setPersistedSummary(null);
    try {
      const savedBlockCount = await saveBlocks(projectId, previewBlocks);
      const persistedBlocks = await loadPersistedBlocks(projectId);
      const persistedVariableCount = persistedBlocks.reduce(
        (total, block) => total + block.variables.length,
        0,
      );
      const expectedVariableCount = previewBlocks.reduce(
        (total, block) => total + block.variables.length,
        0,
      );

      console.log("PERSISTED BLOCK COUNT:", persistedBlocks.length);
      console.log("PERSISTED VARIABLE COUNT:", persistedVariableCount);
      console.log("PERSISTENCE VERIFICATION:", {
        projectId,
        rpcBlockCount: savedBlockCount,
        queriedBlockCount: persistedBlocks.length,
        expectedBlockCount: previewBlocks.length,
        queriedVariableCount: persistedVariableCount,
        expectedVariableCount,
      });

      if (
        savedBlockCount !== previewBlocks.length ||
        persistedBlocks.length !== previewBlocks.length ||
        persistedVariableCount !== expectedVariableCount
      ) {
        throw new Error(
          `El RPC informó ${savedBlockCount} bloques; la consulta encontró ${persistedBlocks.length} bloques y ${persistedVariableCount} variables (esperados: ${previewBlocks.length} bloques y ${expectedVariableCount} variables).`,
        );
      }

      setPersistedSummary({
        blockCount: persistedBlocks.length,
        variableCount: persistedVariableCount,
      });
      setReloadToken((current) => current + 1);
      setState("available");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los bloques.",
      );
      setState("preview");
    }
  }

  const totalPreviewArea = previewBlocks.reduce(
    (total, block) => total + block.area,
    0,
  );

  return (
    <section
      aria-labelledby="block-generation-heading"
      aria-live="polite"
      className="mt-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            GENERACIÓN AUTOMÁTICA
          </p>
          <h2
            className="mt-2 text-2xl font-semibold"
            id="block-generation-heading"
          >
            Bloques desde malla de sondajes
          </h2>
        </div>
        <p className="text-sm text-slate-400" role="status">
          {state === "generating" && "Generando"}
          {state === "preview" && "Vista previa"}
          {state === "saving" && "Guardando"}
          {state === "available" && "Bloques disponibles"}
          {state === "empty" && "Sin bloques"}
          {state === "error" && "Error al generar"}
        </p>
      </div>

      {state === "generating" && (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Consultando bloques existentes y, si no hay, generando una vista
          previa…
        </p>
      )}

      {state === "empty" && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
          Sin bloques: se requieren cuatro sondajes vecinos que formen una
          celda completa de una malla regular.
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

      {state === "preview" && (
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold">Vista previa de bloques</h3>
          <p className="mt-2 text-sm text-slate-300">
            Bloques generados:{" "}
            <strong className="text-slate-100">{previewBlocks.length}</strong>
            <span className="mx-3 text-slate-600">|</span>
            Área total:{" "}
            <strong className="text-slate-100">
              {numberFormat.format(totalPreviewArea)} m²
            </strong>
          </p>
          <PreviewTable blocks={previewBlocks} />
          {errorMessage && (
            <p className="mt-4 text-sm text-red-200" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            className="mt-5 rounded-lg bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSave}
            type="button"
          >
            Guardar bloques
          </button>
        </div>
      )}

      {state === "saving" && (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Guardando bloques y variables…
        </p>
      )}

      {state === "available" && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <div className="text-slate-200">
              {persistedSummary ? (
                <>
                  <p>
                    ✅ {persistedSummary.blockCount} bloques guardados
                    correctamente
                  </p>
                  <p className="mt-1">
                    ✅ {persistedSummary.variableCount} variables guardadas
                    correctamente
                  </p>
                </>
              ) : (
                <p>Los bloques están guardados y listos para reutilizarse.</p>
              )}
            </div>
            <Link
              className="rounded-lg border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
              href={`/project/${projectId}/visualization`}
            >
              Ir a Visualización
            </Link>
          </div>
          <BlockMap projectId={projectId} reloadToken={reloadToken} />
        </>
      )}
    </section>
  );
}
