"use client";

import { useRef, useState } from "react";
import { importDrillholesFromExcel } from "@/lib/geometry/importDrillholes";
import type {
  DrillholeImportResult,
  DrillholeImportSummary,
} from "@/types/DrillholeImport";
import type { Drillhole } from "@/types/Drillhole";

type DrillholeExcelImportProps = {
  drillholes: readonly Drillhole[];
  importedDrillholes: readonly Drillhole[];
  summary: DrillholeImportSummary | null;
  onImport: (
    fileName: string,
    result: DrillholeImportResult,
  ) => void;
};

const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

export default function DrillholeExcelImport({
  drillholes,
  importedDrillholes,
  summary,
  onImport,
}: DrillholeExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setFileError("Formato no compatible. Selecciona un archivo .xlsx o .xls.");
      event.target.value = "";
      return;
    }

    setFileError(null);
    setIsReading(true);
    try {
      const result = await importDrillholesFromExcel(file);
      onImport(file.name, result);
    } catch (error) {
      setFileError(
        error instanceof Error
          ? `No se pudo leer el archivo: ${error.message}`
          : "No se pudo leer el archivo Excel.",
      );
    } finally {
      setIsReading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="drillhole-import" aria-labelledby="drillhole-import-heading">
      <div className="subsection-title">
        <h3 id="drillhole-import-heading">Importar sondajes</h3>
        <span>XLS / XLSX</span>
      </div>
      <input
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        aria-label="Seleccionar archivo Excel con sondajes"
        className="visually-hidden-file-input"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <button
        className="import-excel-button"
        disabled={isReading}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <span aria-hidden="true">▤</span>
        {isReading ? "Leyendo archivo..." : "Import Excel"}
      </button>
      <p className="drillhole-import-hint">
        Se leerá la primera hoja. Requiere ID Sondaje, Este (m E) y Norte (m S).
      </p>

      {fileError && (
        <p className="import-error" role="alert">
          {fileError}
        </p>
      )}

      {summary && (
        <section className="import-summary" aria-label="Resumen de importación">
          <div className="import-summary-title">
            <strong>Resumen de importación</strong>
            <span title={summary.fileName}>ARCHIVO: {summary.fileName}</span>
          </div>
          <dl className="import-summary-stats">
            <div>
              <dt>Filas válidas</dt>
              <dd>{summary.validRows}</dd>
            </div>
            <div>
              <dt>Filas inválidas</dt>
              <dd className={summary.invalidRows > 0 ? "has-invalid-rows" : ""}>
                {summary.invalidRows}
              </dd>
            </div>
            <div>
              <dt>Total sondajes</dt>
              <dd>{drillholes.length}</dd>
            </div>
          </dl>
          {summary.errors.length > 0 && (
            <details className="import-errors">
              <summary>Ver errores ({summary.errors.length})</summary>
              <ul>
                {summary.errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <div className="import-preview">
        <div className="subsection-title">
          <h3>Vista previa importada</h3>
          <span>{importedDrillholes.length} FILAS</span>
        </div>
        {importedDrillholes.length === 0 ? (
          <p className="vertex-empty">Las filas importadas aparecerán aquí.</p>
        ) : (
          <div className="import-preview-table-wrap">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Sondaje</th>
                  <th>X (m E)</th>
                  <th>Y (m S)</th>
                  <th>Ley Cu (%)</th>
                </tr>
              </thead>
              <tbody>
                {importedDrillholes.map((drillhole) => (
                  <tr key={drillhole.id}>
                    <th scope="row">{drillhole.name}</th>
                    <td>{numberFormat.format(drillhole.x)}</td>
                    <td>{numberFormat.format(drillhole.y)}</td>
                    <td>
                      {drillhole.grade === undefined
                        ? "—"
                        : numberFormat.format(drillhole.grade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
