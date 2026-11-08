export interface BlockVariable {
  id: string;
  block_id: string;
  variable_name: string;
  variation_type: string;
  value: number | null;
  unit: string;
  calculation_method: string;
  created_at: string;
}

export interface BlockVariableInsert {
  variable_name: string;
  variation_type: string;
  value: number | null;
  unit: string;
  calculation_method: string;
}
