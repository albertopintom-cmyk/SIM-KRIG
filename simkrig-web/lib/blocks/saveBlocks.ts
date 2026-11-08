import { supabase } from "@/lib/supabase/client";
import type { EstimationBlockInsert } from "@/types/EstimationBlock";

function validateBlocks(blocks: readonly EstimationBlockInsert[]) {
  if (blocks.length === 0) {
    throw new Error("No hay bloques para guardar.");
  }

  for (const [blockIndex, block] of blocks.entries()) {
    if (typeof block !== "object" || block === null) {
      throw new Error(`El bloque ${blockIndex + 1} no es un objeto válido.`);
    }

    if (
      typeof block.block_name !== "string" ||
      block.block_name.trim() === "" ||
      !Number.isFinite(block.area) ||
      block.area < 0
    ) {
      throw new Error(`El bloque ${blockIndex + 1} tiene datos inválidos.`);
    }

    if (!Array.isArray(block.geometry) || block.geometry.length !== 4) {
      throw new Error(
        `La geometría del bloque ${block.block_name} debe tener cuatro vértices.`,
      );
    }

    for (const [vertexIndex, vertex] of block.geometry.entries()) {
      if (
        vertex === null ||
        typeof vertex !== "object" ||
        !Number.isFinite(vertex.easting) ||
        !Number.isFinite(vertex.northing)
      ) {
        throw new Error(
          `El vértice ${vertexIndex + 1} del bloque ${block.block_name} contiene coordenadas inválidas.`,
        );
      }
    }

    if (!Array.isArray(block.variables)) {
      throw new Error(
        `Las variables del bloque ${block.block_name} deben ser un arreglo.`,
      );
    }

    for (const [variableIndex, variable] of block.variables.entries()) {
      if (
        variable === null ||
        typeof variable !== "object" ||
        typeof variable.variable_name !== "string" ||
        variable.variable_name.trim() === "" ||
        typeof variable.unit !== "string" ||
        typeof variable.calculation_method !== "string" ||
        (variable.value !== null &&
          (typeof variable.value !== "number" ||
            !Number.isFinite(variable.value)))
      ) {
        throw new Error(
          `La variable ${variableIndex + 1} del bloque ${block.block_name} contiene datos inválidos.`,
        );
      }
    }
  }
}

export async function saveBlocks(
  projectId: string,
  blocks: readonly EstimationBlockInsert[],
): Promise<number> {
  validateBlocks(blocks);

  const payload = blocks.map((block) => ({
    block_name: block.block_name,
    area: block.area,
    geometry: block.geometry.map((vertex) => ({
      easting: vertex.easting,
      northing: vertex.northing,
    })),
    variables: block.variables.map((variable) => ({
      variable_name: variable.variable_name,
      value: variable.value,
      unit: variable.unit,
      calculation_method: variable.calculation_method,
    })),
  }));

  console.log("PROJECT ID:", projectId);
  console.log("BLOCK COUNT:", blocks.length);
  console.log("BLOCKS:", payload);

  const result = await supabase.rpc("save_estimation_blocks", {
    p_project_id: projectId,
    p_blocks: payload,
  });

  console.log("RPC RESULT:", result);

  const { data, error } = result;
  if (error) {
    console.error("RPC ERROR:", JSON.stringify(error, null, 2));
    console.error("RPC ERROR CODE:", error.code);
    console.error("RPC ERROR MESSAGE:", error.message);
    console.error("RPC ERROR DETAILS:", error.details);
    console.error("RPC ERROR HINT:", error.hint);
    throw new Error(
      [
        "No se pudieron guardar los bloques.",
        `code=${error.code}`,
        `message=${error.message}`,
        `details=${error.details}`,
        `hint=${error.hint}`,
      ].join(" "),
    );
  }

  if (typeof data !== "number" || !Number.isInteger(data) || data < 0) {
    throw new Error(
      "La base de datos devolvió un resultado inválido al guardar los bloques.",
    );
  }

  return data;
}
