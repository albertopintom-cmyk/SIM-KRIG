"use client";

import type { Drillhole } from "@/types/Drillhole";
import { CANVAS_HEIGHT } from "@/lib/geometry/polygonTypes";
import type { ViewBox } from "@/lib/geometry/calculateWorkspaceExtents";

type DrillholeLayerProps = {
  drillholes: readonly Drillhole[];
  linkedDrillholeIds: readonly string[];
  selectedDrillholeId: string | null;
  viewBox: ViewBox;
  onMove: (id: string, coordinates: { x: number; y: number }) => void;
};

export default function DrillholeLayer({
  drillholes,
  linkedDrillholeIds,
  selectedDrillholeId,
  viewBox,
  onMove,
}: DrillholeLayerProps) {
  return (
    <g aria-label="Sondajes">
      {drillholes.map((drillhole) => {
        const isLinked = linkedDrillholeIds.includes(drillhole.id);
        const isSelected = selectedDrillholeId === drillhole.id;
        const y = CANVAS_HEIGHT - drillhole.y;
        const labelFontSize = isSelected ? 58 : 52;
        const labelWidth = drillhole.name.length * labelFontSize * 0.62;
        const labelOnRight = drillhole.x + 19 + labelWidth <= viewBox.x + viewBox.width - 4;
        const labelOnLeft = drillhole.x - 19 - labelWidth >= viewBox.x + 4;
        const labelX = labelOnRight
          ? drillhole.x + 19
          : labelOnLeft
            ? drillhole.x - 19
            : Math.max(
                viewBox.x + labelWidth / 2,
                Math.min(viewBox.x + viewBox.width - labelWidth / 2, drillhole.x),
              );
        const labelAnchor = labelOnRight
          ? "start"
          : labelOnLeft
            ? "end"
            : "middle";
        const labelY = Math.max(
          viewBox.y + labelFontSize,
          Math.min(viewBox.y + viewBox.height - labelFontSize * 0.3, y + 5),
        );

        return (
          <g
            aria-label={`${drillhole.name}, X ${drillhole.x.toFixed(1)} metros, Y ${drillhole.y.toFixed(1)} metros`}
            className={`drillhole-marker ${isLinked ? "is-linked" : ""} ${isSelected ? "is-selected" : ""}`}
            data-drillhole-id={drillhole.id}
            key={drillhole.id}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 1;
              let x = drillhole.x;
              let nextY = drillhole.y;

              if (event.key === "ArrowLeft") x -= step;
              else if (event.key === "ArrowRight") x += step;
              else if (event.key === "ArrowDown") nextY -= step;
              else if (event.key === "ArrowUp") nextY += step;
              else return;

              event.preventDefault();
              onMove(drillhole.id, { x, y: nextY });
            }}
            role="button"
            tabIndex={0}
          >
            <circle className="drillhole-hit-area" cx={drillhole.x} cy={y} r="24" />
            <circle className="drillhole-halo" cx={drillhole.x} cy={y} r="12" />
            <circle className="drillhole-core" cx={drillhole.x} cy={y} r="4" />
            <path
              className="drillhole-crosshair"
              d={`M ${drillhole.x - 17} ${y} H ${drillhole.x - 9} M ${drillhole.x + 9} ${y} H ${drillhole.x + 17} M ${drillhole.x} ${y - 17} V ${y - 9} M ${drillhole.x} ${y + 9} V ${y + 17}`}
            />
            <text
              className="drillhole-label"
              textAnchor={labelAnchor}
              x={labelX}
              y={labelY}
            >
              {drillhole.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
