"use client";

import { useState } from "react";
import Link from "next/link";
import PolygonCanvas from "@/components/polygons/PolygonCanvas";
import PolygonInfoPanel from "@/components/polygons/PolygonInfoPanel";
import PolygonToolbar from "@/components/polygons/PolygonToolbar";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type Point,
  type PolygonMethod,
} from "@/lib/geometry/polygonTypes";

const DEFAULT_RECTANGLE = { width: 120, height: 80 };

function createPoint(x: number, y: number): Point {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
  };
}

function createRectangle(width: number, height: number): Point[] {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return [
    createPoint(centerX - halfWidth, centerY - halfHeight),
    createPoint(centerX + halfWidth, centerY - halfHeight),
    createPoint(centerX + halfWidth, centerY + halfHeight),
    createPoint(centerX - halfWidth, centerY + halfHeight),
  ];
}

export default function PolygonConstructorPage() {
  const [method, setMethod] = useState<PolygonMethod>("free");
  const [vertices, setVertices] = useState<Point[]>([]);
  const [rectangleSize, setRectangleSize] = useState(DEFAULT_RECTANGLE);
  const rectangleDimensions =
    method === "rectangle" && vertices.length === 4
      ? {
          width: Math.abs(vertices[1].x - vertices[0].x),
          height: Math.abs(vertices[3].y - vertices[0].y),
        }
      : rectangleSize;
  const canAddVertex =
    method === "free" || (method === "triangle" && vertices.length < 3);

  function selectMethod(nextMethod: PolygonMethod) {
    if (nextMethod === "voronoi" || nextMethod === "convex-hull" || nextMethod === "alpha-shape") {
      return;
    }

    setMethod(nextMethod);
    if (nextMethod === "rectangle") {
      setVertices(
        createRectangle(rectangleDimensions.width, rectangleDimensions.height),
      );
    } else {
      setVertices([]);
    }
  }

  function addVertex(point: Omit<Point, "id">) {
    if (!canAddVertex) {
      return;
    }

    setVertices((current) => [...current, createPoint(point.x, point.y)]);
  }

  function moveVertex(index: number, point: Omit<Point, "id">) {
    const boundedPoint = {
      x: Math.max(0, Math.min(CANVAS_WIDTH, point.x)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT, point.y)),
    };

    setVertices((current) => {
      if (!current[index]) {
        return current;
      }

      if (method !== "rectangle" || current.length !== 4) {
        return current.map((vertex, vertexIndex) =>
          vertexIndex === index
            ? { ...vertex, x: boundedPoint.x, y: boundedPoint.y }
            : vertex,
        );
      }

      const left =
        index === 0 || index === 3
          ? Math.min(boundedPoint.x, current[1].x - 1)
          : current[0].x;
      const right =
        index === 1 || index === 2
          ? Math.max(boundedPoint.x, current[0].x + 1)
          : current[1].x;
      const top =
        index === 0 || index === 1
          ? Math.min(boundedPoint.y, current[2].y - 1)
          : current[0].y;
      const bottom =
        index === 2 || index === 3
          ? Math.max(boundedPoint.y, current[0].y + 1)
          : current[2].y;
      const rectangle = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ];

      return current.map((vertex, vertexIndex) => ({
        ...vertex,
        ...rectangle[vertexIndex],
      }));
    });
  }

  function changeRectangleDimensions(dimensions: {
    width: number;
    height: number;
  }) {
    const width = Math.max(1, Math.min(CANVAS_WIDTH, dimensions.width));
    const height = Math.max(1, Math.min(CANVAS_HEIGHT, dimensions.height));
    const nextDimensions = { width, height };

    setRectangleSize(nextDimensions);
    if (method === "rectangle") {
      setVertices(createRectangle(width, height));
    }
  }

  function removeVertex(index: number) {
    if (method === "rectangle") {
      setMethod("free");
    }
    setVertices((current) => current.filter((_, vertexIndex) => vertexIndex !== index));
  }

  function clearVertices() {
    setVertices([]);
  }

  return (
    <main className="polygon-app">
      <header className="polygon-header">
        <Link aria-label="SIM-KRIG, volver al inicio" className="brand-mark" href="/">
          <span className="brand-symbol">SK</span>
          <span>SIM<span>-</span>KRIG</span>
        </Link>
        <div className="header-divider" />
        <div className="breadcrumb">
          <span>MÓDULOS</span>
          <span aria-hidden="true">/</span>
          <strong>POLÍGONOS DE INFLUENCIA</strong>
        </div>
        <div className="memory-indicator">
          <span />
          SESIÓN EN MEMORIA
        </div>
      </header>

      <div className="polygon-main">
        <section className="page-intro">
          <div>
            <div className="eyebrow"><span /> MÓDULO 01 · GEOMETRÍA</div>
            <h1>Constructor de Polígonos de Influencia</h1>
            <p>
              Comparación y generación de polígonos para estimación de recursos minerales.
            </p>
          </div>
          <div className="intro-code">
            <span>SIM-KRIG</span>
            <strong>WORKSPACE / 01</strong>
          </div>
        </section>

        <section className="workspace-grid" aria-label="Constructor de polígonos">
          <PolygonToolbar
            canUndo={vertices.length > 0}
            height={rectangleDimensions.height}
            method={method}
            onClear={clearVertices}
            onDimensionsChange={changeRectangleDimensions}
            onMethodChange={selectMethod}
            onUndo={() => setVertices((current) => current.slice(0, -1))}
            vertexCount={vertices.length}
            width={rectangleDimensions.width}
          />

          <div className="workspace-center">
            <PolygonCanvas
              method={method}
              onAddVertex={addVertex}
              onMoveVertex={moveVertex}
              vertices={vertices}
            />
            <div className="canvas-legend">
              <span><i className="legend-vertex" /> VÉRTICE</span>
              <span><i className="legend-edge" /> LÍMITE DEL POLÍGONO</span>
              <span>CUADRÍCULA 50 × 50 m</span>
            </div>
          </div>

          <PolygonInfoPanel
            method={method}
            onMoveVertex={moveVertex}
            onRemoveVertex={removeVertex}
            vertices={vertices}
          />
        </section>

        <footer className="polygon-footer">
          <span>SIM-KRIG <i /> HERRAMIENTA DE DISEÑO GEOMÉTRICO</span>
          <span>DATOS TEMPORALES · NO SE GUARDAN</span>
        </footer>
      </div>
    </main>
  );
}
