import type { Vertex } from "./Vertex";

export interface Triangle {
  id: string;
  drillholeIds: string[];
  vertices: Vertex[];
  area: number;
  perimeter: number;
}
