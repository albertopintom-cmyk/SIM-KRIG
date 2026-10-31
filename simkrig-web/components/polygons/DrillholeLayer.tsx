"use client";

import type { Drillhole } from "@/types/Drillhole";
import { CANVAS_HEIGHT } from "@/lib/geometry/polygonTypes";

type DrillholeLayerProps = {
  drillholes: readonly Drillhole[];
  linkedDrillholeIds: readonly string[];
  onMove: (id: string, coordinates: { x: number; y: number }) => void;
};

export default function DrillholeLayer({
  drillholes,
  linkedDrillholeIds,
  onMove,
}: DrillholeLayerProps) {
  return (
    <g aria-label="Sondajes">
      {drillholes.map((drillhole) => {
        const isLinked = linkedDrillholeIds.includes(drillhole.id);
        const y = CANVAS_HEIGHT - drillhole.y;

        return (
          <g
            aria-label={`${drillhole.name}, X ${drillhole.x.toFixed(1)} metros, Y ${drillhole.y.toFixed(1)} metros`}
            className={`drillhole-marker ${isLinked ? "is-linked" : ""}`}
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
            <circle className="drillhole-hit-area" cx={drillhole.x} cy={y} r="19" />
            <circle className="drillhole-halo" cx={drillhole.x} cy={y} r="9" />
            <circle className="drillhole-core" cx={drillhole.x} cy={y} r="3" />
            <path
              className="drillhole-crosshair"
              d={`M ${drillhole.x - 13} ${y} H ${drillhole.x - 7} M ${drillhole.x + 7} ${y} H ${drillhole.x + 13} M ${drillhole.x} ${y - 13} V ${y - 7} M ${drillhole.x} ${y + 7} V ${y + 13}`}
            />
            <text className="drillhole-label" x={drillhole.x + 12} y={y + 4}>
              {drillhole.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
