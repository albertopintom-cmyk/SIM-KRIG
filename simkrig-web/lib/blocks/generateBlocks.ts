import type { BlockVariableInsert } from "@/types/BlockVariable";
import type {
  BlockGeometry,
  EstimationBlockInsert,
} from "@/types/EstimationBlock";

export type { BlockVertex } from "@/types/EstimationBlock";

export interface DrillholeForBlock {
  drillhole_id: string;
  easting: number;
  northing: number;
  thickness: number | null;
  density: number | null;
  grade: number | null;
}

type Axis = {
  coordinates: number[];
  tolerance: number;
};

function getCoordinateTolerance(values: readonly number[]) {
  const magnitude = values.reduce(
    (maximum, value) => Math.max(maximum, Math.abs(value)),
    0,
  );
  return Math.max(1e-6, magnitude * 1e-9);
}

function clusterCoordinates(values: readonly number[]): Axis {
  const tolerance = getCoordinateTolerance(values);
  const sorted = [...values].sort((left, right) => left - right);
  const coordinates: number[] = [];
  let clusterSum = 0;
  let clusterCount = 0;

  for (const value of sorted) {
    const currentCoordinate = coordinates[coordinates.length - 1];
    if (
      currentCoordinate === undefined ||
      value - currentCoordinate > tolerance
    ) {
      if (clusterCount > 0) {
        coordinates[coordinates.length - 1] = clusterSum / clusterCount;
      }
      coordinates.push(value);
      clusterSum = value;
      clusterCount = 1;
    } else {
      clusterSum += value;
      clusterCount += 1;
      coordinates[coordinates.length - 1] = clusterSum / clusterCount;
    }
  }

  return { coordinates, tolerance };
}

function validateRegularAxis(coordinates: readonly number[], axisName: string) {
  if (coordinates.length < 2) {
    throw new Error(
      `No se puede generar bloques: la malla requiere al menos dos coordenadas ${axisName} distintas.`,
    );
  }

  const intervals = coordinates.slice(1).map((value, index) => {
    const previous = coordinates[index];
    if (previous === undefined) {
      throw new Error(`No se pudo validar el intervalo de ${axisName}.`);
    }
    return value - previous;
  });
  const averageInterval =
    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const tolerance = Math.max(1e-6, Math.abs(averageInterval) * 1e-6);

  if (intervals.some((interval) => Math.abs(interval - averageInterval) > tolerance)) {
    throw new Error(
      `La malla no es regular en la coordenada ${axisName}; no se generaron bloques.`,
    );
  }
}

function findCoordinateIndex(axis: Axis, value: number) {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  axis.coordinates.forEach((coordinate, index) => {
    const distance = Math.abs(coordinate - value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestDistance > axis.tolerance || nearestIndex < 0) {
    throw new Error("No se pudo asignar un sondaje a la malla regular.");
  }

  return nearestIndex;
}

function average(values: readonly (number | null)[]) {
  const presentValues = values.filter(
    (value): value is number => value !== null,
  );
  if (presentValues.length === 0) {
    return null;
  }
  return (
    presentValues.reduce((sum, value) => sum + value, 0) /
    presentValues.length
  );
}

function getVariables(
  area: number,
  thickness: number | null,
  density: number | null,
  grade: number | null,
): BlockVariableInsert[] {
  const variables: BlockVariableInsert[] = [
    {
      variable_name: "Potencia",
      variation_type: "continuous",
      value: thickness,
      unit: "m",
      calculation_method: "mean_of_four_neighboring_drillholes",
    },
    {
      variable_name: "Densidad",
      variation_type: "continuous",
      value: density,
      unit: "t/m³",
      calculation_method: "mean_of_four_neighboring_drillholes",
    },
    {
      variable_name: "Ley",
      variation_type: "continuous",
      value: grade,
      unit: "%",
      calculation_method: "mean_of_four_neighboring_drillholes",
    },
  ];

  return addDerivedBlockVariables(variables, area);
}

export function addDerivedBlockVariables(
  variables: readonly BlockVariableInsert[],
  area: number | null,
): BlockVariableInsert[] {
  if (area !== null && (!Number.isFinite(area) || area < 0)) {
    throw new Error(
      "No se pueden calcular variables derivadas: el área del bloque debe ser un valor finito no negativo.",
    );
  }

  const values = new Map(
    variables.map((variable) => [variable.variable_name, variable.value]),
  );
  const thickness = values.get("Potencia") ?? null;
  const density = values.get("Densidad") ?? null;
  const grade = values.get("Ley") ?? null;
  const volume =
    area !== null && thickness !== null ? area * thickness : null;
  const tonnage =
    volume !== null && density !== null ? volume * density : null;
  const fineMetal =
    tonnage !== null && grade !== null ? (tonnage * grade) / 100 : null;
  const derivedVariables: BlockVariableInsert[] = [
    {
      variable_name: "Volumen",
      variation_type: "continuous",
      value: volume,
      unit: "m³",
      calculation_method: "area_x_thickness",
    },
    {
      variable_name: "Tonelaje",
      variation_type: "continuous",
      value: tonnage,
      unit: "t",
      calculation_method: "volume_x_density",
    },
    {
      variable_name: "Metal Fino",
      variation_type: "continuous",
      value: fineMetal,
      unit: "t",
      calculation_method: "tonnage_x_grade",
    },
  ];

  for (const variable of [...variables, ...derivedVariables]) {
    if (
      variable.value !== null &&
      (!Number.isFinite(variable.value) || variable.value < 0)
    ) {
      throw new Error(
        `No se puede generar bloques: la variable ${variable.variable_name} contiene un valor inválido o negativo.`,
      );
    }
  }

  return [
    ...variables.filter(
      (variable) =>
        !derivedVariables.some(
          (derivedVariable) =>
            derivedVariable.variable_name === variable.variable_name,
        ),
    ),
    ...derivedVariables,
  ];
}

export function generateBlocks(
  drillholes: readonly DrillholeForBlock[],
): EstimationBlockInsert[] {
  if (drillholes.length === 0) {
    return [];
  }

  for (const drillhole of drillholes) {
    if (
      drillhole.drillhole_id.trim() === "" ||
      !Number.isFinite(drillhole.easting) ||
      !Number.isFinite(drillhole.northing)
    ) {
      throw new Error(
        "Cada sondaje debe tener un ID y coordenadas Este/Norte válidas.",
      );
    }
  }

  const eastingAxis = clusterCoordinates(
    drillholes.map((drillhole) => drillhole.easting),
  );
  const northingAxis = clusterCoordinates(
    drillholes.map((drillhole) => drillhole.northing),
  );

  validateRegularAxis(eastingAxis.coordinates, "Este");
  validateRegularAxis(northingAxis.coordinates, "Norte");

  const rows = new Map<number, Map<number, DrillholeForBlock>>();
  for (const drillhole of drillholes) {
    const rowIndex = findCoordinateIndex(northingAxis, drillhole.northing);
    const columnIndex = findCoordinateIndex(eastingAxis, drillhole.easting);
    const row = rows.get(rowIndex) ?? new Map<number, DrillholeForBlock>();

    if (row.has(columnIndex)) {
      throw new Error(
        `Hay más de un sondaje en la misma coordenada de malla (${drillhole.easting}, ${drillhole.northing}).`,
      );
    }
    row.set(columnIndex, drillhole);
    rows.set(rowIndex, row);
  }

  const blocks: EstimationBlockInsert[] = [];
  for (
    let northingIndex = 0;
    northingIndex < northingAxis.coordinates.length - 1;
    northingIndex += 1
  ) {
    const southRow = rows.get(northingIndex);
    const northRow = rows.get(northingIndex + 1);
    if (!southRow || !northRow) {
      continue;
    }

    for (
      let eastingIndex = 0;
      eastingIndex < eastingAxis.coordinates.length - 1;
      eastingIndex += 1
    ) {
      const southWest = southRow.get(eastingIndex);
      const southEast = southRow.get(eastingIndex + 1);
      const northWest = northRow.get(eastingIndex);
      const northEast = northRow.get(eastingIndex + 1);
      if (!southWest || !southEast || !northWest || !northEast) {
        continue;
      }

      const geometry: BlockGeometry = [
        {
          easting: eastingAxis.coordinates[eastingIndex]!,
          northing: northingAxis.coordinates[northingIndex]!,
        },
        {
          easting: eastingAxis.coordinates[eastingIndex + 1]!,
          northing: northingAxis.coordinates[northingIndex]!,
        },
        {
          easting: eastingAxis.coordinates[eastingIndex + 1]!,
          northing: northingAxis.coordinates[northingIndex + 1]!,
        },
        {
          easting: eastingAxis.coordinates[eastingIndex]!,
          northing: northingAxis.coordinates[northingIndex + 1]!,
        },
      ];
      const avgThickness = average([
        southWest.thickness,
        southEast.thickness,
        northWest.thickness,
        northEast.thickness,
      ]);
      const avgDensity = average([
        southWest.density,
        southEast.density,
        northWest.density,
        northEast.density,
      ]);
      const avgGrade = average([
        southWest.grade,
        southEast.grade,
        northWest.grade,
        northEast.grade,
      ]);
      const eastWidth =
        eastingAxis.coordinates[eastingIndex + 1]! -
        eastingAxis.coordinates[eastingIndex]!;
      const northWidth =
        northingAxis.coordinates[northingIndex + 1]! -
        northingAxis.coordinates[northingIndex]!;
      const area = eastWidth * northWidth;

      blocks.push({
        block_name: `block-${northingIndex + 1}-${eastingIndex + 1}`,
        geometry,
        area,
        variables: getVariables(
          area,
          avgThickness,
          avgDensity,
          avgGrade,
        ),
      });
    }
  }

  return blocks;
}
