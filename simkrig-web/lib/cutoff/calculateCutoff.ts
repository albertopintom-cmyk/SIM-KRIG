import type { LoadedEstimationBlock } from "@/lib/blocks/loadPersistedBlocks";

export type CutoffClassification = "mineral" | "estéril" | "sin datos";

export type CutoffBlockResult = {
  blockId: string;
  blockName: string;
  area: number;
  grade: number | null;
  blockTonnage: number | null;
  classification: CutoffClassification;
  recoverableTonnage: number | null;
  recoverableFineMetal: number | null;
};

export type CutoffAnalysis = {
  cutoffGrade: number;
  blocks: CutoffBlockResult[];
  mineralBlockCount: number;
  wasteBlockCount: number;
  blocksWithoutGrade: number;
  blocksWithoutTonnage: number;
  recoverableTonnage: number;
  recoverableAverageGrade: number | null;
  recoverableFineMetal: number;
};

export type CutoffCurvePoint = {
  cutoffGrade: number;
  mineralBlockCount: number;
  wasteBlockCount: number;
  recoverableTonnage: number;
  recoverableAverageGrade: number | null;
  recoverableFineMetal: number;
};

function getVariableValue(
  block: LoadedEstimationBlock,
  variableName: string,
): number | null {
  return (
    block.variables.find((variable) => variable.variable_name === variableName)
      ?.value ?? null
  );
}

export function calculateCutoff(
  blocks: readonly LoadedEstimationBlock[],
  cutoffGrade: number,
): CutoffAnalysis {
  if (!Number.isFinite(cutoffGrade) || cutoffGrade < 0) {
    throw new Error("La ley de corte debe ser un número finito no negativo.");
  }

  const results = blocks.map((block): CutoffBlockResult => {
    const grade = getVariableValue(block, "Ley");
    const blockTonnage = getVariableValue(block, "Tonelaje");

    if (grade !== null && grade < 0) {
      throw new Error(`El bloque ${block.block_name} tiene una ley negativa.`);
    }
    if (blockTonnage !== null && blockTonnage < 0) {
      throw new Error(
        `El bloque ${block.block_name} tiene un tonelaje negativo.`,
      );
    }

    const classification: CutoffClassification =
      grade === null
        ? "sin datos"
        : grade >= cutoffGrade
          ? "mineral"
          : "estéril";
    const recoverableTonnage =
      classification === "sin datos"
        ? null
        : classification === "mineral"
          ? blockTonnage
          : 0;
    const recoverableFineMetal =
      classification === "mineral" &&
      grade !== null &&
      blockTonnage !== null
        ? (blockTonnage * grade) / 100
        : classification === "estéril"
          ? 0
          : null;

    return {
      blockId: block.id,
      blockName: block.block_name,
      area: block.area,
      grade,
      blockTonnage,
      classification,
      recoverableTonnage,
      recoverableFineMetal,
    };
  });

  const mineralBlocks = results.filter(
    (block) => block.classification === "mineral",
  );
  const recoverableBlocks = mineralBlocks.filter(
    (block) =>
      block.recoverableTonnage !== null &&
      block.recoverableFineMetal !== null,
  );
  const recoverableTonnage = recoverableBlocks.reduce(
    (total, block) => total + (block.recoverableTonnage ?? 0),
    0,
  );
  const recoverableFineMetal = recoverableBlocks.reduce(
    (total, block) => total + (block.recoverableFineMetal ?? 0),
    0,
  );

  return {
    cutoffGrade,
    blocks: results,
    mineralBlockCount: mineralBlocks.length,
    wasteBlockCount: results.filter(
      (block) => block.classification === "estéril",
    ).length,
    blocksWithoutGrade: results.filter((block) => block.grade === null).length,
    blocksWithoutTonnage: results.filter(
      (block) => block.blockTonnage === null,
    ).length,
    recoverableTonnage,
    recoverableAverageGrade:
      recoverableTonnage > 0
        ? (recoverableFineMetal / recoverableTonnage) * 100
        : null,
    recoverableFineMetal,
  };
}

export function calculateCutoffCurve(
  blocks: readonly LoadedEstimationBlock[],
  cutoffGrades: readonly number[],
): CutoffCurvePoint[] {
  return [...cutoffGrades]
    .sort((left, right) => left - right)
    .map((cutoffGrade) => {
      const analysis = calculateCutoff(blocks, cutoffGrade);
      return {
        cutoffGrade: analysis.cutoffGrade,
        mineralBlockCount: analysis.mineralBlockCount,
        wasteBlockCount: analysis.wasteBlockCount,
        recoverableTonnage: analysis.recoverableTonnage,
        recoverableAverageGrade: analysis.recoverableAverageGrade,
        recoverableFineMetal: analysis.recoverableFineMetal,
      };
    });
}
