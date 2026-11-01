"use client";

import type { Drillhole } from "@/types/Drillhole";
import { CANVAS_HEIGHT } from "@/lib/geometry/polygonTypes";
import type { ViewBox } from "@/lib/geometry/calculateWorkspaceExtents";

type DrillholeLayerProps = {
  drillholes: readonly Drillhole[];
  linkedDrillholeIds: readonly string[];
  selectedDrillholeId: string | null;
  screenScale: number;
  viewBox: ViewBox;
  onMove: (id: string, coordinates: { x: number; y: number }) => void;
};

export default function DrillholeLayer({
  drillholes,
  linkedDrillholeIds,
  selectedDrillholeId,
  screenScale,
  viewBox,
  onMove,
}: DrillholeLayerProps) {
  return (
    <g aria-label="Sondajes">
      {drillholes.map((drillhole) => {
        const isLinked = linkedDrillholeIds.includes(drillhole.id);
        const isSelected = selectedDrillholeId === drillhole.id;
        const actualX = drillhole.x;
        const actualY = CANVAS_HEIGHT - drillhole.y;
        const outsideLeft = actualX < viewBox.x;
        const outsideRight = actualX > viewBox.x + viewBox.width;
        const outsideTop = actualY < viewBox.y;
        const outsideBottom = actualY > viewBox.y + viewBox.height;
        const isOutOfView =
          outsideLeft || outsideRight || outsideTop || outsideBottom;
        const horizontalDistance = outsideLeft
          ? viewBox.x - actualX
          : outsideRight
            ? actualX - (viewBox.x + viewBox.width)
            : 0;
        const verticalDistance = outsideTop
          ? viewBox.y - actualY
          : outsideBottom
            ? actualY - (viewBox.y + viewBox.height)
            : 0;
        const edge = isOutOfView
          ? horizontalDistance >= verticalDistance
            ? outsideLeft
              ? "left"
              : "right"
            : outsideTop
              ? "top"
              : "bottom"
          : null;
        const markerRadius = (isSelected ? 8 : 6) * screenScale;
        const edgeInset = 10 * screenScale;
        const x = isOutOfView
          ? Math.max(
              viewBox.x + edgeInset,
              Math.min(viewBox.x + viewBox.width - edgeInset, actualX),
            )
          : actualX;
        const y = isOutOfView
          ? Math.max(
              viewBox.y + edgeInset,
              Math.min(viewBox.y + viewBox.height - edgeInset, actualY),
            )
          : actualY;
        const labelFontSize = (isSelected ? 16 : 14) * screenScale;
        const labelWidth = drillhole.name.length * labelFontSize * 0.62;
        const labelOffset = markerRadius + 5 * screenScale;
        const labelOnRight =
          !isOutOfView &&
          x + labelOffset + labelWidth <= viewBox.x + viewBox.width - edgeInset;
        const labelOnLeft =
          !isOutOfView &&
          x - labelOffset - labelWidth >= viewBox.x + edgeInset;
        const labelAnchor =
          edge === "left" || labelOnRight
            ? "start"
            : edge === "right" || labelOnLeft
              ? "end"
              : "middle";
        const labelX =
          edge === "left" || labelOnRight
            ? x + labelOffset
            : edge === "right" || labelOnLeft
              ? x - labelOffset
              : Math.max(
                  viewBox.x + labelWidth / 2 + edgeInset,
                  Math.min(
                    viewBox.x + viewBox.width - labelWidth / 2 - edgeInset,
                    x,
                  ),
                );
        const labelY =
          edge === "top"
            ? y + labelOffset + labelFontSize
            : edge === "bottom"
              ? y - labelOffset
              : Math.max(
                  viewBox.y + labelFontSize + edgeInset,
                  Math.min(
                    viewBox.y + viewBox.height - edgeInset,
                    y + labelFontSize * 0.35,
                  ),
                );
        const edgeIndicatorPath =
          edge === "left"
            ? `M ${x - 8 * screenScale} ${y} l ${5 * screenScale} ${-5 * screenScale} v ${10 * screenScale} Z`
            : edge === "right"
              ? `M ${x + 8 * screenScale} ${y} l ${-5 * screenScale} ${-5 * screenScale} v ${10 * screenScale} Z`
              : edge === "top"
                ? `M ${x} ${y - 8 * screenScale} l ${-5 * screenScale} ${5 * screenScale} h ${10 * screenScale} Z`
                : edge === "bottom"
                  ? `M ${x} ${y + 8 * screenScale} l ${-5 * screenScale} ${-5 * screenScale} h ${10 * screenScale} Z`
                  : null;

        return (
          <g
            aria-label={`${drillhole.name}, X ${drillhole.x.toFixed(1)} metros, Y ${drillhole.y.toFixed(1)} metros${isOutOfView ? ", indicador de sondaje fuera del encuadre" : ""}`}
            className={`drillhole-marker ${isLinked ? "is-linked" : ""} ${isSelected ? "is-selected" : ""} ${isOutOfView ? "is-offscreen" : ""}`}
            data-drillhole-id={drillhole.id}
            data-out-of-view={isOutOfView || undefined}
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
            <circle
              className="drillhole-hit-area"
              cx={x}
              cy={y}
              r={12 * screenScale}
            />
            <circle
              className="drillhole-halo"
              cx={x}
              cy={y}
              r={markerRadius}
              style={{ strokeWidth: 1.5 * screenScale }}
            />
            <circle
              className="drillhole-core"
              cx={x}
              cy={y}
              r={2 * screenScale}
            />
            <path
              className="drillhole-crosshair"
              d={`M ${x - 8 * screenScale} ${y} H ${x - 4 * screenScale} M ${x + 4 * screenScale} ${y} H ${x + 8 * screenScale} M ${x} ${y - 8 * screenScale} V ${y - 4 * screenScale} M ${x} ${y + 4 * screenScale} V ${y + 8 * screenScale}`}
              style={{ strokeWidth: screenScale }}
            />
            {edgeIndicatorPath && (
              <path
                className="drillhole-offscreen-indicator"
                d={edgeIndicatorPath}
                style={{ strokeWidth: 1.5 * screenScale }}
              />
            )}
            <text
              className="drillhole-label"
              textAnchor={labelAnchor}
              x={labelX}
              y={labelY}
              style={{
                fontSize: `${labelFontSize}px`,
                strokeWidth: `${2 * screenScale}px`,
              }}
            >
              {drillhole.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
