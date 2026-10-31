export type Point = {
  id: string;
  x: number;
  y: number;
};

export type PolygonMethod =
  | "triangle"
  | "rectangle"
  | "free"
  | "voronoi"
  | "convex-hull"
  | "alpha-shape";

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 640;

export const METHOD_LABELS: Record<PolygonMethod, string> = {
  triangle: "Triángulo",
  rectangle: "Rectángulo",
  free: "Polígono libre",
  voronoi: "Voronoi / Thiessen",
  "convex-hull": "Convex Hull",
  "alpha-shape": "Alpha Shape",
};
