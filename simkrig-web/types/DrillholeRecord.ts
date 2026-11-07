export interface DrillholeInsert {
  project_id: string;
  source_file_id: string;
  drillhole_id: string;
  easting: number;
  northing: number;
  elevation?: number;
  total_depth?: number;
  thickness?: number;
  density?: number;
  grade?: number;
}
