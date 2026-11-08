import { supabase } from "@/lib/supabase/client";
import type { BlockVariable } from "@/types/BlockVariable";

const PAGE_SIZE = 1000;

function isBlockVariable(value: unknown): value is BlockVariable {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.block_id === "string" &&
    typeof record.variable_name === "string" &&
    (record.value === null ||
      (typeof record.value === "number" && Number.isFinite(record.value))) &&
    typeof record.unit === "string" &&
    typeof record.calculation_method === "string" &&
    typeof record.created_at === "string"
  );
}

export async function loadVariables(
  blockIds: readonly string[],
  signal?: AbortSignal,
): Promise<BlockVariable[]> {
  if (blockIds.length === 0) {
    return [];
  }

  const variables: BlockVariable[] = [];

  for (let startIndex = 0; startIndex < blockIds.length; startIndex += PAGE_SIZE) {
    const batchIds = blockIds.slice(startIndex, startIndex + PAGE_SIZE);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      let request = supabase
        .from("block_variables")
        .select(
          "id, block_id, variable_name, value, unit, calculation_method, created_at",
        )
        .in("block_id", batchIds)
        .order("variable_name", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (signal) {
        request = request.abortSignal(signal);
      }

      const { data, error } = await request;
      if (error) {
        throw new Error(`No se pudieron cargar las variables: ${error.message}`);
      }

      const rows: unknown[] = data ?? [];
      for (const row of rows) {
        if (!isBlockVariable(row)) {
          throw new Error(
            "La base de datos devolvió una variable de bloque con formato inválido.",
          );
        }
        variables.push(row);
      }

      if (rows.length < PAGE_SIZE) {
        break;
      }
    }
  }

  return variables;
}
