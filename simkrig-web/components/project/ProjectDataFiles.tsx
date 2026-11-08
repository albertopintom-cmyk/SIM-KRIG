"use client";

import { useRef, useState } from "react";
import DrillholeSummary from "@/components/project/DrillholeSummary";
import { importDrillholesFromExcel } from "@/lib/geometry/importDrillholes";
import { supabase } from "@/lib/supabase";
import type {
  DrillholeImportResult,
  ImportedDrillhole,
} from "@/types/DrillholeImport";
import type { DrillholeInsert } from "@/types/DrillholeRecord";

type ProjectFile = {
  id: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
};

type ProjectDataFilesProps = {
  projectId: string;
  initialFiles: ProjectFile[];
};

type ExcelPreview = {
  fileName: string;
  fileType: string;
  result: DrillholeImportResult;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

const previewColumns: {
  key: keyof ImportedDrillhole;
  label: string;
}[] = [
  { key: "name", label: "ID Sondaje" },
  { key: "x", label: "Este (m E)" },
  { key: "y", label: "Norte (m S)" },
  { key: "z", label: "Cota (m s.n.m.)" },
  { key: "depth", label: "Profundidad Total (m)" },
  { key: "thickness", label: "Potencia del Yacimiento / Tramo (m)" },
  { key: "density", label: "Densidad Compositada (t/m3)" },
  { key: "grade", label: "Ley Media Cu (%)" },
];

function getCoordinateRange(
  drillholes: readonly ImportedDrillhole[],
  coordinate: "x" | "y",
) {
  return drillholes.reduce(
    (range, drillhole) => ({
      minimum: Math.min(range.minimum, drillhole[coordinate]),
      maximum: Math.max(range.maximum, drillhole[coordinate]),
    }),
    {
      minimum: Number.POSITIVE_INFINITY,
      maximum: Number.NEGATIVE_INFINITY,
    },
  );
}

function formatCell(value: string | number | undefined) {
  if (value === undefined) {
    return "—";
  }
  return typeof value === "number" ? numberFormat.format(value) : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProjectDataFiles({
  projectId,
  initialFiles,
}: ProjectDataFilesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(initialFiles);
  const [summaryRefreshToken, setSummaryRefreshToken] = useState(0);
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPreview(null);

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setErrorMessage("Formato no compatible. Selecciona un archivo .xlsx o .xls.");
      event.target.value = "";
      return;
    }

    setIsReading(true);
    try {
      const result = await importDrillholesFromExcel(file);
      setPreview({
        fileName: file.name,
        fileType: file.type || file.name.split(".").pop()?.toLowerCase() || "",
        result,
      });
      if (result.validRows === 0 && result.errors.length > 0) {
        setErrorMessage(result.errors[0]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `No se pudo leer el archivo: ${error.message}`
          : "No se pudo leer el archivo Excel.",
      );
    } finally {
      setIsReading(false);
      event.target.value = "";
    }
  }

  async function handleSave() {
    if (!preview || preview.result.validRows === 0 || isSaving) {
      return;
    }

    if (!UUID_PATTERN.test(projectId)) {
      setErrorMessage(
        `No se puede registrar el archivo: el ID del proyecto no es un UUID válido (${projectId}).`,
      );
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    const payload = {
      project_id: projectId,
      file_name: preview.fileName,
      file_type: preview.fileType,
    };

    console.log("PROJECT_FILE_PAYLOAD", payload);

    const { data: projectFile, error: fileError } = await supabase
      .from("project_files")
      .insert(payload)
      .select("id, file_name, file_type, uploaded_at")
      .single();

    if (fileError) {
      console.error(fileError);
      setErrorMessage(`No se pudo registrar el archivo: ${fileError.message}`);
      setIsSaving(false);
      return;
    }

    const drillholes: DrillholeInsert[] = preview.result.drillholes.map(
      (drillhole) => ({
        project_id: projectId,
        source_file_id: projectFile.id,
        drillhole_id: drillhole.name,
        easting: drillhole.x,
        northing: drillhole.y,
        ...(drillhole.z !== undefined ? { elevation: drillhole.z } : {}),
        ...(drillhole.depth !== undefined
          ? { total_depth: drillhole.depth }
          : {}),
        ...(drillhole.thickness !== undefined
          ? { thickness: drillhole.thickness }
          : {}),
        ...(drillhole.density !== undefined
          ? { density: drillhole.density }
          : {}),
        ...(drillhole.grade !== undefined ? { grade: drillhole.grade } : {}),
      }),
    );
    const { error: drillholesError } = await supabase
      .from("drillholes")
      .insert(drillholes);

    if (drillholesError) {
      const { error: cleanupError } = await supabase
        .from("project_files")
        .delete()
        .eq("id", projectFile.id);

      if (cleanupError) {
        console.error(cleanupError);
      }

      setErrorMessage(
        cleanupError
          ? `No se pudieron guardar los sondajes (${drillholesError.message}) ni limpiar el registro del archivo (${cleanupError.message}).`
          : `No se pudieron guardar los sondajes: ${drillholesError.message}. Se eliminó el registro del archivo para evitar dejar una importación incompleta.`,
      );
      setIsSaving(false);
      return;
    }

    setFiles((currentFiles) => [projectFile, ...currentFiles]);
    setSummaryRefreshToken((currentToken) => currentToken + 1);
    setSuccessMessage(
      preview.result.invalidRows > 0
        ? `Se importaron ${preview.result.validRows} sondajes. Se omitieron ${preview.result.invalidRows} filas con datos requeridos vacíos o inválidos.`
        : `Se importaron ${preview.result.validRows} sondajes correctamente.`,
    );
    setIsSaving(false);
  }

  const rows = preview?.result.drillholes ?? [];
  const eastingRange = rows.length > 0 ? getCoordinateRange(rows, "x") : null;
  const northingRange = rows.length > 0 ? getCoordinateRange(rows, "y") : null;

  return (
    <>
      <DrillholeSummary
        projectId={projectId}
        refreshToken={summaryRefreshToken}
      />

      <section
        aria-labelledby="excel-import-heading"
        className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8"
        id="excel-import"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
            IMPORTACIÓN DE DATOS
          </p>
          <h2 id="excel-import-heading" className="mt-2 text-2xl font-semibold">
            Cargar Datos desde Excel
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            La primera hoja debe incluir ID Sondaje, Este (m E) y Norte (m S).
          </p>
        </div>

        <input
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          aria-label="Seleccionar archivo Excel"
          className="sr-only"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="mt-5 rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isReading || isSaving}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {isReading ? "Leyendo archivo..." : "Seleccionar Excel"}
        </button>

        {errorMessage && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200" role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-200" role="status">
            {successMessage}
          </p>
        )}

        {preview && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold">Vista previa del archivo</h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Nombre archivo</dt>
                <dd className="mt-1 break-all font-medium">{preview.fileName}</dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Cantidad de registros válidos</dt>
                <dd className="mt-1 font-medium">{preview.result.validRows}</dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Filas omitidas</dt>
                <dd className="mt-1 font-medium">{preview.result.invalidRows}</dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Coordenada Este mínima</dt>
                <dd className="mt-1 font-medium">
                  {eastingRange ? numberFormat.format(eastingRange.minimum) : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Coordenada Este máxima</dt>
                <dd className="mt-1 font-medium">
                  {eastingRange ? numberFormat.format(eastingRange.maximum) : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Coordenada Norte mínima</dt>
                <dd className="mt-1 font-medium">
                  {northingRange ? numberFormat.format(northingRange.minimum) : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <dt className="text-sm text-slate-400">Coordenada Norte máxima</dt>
                <dd className="mt-1 font-medium">
                  {northingRange ? numberFormat.format(northingRange.maximum) : "—"}
                </dd>
              </div>
            </dl>

            {preview.result.errors.length > 0 && (
              <details className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                <summary className="cursor-pointer font-medium">
                  Revisar advertencias ({preview.result.errors.length})
                </summary>
                <ul className="mt-3 list-inside list-disc space-y-1">
                  {preview.result.errors.map((message, index) => (
                    <li key={`${index}-${message}`}>{message}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-6">
              <h3 className="text-lg font-semibold">Primeras 20 filas</h3>
              {rows.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-slate-700 px-5 py-8 text-center text-slate-400">
                  No hay filas válidas para mostrar. Revisa los encabezados y los datos requeridos.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                    <thead className="bg-slate-950 text-slate-300">
                      <tr>
                        {previewColumns.map((column) => (
                          <th className="whitespace-nowrap px-4 py-3 font-semibold" key={column.key} scope="col">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {rows.slice(0, 20).map((drillhole, index) => (
                        <tr className="bg-slate-900/70" key={`${drillhole.name}-${index}`}>
                          {previewColumns.map((column) => (
                            <td className="whitespace-nowrap px-4 py-3 text-slate-200" key={column.key}>
                              {formatCell(drillhole[column.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              className="mt-6 rounded-lg bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || isReading || preview.result.validRows === 0}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? "Guardando datos..." : "Guardar datos"}
            </button>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Archivos del Proyecto</h2>
        {files.length > 0 ? (
          <ul className="mt-6 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
            {files.map((file) => (
              <li className="grid gap-2 p-5 sm:grid-cols-3" key={file.id}>
                <p className="font-medium">{file.file_name}</p>
                <p className="text-slate-300">{file.file_type}</p>
                <p className="text-sm text-slate-400">{formatDate(file.uploaded_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
            No existen archivos cargados
          </p>
        )}
      </section>
    </>
  );
}
