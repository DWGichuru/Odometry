"use client";

import { useState, useRef, useCallback } from "react";
import { formatTrendTotal } from "@/lib/trends";

const PLOT_L = 34;
const PLOT_R = 356;
const PLOT_T = 16;
const PLOT_B = 170;
const VIEW_W = 430;
const VIEW_H = 200;

function xAt(i: number, count: number): number {
  if (count <= 1) return (PLOT_L + PLOT_R) / 2;
  return PLOT_L + (PLOT_R - PLOT_L) * (i / (count - 1));
}

function yAt(v: number, max: number): number {
  if (max === 0) return PLOT_B;
  return PLOT_B - (PLOT_B - PLOT_T) * (v / max);
}

function linePath(pts: { x: number; y: number }[]): string {
  return pts
    .map((p, i) => (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`))
    .join(" ");
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  unit?: string;
  area?: boolean;
  on: boolean;
  end?: boolean;
  data: number[];
}

interface TrendLineChartProps {
  labels: string[];
  tipLabels: string[];
  series: ChartSeries[];
  sharedMax?: number;
}

export default function TrendLineChart({
  labels,
  tipLabels,
  series: initialSeries,
  sharedMax,
}: TrendLineChartProps) {
  const [series, setSeries] = useState(initialSeries);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  const dataLen = labels.length;

  const toggleSeries = useCallback((key: string) => {
    setSeries((prev) =>
      prev.map((s) => (s.key === key ? { ...s, on: !s.on } : s)),
    );
    setHoverIdx(null);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const idx = Math.max(
        0,
        Math.min(
          dataLen - 1,
          Math.round(
            ((sx - PLOT_L) / (PLOT_R - PLOT_L)) * (dataLen - 1),
          ),
        ),
      );
      setHoverIdx(idx);
    },
    [dataLen],
  );

  const handlePointerLeave = useCallback(() => {
    setHoverIdx(null);
  }, []);

  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const y = PLOT_T + ((PLOT_B - PLOT_T) * i) / 4;
    return <line key={i} className="grid" x1={PLOT_L} y1={y} x2={PLOT_R} y2={y} />;
  });

  const axisLabels = labels.map((label, i) => (
    <text
      key={i}
      className="axis-label"
      x={xAt(i, dataLen)}
      y="188"
      textAnchor="middle"
      fill="var(--text-secondary)"
      fontSize="10"
      fontWeight="500"
    >
      {label}
    </text>
  ));

  const seriesElements = series.map((s) => {
    const maxVal = sharedMax ?? Math.max(...s.data, 0.01);
    const pts = s.data.map((v, i) => ({
      x: xAt(i, dataLen),
      y: yAt(v, maxVal),
    }));

    return (
      <g key={s.key} data-key={s.key} className={s.on ? "" : "series-off"}>
        {s.area && (
          <path
            className="series-area"
            d={`${linePath(pts)} L${PLOT_R},${PLOT_B} L${PLOT_L},${PLOT_B} Z`}
            fill={s.color}
            fillOpacity={0.14}
          />
        )}
        <path
          className="series-line"
          d={linePath(pts)}
          stroke={s.color}
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            className="dot-marker"
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={s.area ? 2.6 : 2.4}
            fill={s.color}
          />
        ))}
        {s.end && (
          <text
            className="end-label"
            x={(PLOT_R + 5).toFixed(1)}
            y={(pts[pts.length - 1].y + 3.5).toFixed(1)}
            fill={s.color}
          >
            {formatTrendTotal(s.unit, s.data[s.data.length - 1])}
          </text>
        )}
      </g>
    );
  });

  const hoverElements =
    hoverIdx !== null
      ? (() => {
          const x = xAt(hoverIdx, dataLen);
          const dots = series
            .filter((s) => s.on)
            .map((s) => {
              const maxVal = sharedMax ?? Math.max(...s.data, 0.01);
              const y = yAt(s.data[hoverIdx], maxVal);
              return (
                <circle
                  key={s.key}
                  className="hover-dot"
                  cx={x.toFixed(1)}
                  cy={y.toFixed(1)}
                  r={3.6}
                  fill={s.color}
                />
              );
            });
          return (
            <>
              <line
                className="crosshair"
                x1={x}
                y1={PLOT_T}
                x2={x}
                y2={PLOT_B}
              />
              {dots}
            </>
          );
        })()
      : null;

  const tooltip =
    hoverIdx !== null ? (
      <div
        className={`chart-tip${hoverIdx !== null ? " show" : ""}`}
        style={{
          left: `${(xAt(hoverIdx, dataLen) / VIEW_W) * 100}%`,
          transform: `translateX(${hoverIdx / (dataLen - 1) > 0.72 ? "-92%" : hoverIdx / (dataLen - 1) < 0.28 ? "-8%" : "-50%"})`,
        }}
      >
        <div className="tip-period">{tipLabels[hoverIdx]}</div>
        {series
          .filter((s) => s.on)
          .map((s) => (
            <div key={s.key} className="tip-row">
              <span
                className="dot"
                style={{ background: s.color }}
              />
              {s.name}
              <span className="tip-val">
                {formatTrendTotal(s.unit, s.data[hoverIdx])}
              </span>
            </div>
          ))}
      </div>
    ) : null;

  return (
    <div>
      <div className="legend">
        {series.map((s) => (
          <button
            key={s.key}
            className="chip"
            data-key={s.key}
            aria-pressed={s.on}
            style={{ "--series": s.color } as React.CSSProperties}
            onClick={() => toggleSeries(s.key)}
            type="button"
          >
            <span className="dot" />
            {s.name}{" "}
            <span className="chip-val">
              {formatTrendTotal(s.unit, s.data[s.data.length - 1])}
            </span>
          </button>
        ))}
      </div>
      <div className="chart" ref={svgRef}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <g className="grid">{gridLines}</g>
          {axisLabels}
          {seriesElements}
          <g className="hover-layer">{hoverElements}</g>
        </svg>
        {tooltip}
      </div>
    </div>
  );
}
