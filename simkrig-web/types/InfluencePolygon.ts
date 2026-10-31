import type { Point, PolygonMethod } from "@/lib/geometry/polygonTypes";

export interface InfluencePolygon {
  id: string;
  method: PolygonMethod;
  vertices: Point[];
  drillholeIds: string[];
}
