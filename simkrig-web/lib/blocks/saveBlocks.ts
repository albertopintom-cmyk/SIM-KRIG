import { supabase } from "@/lib/supabase";
import type { EstimationBlockInsert } from "@/types/EstimationBlock";

export async function saveBlocks(
  projectId: string,
  blocks: readonly EstimationBlockInsert[],
): Promise<number> {
  const { data, error } = await supabase.rpc("save_estimation_blocks", {
    p_project_id: projectId,
    p_blocks: blocks,
  });

  if (error) {
    throw new Error(`No se pudieron guardar los bloques: ${error.message}`);
  }

  if (typeof data !== "number" || !Number.isInteger(data) || data < 0) {
    throw new Error(
      "La base de datos devolvió un resultado inválido al guardar los bloques.",
    );
  }

  return data;
}
