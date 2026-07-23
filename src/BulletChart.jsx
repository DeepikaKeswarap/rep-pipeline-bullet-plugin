import React, { useEffect, useMemo, useRef, useState } from 'react';

const MARGIN = { top: 34, right: 24, bottom: 34, left: 170 };
const ROW_HEIGHT = 56;
const THIN_H = 13;
const THICK_H = 26;
const GAP = 4;

/** Tracks the rendered width of a container element so the chart can fill
 * whatever space Sigma gives the plugin element, and re-flow if the user
 * resizes it. */
function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

/** Picks a "nice" round step for axis ticks (1/2/5/10 x a power of ten). */
function niceTicks(max, targetCount = 6) {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  let step;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;
  else step = magnitude;

  const ticks = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(Math.round(t));
  return ticks;
}

export default function BulletChart({ rows, title, colors, labels }) {
  const [containerRef, containerWidth] = useContainerWidth();

  const maxValue = useMemo(() => {
    let m = 0;
    rows.forEach((r) => {
      m = Math.max(m, r.bar1a + r.bar1b, r.bar2a + r.bar2b, r.point || 0);
    });
    return m || 1;
  }, [rows]);

  const ticks = useMemo(() => niceTicks(maxValue), [maxValue]);
  const scaleMax = ticks[ticks.length - 1] || maxValue;

  const chartWidth = Math.max(containerWidth - MARGIN.left - MARGIN.right, 50);
  const chartHeight = Math.max(rows.length, 1) * ROW_HEIGHT;
  const totalHeight = chartHeight + MARGIN.top + MARGIN.bottom;

  const x = (v) => (v / scaleMax) * chartWidth;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width={containerWidth} height={totalHeight}>
        {title ? (
          <text x={0} y={20} fontSize="15" fontWeight="600" fill="#333">
            {title}
          </text>
        ) : null}

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={chartHeight} stroke="#ececec" strokeWidth="1" />
              <text x={x(t)} y={chartHeight + 18} fontSize="11" fill="#8a8a8a" textAnchor="middle">
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {rows.map((r, i) => {
            const rowY = i * ROW_HEIGHT;
            const thinY = rowY + 8;
            const thickY = thinY + THIN_H + GAP;
            const bar1aW = x(r.bar1a);
            const bar1bW = Math.max(x(r.bar1a + r.bar1b) - bar1aW, 0);
            const bar2aW = x(r.bar2a);
            const bar2bW = Math.max(x(r.bar2a + r.bar2b) - bar2aW, 0);

            return (
              <g key={`${r.category}-${i}`}>
                <text
                  x={-12}
                  y={rowY + ROW_HEIGHT / 2 + 4}
                  fontSize="12.5"
                  fill="#333"
                  textAnchor="end"
                >
                  {r.category}
                </text>

                {/* Bar 1: thin stacked bar (two segments) */}
                <rect x={0} y={thinY} width={bar1aW} height={THIN_H} fill={colors.bar1a} rx="1.5">
                  <title>{`${labels.bar1a}: ${formatNumber(r.bar1a)}`}</title>
                </rect>
                <rect x={bar1aW} y={thinY} width={bar1bW} height={THIN_H} fill={colors.bar1b} rx="1.5">
                  <title>{`${labels.bar1b}: ${formatNumber(r.bar1b)}`}</title>
                </rect>

                {/* Bar 2: thick stacked bar (two segments) */}
                <rect x={0} y={thickY} width={bar2aW} height={THICK_H} fill={colors.bar2a} rx="2">
                  <title>{`${labels.bar2a}: ${formatNumber(r.bar2a)}`}</title>
                </rect>
                <rect x={bar2aW} y={thickY} width={bar2bW} height={THICK_H} fill={colors.bar2b} rx="2">
                  <title>{`${labels.bar2b}: ${formatNumber(r.bar2b)}`}</title>
                </rect>

                {/* Point marker, plotted independently on the same x-scale */}
                {r.point !== null && (
                  <circle cx={x(r.point)} cy={rowY + 2} r="6" fill={colors.point} stroke="#fff" strokeWidth="1.5">
                    <title>{`${labels.point}: ${formatNumber(r.point)}`}</title>
                  </circle>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
