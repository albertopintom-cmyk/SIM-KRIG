"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DrillholeSummaryRecord = {
  drillhole_id: string;
  easting: number | null;
  northing: number | null;
  elevation: number | null;
  total_depth: number | null;
  thickness: number | null;
  density: number | null;
  grade: number | null;
};

type NumericStats = {
  minimum: number | null;
  maximum: number | null;
  average: number | null;
};

type Summary = {
  count: number;
  easting: NumericStats;
  northing: NumericStats;
  elevation: NumericStats;
  grade: NumericStats;
  density: NumericStats;
  thickness: NumericStats;
  totalDepth: NumericStats;
  missingGrade: number;
  missingDensity: number;
  missingThickness: number;
};

type DrillholeSummaryProps = {
  projectId: string;
  refreshToken: number;
};

type LoadState = "loading" | "empty" | "available" | "error";

const PAGE_SIZE = 1000;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isDrillholeSummaryRecord(
  value: unknown,
): value is DrillholeSummaryRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.drillhole_id === "string" &&
    isNullableFiniteNumber(record.easting) &&
    isNullableFiniteNumber(record.northing) &&
    isNullableFiniteNumber(record.elevation) &&
    isNullableFiniteNumber(record.total_depth) &&
    isNullableFiniteNumber(record.thickness) &&
    isNullableFiniteNumber(record.density) &&
    isNullableFiniteNumber(record.grade)
  );
}

function getNumericStats(values: readonly (number | null)[]): NumericStats {
  const totals = values.reduce(
    (result, value) =>
      value === null
        ? result
        : {
            minimum: Math.min(result.minimum, value),
            maximum: Math.max(result.maximum, value),
            sum: result.sum + value,
            count: result.count + 1,
          },
    {
      minimum: Number.POSITIVE_INFINITY,
      maximum: Number.NEGATIVE_INFINITY,
      sum: 0,
      count: 0,
    },
  );
  if (totals.count === 0) {
    return { minimum: null, maximum: null, average: null };
  }

  return {
    minimum: totals.minimum,
    maximum: totals.maximum,
    average: totals.sum / totals.count,
  };
}

function summarize(records: readonly DrillholeSummaryRecord[]): Summary {
  return {
    count: records.length,
    easting: getNumericStats(records.map((record) => record.easting)),
    northing: getNumericStats(records.map((record) => record.northing)),
    elevation: getNumericStats(records.map((record) => record.elevation)),
    grade: getNumericStats(records.map((record) => record.grade)),
    density: getNumericStats(records.map((record) => record.density)),
    thickness: getNumericStats(records.map((record) => record.thickness)),
    totalDepth: getNumericStats(records.map((record) => record.total_depth)),
    missingGrade: records.filter((record) => record.grade === null).length,
    missingDensity: records.filter((record) => record.density === null).length,
    missingThickness: records.filter((record) => record.thickness === null)
      .length,
  };
}

function formatValue(value: number | null, unit = "") {
  return value === null ? "—" : `${numberFormat.format(value)}${unit}`;
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
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">
        {value}
      </p>
    </article>
  );
}

function Range({
  label,
  stats,
  unit = "",
}: {
  label: string;
  stats: NumericStats;
  unit?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 py-3 last:border-b-0">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-100">
        {formatValue(stats.minimum, unit)} <span className="text-slate-500">/</span>{" "}
        {formatValue(stats.maximum, unit)}
      </dd>
    </div>
  );
}

export default function DrillholeSummary({
  projectId,
  refreshToken,
}: DrillholeSummaryProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadSummary() {
      setState("loading");
      setErrorMessage(null);

      try {
        const records: DrillholeSummaryRecord[] = [];

        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("drillholes")
            .select(
              "id, drillhole_id, easting, northing, elevation, total_depth, thickness, density, grade",
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
            if (!isDrillholeSummaryRecord(row)) {
              throw new Error(
                "La consulta devolvió un registro de sondaje con un formato inesperado.",
              );
            }
            records.push(row);
          }

          if (batch.length < PAGE_SIZE) {
            break;
          }
        }

        if (!isActive) {
          return;
        }

        if (records.length === 0) {
          setSummary(null);
          setState("empty");
          return;
        }

        setSummary(summarize(records));
        setState("available");
      } catch (error) {
        if (!isActive) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo consultar el resumen de sondajes.",
        );
        setState("error");
      }
    }

    void loadSummary();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [projectId, refreshToken]);

  return (
    <section
      aria-labelledby="drillhole-summary-heading"
      aria-live="polite"
      className="mt-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            TABLA RESUMEN
          </p>
          <h2
            className="mt-2 text-2xl font-semibold"
            id="drillhole-summary-heading"
          >
            Resumen de sondajes
          </h2>
        </div>
        <p className="text-sm text-slate-400" role="status">
          {state === "loading" && "Cargando"}
          {state === "empty" && "Sin datos"}
          {state === "available" && "Resumen disponible"}
          {state === "error" && "No se pudo cargar"}
        </p>
      </div>

      {state === "loading" && (
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Cargando resumen de sondajes…
        </p>
      )}

      {state === "empty" && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-400">
          Aún no hay sondajes registrados para este proyecto.
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

      {state === "available" && summary && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total Sondajes" value={numberFormat.format(summary.count)} />
            <Metric
              label="Ley Promedio (%)"
              value={formatValue(summary.grade.average, " %")}
            />
            <Metric
              label="Potencia Promedio (m)"
              value={formatValue(summary.thickness.average, " m")}
            />
            <Metric
              label="Densidad Promedio (t/m³)"
              value={formatValue(summary.density.average, " t/m³")}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-semibold">Extensión del yacimiento</h3>
              <dl className="mt-3">
                <Range label="Este Min / Max (m E)" stats={summary.easting} unit=" m" />
                <Range label="Norte Min / Max (m S)" stats={summary.northing} unit=" m" />
              </dl>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-semibold">Calidad de datos</h3>
              <dl className="mt-3 divide-y divide-slate-800">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-sm text-slate-400">Ley faltante</dt>
                  <dd className="font-medium">{numberFormat.format(summary.missingGrade)}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-sm text-slate-400">Densidad faltante</dt>
                  <dd className="font-medium">{numberFormat.format(summary.missingDensity)}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-sm text-slate-400">Potencia faltante</dt>
                  <dd className="font-medium">{numberFormat.format(summary.missingThickness)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold">Otros estadísticos</h3>
            <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
              <Range label="Cota mínima / máxima (m s.n.m.)" stats={summary.elevation} unit=" m" />
              <Range label="Ley mínima / máxima (%)" stats={summary.grade} unit=" %" />
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 py-3 last:border-b-0">
                <dt className="text-sm text-slate-400">
                  Profundidad promedio (m)
                </dt>
                <dd className="font-medium text-slate-100">
                  {formatValue(summary.totalDepth.average, " m")}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </section>
  );
}
