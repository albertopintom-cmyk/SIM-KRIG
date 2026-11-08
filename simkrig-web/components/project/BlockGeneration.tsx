"use client";

import { useEffect, useState } from "react";
import BlockMap from "@/components/project/BlockMap";
import {
  generateBlocks,
  type DrillholeForBlock,
  type EstimationBlock,
} from "@/lib/blocks/generateBlocks";
import { supabase } from "@/lib/supabase";

type LoadState = "generating" | "empty" | "available" | "error";

type BlockGenerationProps = {
  projectId: string;
};

const PAGE_SIZE = 1000;

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

export default function BlockGeneration({
  projectId,
}: BlockGenerationProps) {
  const [blocks, setBlocks] = useState<EstimationBlock[]>([]);
  const [state, setState] = useState<LoadState>("generating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadAndGenerateBlocks() {
      setState("generating");
      setErrorMessage(null);

      try {
        const drillholes: DrillholeForBlock[] = [];

        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("drillholes")
            .select("id, drillhole_id, easting, northing, thickness, density, grade")
            .eq("project_id", projectId)
            .order("id", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)
            .abortSignal(controller.signal);

          if (error) {
            throw error;
          }

          const batch: unknown[] = data ?? [];
          for (const row of batch) {
            if (!isDrillholeForBlock(row)) {
              throw new Error(
                "La consulta devolvió un sondaje con datos inválidos para generar bloques.",
              );
            }
            drillholes.push(row);
          }

          if (batch.length < PAGE_SIZE) {
            break;
          }
        }

        const generatedBlocks = generateBlocks(drillholes);
        if (!isActive) {
          return;
        }
        setBlocks(generatedBlocks);
        setState(generatedBlocks.length > 0 ? "available" : "empty");
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

    void loadAndGenerateBlocks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId]);

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
          {state === "empty" && "Sin bloques"}
          {state === "available" && "Bloques disponibles"}
          {state === "error" && "Error al generar"}
        </p>
      </div>

      {state === "generating" && (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Cargando sondajes y generando bloques…
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

      {state === "available" && (
        <>
          <p className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-slate-200">
            Cantidad de bloques generados:{" "}
            <strong className="text-emerald-200">{blocks.length}</strong>
          </p>
          <BlockMap blocks={blocks} />
        </>
      )}
    </section>
  );
}
