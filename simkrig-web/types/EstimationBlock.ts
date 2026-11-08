import type { BlockVariableInsert } from "@/types/BlockVariable";

export interface BlockVertex {
  easting: number;
  northing: number;
}

export type BlockGeometry = readonly [
  BlockVertex,
  BlockVertex,
  BlockVertex,
  BlockVertex,
];

export interface EstimationBlock {
  id: string;
  project_id: string;
  block_name: string;
  area: number;
  geometry: BlockGeometry;
  created_at: string;
}

export interface EstimationBlockInsert {
  block_name: string;
  area: number;
  geometry: BlockGeometry;
  variables: readonly BlockVariableInsert[];
}
