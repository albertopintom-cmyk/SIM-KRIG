export interface Drillhole {
  id: string;
  name: string;
  x: number;
  y: number;
  source?: "manual" | "excel";
  z?: number;
  depth?: number;
  thickness?: number;
  density?: number;
  grade?: number;
}
