import type { Drillhole } from "./Drillhole";

export type ImportedDrillhole = Omit<Drillhole, "id">;

export interface DrillholeImportResult {
  drillholes: ImportedDrillhole[];
  validRows: number;
  invalidRows: number;
  errors: string[];
}

export interface DrillholeImportSummary {
  fileName: string;
  validRows: number;
  invalidRows: number;
  totalDrillholes: number;
  errors: string[];
}
