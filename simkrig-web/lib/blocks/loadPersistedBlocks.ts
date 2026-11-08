import { supabase } from "@/lib/supabase/client";
import type {
  BlockGeometry,
  EstimationBlock,
} from "@/types/EstimationBlock";
import { loadVariables } from "@/lib/blocks/loadVariables";
import type { BlockVariable } from "@/types/BlockVariable";

export type LoadedEstimationBlock = EstimationBlock & {
  variables: BlockVariable[];
};

const PAGE_SIZE = 1000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBlockVertex(
  value: unknown,
): value is BlockGeometry[number] {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.easting) && isFiniteNumber(record.northing);
}

function isBlockGeometry(value: unknown): value is BlockGeometry {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(isBlockVertex)
  );
}

function isEstimationBlock(value: unknown): value is EstimationBlock {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.project_id === "string" &&
    typeof record.block_name === "string" &&
    isFiniteNumber(record.area) &&
    isBlockGeometry(record.geometry) &&
    typeof record.created_at === "string"
  );
}

export async function loadPersistedBlocks(
  projectId: string,
  signal?: AbortSignal,
): Promise<LoadedEstimationBlock[]> {
  const blocks: EstimationBlock[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let request = supabase
      .from("estimation_blocks")
      .select("id, project_id, block_name, area, geometry, created_at")
      .eq("project_id", projectId)
      .order("block_name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (signal) {
      request = request.abortSignal(signal);
    }

    const { data, error } = await request;
    if (error) {
      throw new Error(`No se pudieron cargar los bloques: ${error.message}`);
    }

    const rows: unknown[] = data ?? [];
    for (const row of rows) {
      if (!isEstimationBlock(row)) {
        throw new Error("La base de datos devolvió un bloque con formato inválido.");
      }
      blocks.push(row);
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  const variables = await loadVariables(
    blocks.map((block) => block.id),
    signal,
  );
  const variablesByBlock = new Map<string, BlockVariable[]>();
  for (const variable of variables) {
    const blockVariables = variablesByBlock.get(variable.block_id) ?? [];
    blockVariables.push(variable);
    variablesByBlock.set(variable.block_id, blockVariables);
  }

  return blocks.map((block) => ({
    ...block,
    variables: variablesByBlock.get(block.id) ?? [],
  }));
}
