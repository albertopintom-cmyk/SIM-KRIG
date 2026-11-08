import { supabase } from "@/lib/supabase";
import type { BlockVariableInsert } from "@/types/BlockVariable";

export interface BlockVariableValue extends BlockVariableInsert {
  block_id: string;
}

export async function saveVariables(
  variables: readonly BlockVariableValue[],
): Promise<void> {
  if (variables.length === 0) {
    return;
  }

  const { error } = await supabase.from("block_variables").upsert(
    variables.map((variable) => ({
      block_id: variable.block_id,
      variable_name: variable.variable_name,
      variation_type: variable.variation_type,
      value: variable.value,
      unit: variable.unit,
      calculation_method: variable.calculation_method,
    })),
    { onConflict: "block_id,variable_name" },
  );

  if (error) {
    throw new Error(`No se pudieron guardar las variables: ${error.message}`);
  }
}
