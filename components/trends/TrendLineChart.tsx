"use client";

import { useState, useRef, useCallback } from "react";
import { formatTrendTotal, formatAxisTick } from "@/lib/trends";

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

const AXIS_FONT_SIZE = 10;

function axisLabelStep(labels: string[]): number {
  if (labels.length <= 1) return 1;
  const maxLabelWidth = Math.max(...labels.map((l) => l.length * AXIS_FONT_SIZE * 0.62), 1);
  const minSpacing = maxLabelWidth * 1.15;
  const availableWidth = PLOT_R - PLOT_L;
  const maxTicks = Math.max(1, Math.floor(availableWidth / minSpacing) + 1);
  if (labels.length <= maxTicks) return 1;
  return Math.ceil((labels.length - 1) / (maxTicks - 1));
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  unit?: string;
  area?: boolean;
  defaultSelected?: boolean;
  end?: boolean;
  data: number[];
}

interface TrendLineChartProps {
  labels: string[];
  tipLabels: string[];
  series: ChartSeries[];
}

export default function TrendLineChart({
  labels,
  tipLabels,
  series,
}: TrendLineChartProps) {
  const [selectedKey, setSelectedKey] = useState(
    () => series.find((s) => s.defaultSelected)?.key ?? series[0].key,
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  const dataLen = labels.length;
  const selected = series.find((s) => s.key === selectedKey) ?? series[0];

  const selectSeries = useCallback((key: string) => {
    setSelectedKey(key);
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

  const maxVal = Math.max(...selected.data, 0.01);

  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const y = PLOT_T + ((PLOT_B - PLOT_T) * i) / 4;
    return <line key={i} className="grid" x1={PLOT_L} y1={y} x2={PLOT_R} y2={y} />;
  });

  const yAxisLabels = [0, 1, 2, 3, 4].map((i) => {
    const y = PLOT_T + ((PLOT_B - PLOT_T) * i) / 4;
    const value = maxVal * (1 - i / 4);
    return (
      <text
        key={i}
        className="y-axis-label"
        x={PLOT_L - 6}
        y={y + 3}
        textAnchor="end"
        fill="var(--text-secondary)"
        fontSize={AXIS_FONT_SIZE}
        fontWeight="500"
      >
        {formatAxisTick(selected.unit, value, maxVal)}
      </text>
    );
  });

  const labelStep = axisLabelStep(labels);
  const axisLabels = labels
    .map((label, i) => {
      const show = i === 0 || i === dataLen - 1 || i % labelStep === 0;
      if (!show) return null;
      return (
        <text
          key={i}
          className="axis-label"
          x={xAt(i, dataLen)}
          y="188"
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize={AXIS_FONT_SIZE}
          fontWeight="500"
        >
          {label}
        </text>
      );
    })
    .filter(Boolean);

  const points = selected.data.map((v, i) => ({
    x: xAt(i, dataLen),
    y: yAt(v, maxVal),
  }));

  const seriesElement = (
    <g data-key={selected.key}>
      {selected.area && (
        <path
          className="series-area"
          d={`${linePath(points)} L${PLOT_R},${PLOT_B} L${PLOT_L},${PLOT_B} Z`}
          fill={selected.color}
          fillOpacity={0.14}
        />
      )}
      <path className="series-line" d={linePath(points)} stroke={selected.color} />
      {points.map((p, i) => (
        <circle
          key={i}
          className="dot-marker"
          cx={p.x.toFixed(1)}
          cy={p.y.toFixed(1)}
          r={selected.area ? 2.6 : 2.4}
          fill={selected.color}
        />
      ))}
      {selected.end && (
        <text
          className="end-label"
          x={(PLOT_R + 5).toFixed(1)}
          y={(points[points.length - 1].y + 3.5).toFixed(1)}
          fill={selected.color}
        >
          {formatTrendTotal(selected.unit, selected.data[selected.data.length - 1])}
        </text>
      )}
    </g>
  );

  const hoverElements =
    hoverIdx !== null
      ? (() => {
          const x = xAt(hoverIdx, dataLen);
          const y = yAt(selected.data[hoverIdx], maxVal);
          return (
            <>
              <line
                className="crosshair"
                x1={x}
                y1={PLOT_T}
                x2={x}
                y2={PLOT_B}
              />
              <circle
                className="hover-dot"
                cx={x.toFixed(1)}
                cy={y.toFixed(1)}
                r={3.6}
                fill={selected.color}
              />
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
        <div className="tip-row">
          <span className="dot" style={{ background: selected.color }} />
          {selected.name}
          <span className="tip-val">
            {formatTrendTotal(selected.unit, selected.data[hoverIdx])}
          </span>
        </div>
      </div>
    ) : null;

  return (
    <div>
      <div className="legend" role="radiogroup">
        {series.map((s) => (
          <button
            key={s.key}
            className="chip"
            data-key={s.key}
            role="radio"
            aria-checked={s.key === selectedKey}
            style={{ "--series": s.color } as React.CSSProperties}
            onClick={() => selectSeries(s.key)}
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
          key={selectedKey}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <g className="grid">{gridLines}</g>
          {yAxisLabels}
          {axisLabels}
          {seriesElement}
          <g className="hover-layer">{hoverElements}</g>
        </svg>
        {tooltip}
      </div>
    </div>
  );
}
