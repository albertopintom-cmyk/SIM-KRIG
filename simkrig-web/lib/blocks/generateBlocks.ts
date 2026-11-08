export interface DrillholeForBlock {
  drillhole_id: string;
  easting: number;
  northing: number;
  thickness: number | null;
  density: number | null;
  grade: number | null;
}

export interface BlockVertex {
  easting: number;
  northing: number;
}

export interface BlockVariable {
  name: string;
  value: number | null;
  unit: string;
}

export interface EstimationBlock {
  id: string;
  vertices: readonly [BlockVertex, BlockVertex, BlockVertex, BlockVertex];
  area: number;
  avg_thickness: number | null;
  avg_density: number | null;
  avg_grade: number | null;
  variables: readonly BlockVariable[];
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
  thickness: number | null,
  density: number | null,
  grade: number | null,
): BlockVariable[] {
  return [
    { name: "Potencia", value: thickness, unit: "m" },
    { name: "Densidad", value: density, unit: "t/m³" },
    { name: "Ley", value: grade, unit: "%" },
  ];
}

export function generateBlocks(
  drillholes: readonly DrillholeForBlock[],
): EstimationBlock[] {
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

  const blocks: EstimationBlock[] = [];
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

      const vertices = [
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
      ] as const;
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

      blocks.push({
        id: `block-${northingIndex + 1}-${eastingIndex + 1}`,
        vertices,
        area: eastWidth * northWidth,
        avg_thickness: avgThickness,
        avg_density: avgDensity,
        avg_grade: avgGrade,
        variables: getVariables(avgThickness, avgDensity, avgGrade),
      });
    }
  }

  return blocks;
}
