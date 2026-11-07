import * as XLSX from "xlsx";
import type {
  DrillholeImportResult,
  ImportedDrillhole,
} from "@/types/DrillholeImport";

type ColumnKey =
  | "name"
  | "x"
  | "y"
  | "z"
  | "depth"
  | "thickness"
  | "density"
  | "grade";

const COLUMN_HEADERS: Record<ColumnKey, string> = {
  name: "ID Sondaje",
  x: "Este (m E)",
  y: "Norte (m S)",
  z: "Cota (m s.n.m.)",
  depth: "Profundidad Total (m)",
  thickness: "Potencia del Yacimiento / Tramo (m)",
  density: "Densidad Compositada (t/m3)",
  grade: "Ley Media Cu (%)",
};

const REQUIRED_COLUMNS: ColumnKey[] = ["name", "x", "y"];
function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericCell(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getOptionalNumber(
  row: unknown[],
  columnIndex: number | undefined,
): number | undefined {
  if (columnIndex === undefined) {
    return undefined;
  }
  return parseNumericCell(row[columnIndex]);
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every(
    (value) => value === null || value === undefined || String(value).trim() === "",
  );
}

export async function importDrillholesFromExcel(
  file: File,
): Promise<DrillholeImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      drillholes: [],
      validRows: 0,
      invalidRows: 0,
      errors: ["El archivo no contiene hojas de cálculo."],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (rows.length === 0) {
    return {
      drillholes: [],
      validRows: 0,
      invalidRows: 0,
      errors: ["La primera hoja está vacía."],
    };
  }

  const normalizedHeaders = rows[0].map(normalizeHeader);
  const columnIndexes = new Map<ColumnKey, number>();

  for (const [key, header] of Object.entries(COLUMN_HEADERS) as [
    ColumnKey,
    string,
  ][]) {
    const index = normalizedHeaders.indexOf(normalizeHeader(header));
    if (index >= 0) {
      columnIndexes.set(key, index);
    }
  }

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !columnIndexes.has(column),
  );
  if (missingColumns.length > 0) {
    return {
      drillholes: [],
      validRows: 0,
      invalidRows: 0,
      errors: [
        `Faltan columnas requeridas: ${missingColumns
          .map((column) => COLUMN_HEADERS[column])
          .join(", ")}.`,
      ],
    };
  }

  const drillholes: ImportedDrillhole[] = [];
  const errors: string[] = [];
  let invalidRows = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    if (isEmptyRow(row)) {
      continue;
    }

    const nameValue = row[columnIndexes.get("name") ?? -1];
    const name = String(nameValue ?? "").trim();
    const x = parseNumericCell(row[columnIndexes.get("x") ?? -1]);
    const y = parseNumericCell(row[columnIndexes.get("y") ?? -1]);
    const invalidFields: string[] = [];

    if (!name) {
      invalidFields.push(COLUMN_HEADERS.name);
    }
    if (x === undefined) {
      invalidFields.push(COLUMN_HEADERS.x);
    }
    if (y === undefined) {
      invalidFields.push(COLUMN_HEADERS.y);
    }

    if (invalidFields.length > 0 || x === undefined || y === undefined) {
      invalidRows += 1;
      errors.push(
        `Fila ${rowNumber}: dato requerido vacío o inválido (${invalidFields.join(", ")}).`,
      );
      continue;
    }

    const z = getOptionalNumber(row, columnIndexes.get("z"));
    const depth = getOptionalNumber(row, columnIndexes.get("depth"));
    const thickness = getOptionalNumber(row, columnIndexes.get("thickness"));
    const density = getOptionalNumber(row, columnIndexes.get("density"));
    const grade = getOptionalNumber(row, columnIndexes.get("grade"));

    drillholes.push({
      name,
      x,
      y,
      ...(z !== undefined ? { z } : {}),
      ...(depth !== undefined ? { depth } : {}),
      ...(thickness !== undefined ? { thickness } : {}),
      ...(density !== undefined ? { density } : {}),
      ...(grade !== undefined ? { grade } : {}),
    });
  }

  return {
    drillholes,
    validRows: drillholes.length,
    invalidRows,
    errors,
  };
}
