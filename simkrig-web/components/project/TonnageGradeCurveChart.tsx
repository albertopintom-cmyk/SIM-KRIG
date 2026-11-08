"use client";

type CurveValue = {
  cutoffGrade: number;
  value: number | null;
};

export type TonnageGradeCurveSeries = {
  id: string;
  label: string;
  axis: "left" | "right";
  color: string;
  values: readonly CurveValue[];
};

type TonnageGradeCurveChartProps = {
  maximumCutoffGrade: number;
  selectedCutoffGrade: number;
  series: readonly TonnageGradeCurveSeries[];
};

const WIDTH = 900;
const HEIGHT = 460;
const PLOT = { left: 88, right: 88, top: 28, bottom: 76 };
const numberFormat = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function getPath(
  values: readonly CurveValue[],
  axisMaximum: number,
  maximumCutoffGrade: number,
) {
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const xMaximum = maximumCutoffGrade || 1;
  const yMaximum = axisMaximum || 1;
  let path = "";
  let isNewSegment = true;

  for (const point of values) {
    if (point.value === null) {
      isNewSegment = true;
      continue;
    }

    const x = PLOT.left + (point.cutoffGrade / xMaximum) * plotWidth;
    const y = PLOT.top + (1 - point.value / yMaximum) * plotHeight;
    path += `${isNewSegment ? "M" : "L"}${x},${y} `;
    isNewSegment = false;
  }

  return path.trim();
}

export default function TonnageGradeCurveChart({
  maximumCutoffGrade,
  selectedCutoffGrade,
  series,
}: TonnageGradeCurveChartProps) {
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const xMaximum = maximumCutoffGrade || 1;
  const selectedX =
    PLOT.left + (selectedCutoffGrade / xMaximum) * plotWidth;
  const leftMaximum = series
    .filter((item) => item.axis === "left")
    .flatMap((item) => item.values)
    .reduce((maximum, point) => Math.max(maximum, point.value ?? 0), 0);
  const rightMaximum = series
    .filter((item) => item.axis === "right")
    .flatMap((item) => item.values)
    .reduce((maximum, point) => Math.max(maximum, point.value ?? 0), 0);

  return (
    <section
      aria-label="Curva tonelaje-ley"
      className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
    >
      <h3 className="text-xl font-semibold">Curva Tonelaje-Ley</h3>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
        {series.map((item) => (
          <span className="inline-flex items-center gap-2" key={item.id}>
            <span
              aria-hidden="true"
              className="inline-block h-1 w-6 rounded"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg
          aria-label="Gráfico de tonelaje recuperable y ley media recuperable según ley de corte"
          className="min-w-[700px] w-full"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = PLOT.top + (plotHeight * tick) / 4;
            return (
              <g key={tick}>
                <line
                  stroke="#334155"
                  strokeDasharray={tick === 4 ? undefined : "3 5"}
                  x1={PLOT.left}
                  x2={WIDTH - PLOT.right}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="#cbd5e1"
                  fontSize="12"
                  textAnchor="end"
                  x={PLOT.left - 10}
                  y={y + 4}
                >
                  {numberFormat.format((leftMaximum * (4 - tick)) / 4)}
                </text>
                <text
                  fill="#cbd5e1"
                  fontSize="12"
                  textAnchor="start"
                  x={WIDTH - PLOT.right + 10}
                  y={y + 4}
                >
                  {numberFormat.format((rightMaximum * (4 - tick)) / 4)}
                </text>
              </g>
            );
          })}
          <line
            stroke="#64748b"
            x1={PLOT.left}
            x2={PLOT.left}
            y1={PLOT.top}
            y2={HEIGHT - PLOT.bottom}
          />
          <line
            stroke="#64748b"
            x1={WIDTH - PLOT.right}
            x2={WIDTH - PLOT.right}
            y1={PLOT.top}
            y2={HEIGHT - PLOT.bottom}
          />
          <line
            stroke="#64748b"
            x1={PLOT.left}
            x2={WIDTH - PLOT.right}
            y1={HEIGHT - PLOT.bottom}
            y2={HEIGHT - PLOT.bottom}
          />
          {[0, 1, 2, 3, 4].map((tick) => {
            const x = PLOT.left + (plotWidth * tick) / 4;
            return (
              <text
                fill="#cbd5e1"
                fontSize="12"
                key={tick}
                textAnchor="middle"
                x={x}
                y={HEIGHT - PLOT.bottom + 22}
              >
                {numberFormat.format((maximumCutoffGrade * tick) / 4)}
              </text>
            );
          })}
          {series.map((item) => (
            <path
              d={getPath(
                item.values,
                item.axis === "left" ? leftMaximum : rightMaximum,
                maximumCutoffGrade,
              )}
              fill="none"
              key={item.id}
              stroke={item.color}
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          ))}
          <line
            stroke="#f8fafc"
            strokeDasharray="6 5"
            strokeWidth="2"
            x1={selectedX}
            x2={selectedX}
            y1={PLOT.top}
            y2={HEIGHT - PLOT.bottom}
          />
          <text
            fill="#f8fafc"
            fontSize="12"
            textAnchor="middle"
            x={selectedX}
            y={PLOT.top - 8}
          >
            {numberFormat.format(selectedCutoffGrade)}%
          </text>
          <text
            fill="#cbd5e1"
            fontSize="13"
            textAnchor="middle"
            x={WIDTH / 2}
            y={HEIGHT - 14}
          >
            Ley de Corte (%)
          </text>
          <text
            fill="#cbd5e1"
            fontSize="13"
            textAnchor="middle"
            transform={`rotate(-90 20 ${HEIGHT / 2})`}
            x="20"
            y={HEIGHT / 2}
          >
            Tonelaje Recuperable (t)
          </text>
          <text
            fill="#cbd5e1"
            fontSize="13"
            textAnchor="middle"
            transform={`rotate(90 ${WIDTH - 20} ${HEIGHT / 2})`}
            x={WIDTH - 20}
            y={HEIGHT / 2}
          >
            Ley Media Recuperable (%)
          </text>
        </svg>
      </div>
    </section>
  );
}
