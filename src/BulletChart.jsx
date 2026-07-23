import React, { useEffect, useMemo, useRef, useState } from 'react';

const MARGIN = { top: 34, right: 24, bottom: 34, left: 170 };
const ROW_HEIGHT = 56;
const BAR_H = 20;   // both bars share one thickness now
const GAP = 4;

/** Tracks the rendered width of a container element so the chart can fill
 * whatever space Sigma gives the plugin element, and re-flow if the user
 * resizes it (or if a left/right legend narrows the plot area). */
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

/** Picks black or white label text for readability over a given fill color. */
function readableText(hex) {
  if (!hex || typeof hex !== 'string') return '#333';
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
  if (full.length < 6) return '#333';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#333' : '#fff';
}

// Only draw a value inside a segment when it's wide enough to fit legibly.
const MIN_LABEL_WIDTH = 26;

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

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#2b6cb0',
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
};

function FunnelIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 2.5h14L9.5 9v4.5l-3 1.5V9L1 2.5z" fill="currentColor" />
    </svg>
  );
}

/** Top-right category filter. Purely client-side: it narrows which rows this
 * chart draws from the data Sigma already provided. It does NOT filter the
 * underlying dataset or other workbook elements. State is kept as a set of
 * *hidden* categories so newly-arriving categories default to visible. */
function CategoryFilter({ categories, hidden, setHidden }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q ? categories.filter((c) => c.toLowerCase().includes(q)) : categories;
  const visibleCount = categories.length - hidden.size;

  const toggle = (c) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const selectAll = () => setHidden(new Set());
  const clearAll = () => setHidden(new Set(categories));

  return (
    <div ref={rootRef} style={{ position: 'absolute', top: 2, right: 2, zIndex: 5, fontSize: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Filter categories"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          border: '1px solid #d0d0d0',
          borderRadius: 4,
          background: hidden.size ? '#eef4ff' : '#fff',
          color: '#333',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <FunnelIcon />
        <span>{hidden.size ? `Filter (${visibleCount}/${categories.length})` : 'Filter'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 0,
            width: 220,
            background: '#fff',
            border: '1px solid #d0d0d0',
            borderRadius: 6,
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            padding: 8,
            zIndex: 6,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '4px 6px',
              marginBottom: 6,
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <button type="button" onClick={selectAll} style={linkBtnStyle}>Select all</button>
            <button type="button" onClick={clearAll} style={linkBtnStyle}>Clear</button>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {shown.length === 0 ? (
              <div style={{ color: '#999', padding: '4px 2px' }}>No matches</div>
            ) : (
              shown.map((c) => (
                <label
                  key={c}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', cursor: 'pointer' }}
                >
                  <input type="checkbox" checked={!hidden.has(c)} onChange={() => toggle(c)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Series legend. Lays out horizontally (wrapping) for Top/Bottom, and as a
 * vertical stack for Left/Right. */
function Legend({ items, position }) {
  const vertical = position === 'Left' || position === 'Right';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        flexWrap: vertical ? 'nowrap' : 'wrap',
        gap: vertical ? '6px' : '8px 18px',
        alignContent: 'flex-start',
        fontSize: 12,
        color: '#333',
        ...(vertical ? { paddingTop: MARGIN.top } : {}),
      }}
    >
      {items.map((it) => (
        <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              background: it.color,
              borderRadius: it.shape === 'circle' ? '50%' : 2,
              display: 'inline-block',
              flex: '0 0 auto',
            }}
          />
          <span style={{ whiteSpace: 'nowrap' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function BulletChart({
  rows,
  title,
  colors,
  labels,
  showDataLabels,
  showLegend,
  legendItems = [],
  legendPosition = 'Bottom',
  enableFilter = true,
}) {
  const [containerRef, containerWidth] = useContainerWidth();

  // Client-side category filter state: the set of categories to hide.
  const [hidden, setHidden] = useState(() => new Set());

  const categories = useMemo(() => {
    const seen = [];
    const set = new Set();
    rows.forEach((r) => {
      const c = String(r.category ?? '');
      if (!set.has(c)) {
        set.add(c);
        seen.push(c);
      }
    });
    return seen;
  }, [rows]);

  const visibleRows = useMemo(
    () => (hidden.size ? rows.filter((r) => !hidden.has(String(r.category ?? ''))) : rows),
    [rows, hidden],
  );

  const maxValue = useMemo(() => {
    let m = 0;
    visibleRows.forEach((r) => {
      m = Math.max(m, r.bar1a + r.bar1b, r.bar2a + r.bar2b, r.point || 0);
    });
    return m || 1;
  }, [visibleRows]);

  const ticks = useMemo(() => niceTicks(maxValue), [maxValue]);
  const scaleMax = ticks[ticks.length - 1] || maxValue;

  const chartWidth = Math.max(containerWidth - MARGIN.left - MARGIN.right, 50);
  const chartHeight = Math.max(visibleRows.length, 1) * ROW_HEIGHT;
  const totalHeight = chartHeight + MARGIN.top + MARGIN.bottom;

  const x = (v) => (v / scaleMax) * chartWidth;

  const showLegendNow = showLegend && legendItems.length > 0;
  const vertical = legendPosition === 'Left' || legendPosition === 'Right';
  const legendFirst = legendPosition === 'Top' || legendPosition === 'Left';
  const legendEl = showLegendNow ? <Legend items={legendItems} position={legendPosition} /> : null;

  const chartArea = (
    <div ref={containerRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
      {enableFilter && categories.length > 0 && (
        <CategoryFilter categories={categories} hidden={hidden} setHidden={setHidden} />
      )}

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

          {visibleRows.map((r, i) => {
            const rowY = i * ROW_HEIGHT;
            const thinY = rowY + 8;
            const thickY = thinY + BAR_H + GAP;
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

                {/* Bar 1: stacked bar (two segments) */}
                <rect x={0} y={thinY} width={bar1aW} height={BAR_H} fill={colors.bar1a} rx="1.5">
                  <title>{`${labels.bar1a}: ${formatNumber(r.bar1a)}`}</title>
                </rect>
                <rect x={bar1aW} y={thinY} width={bar1bW} height={BAR_H} fill={colors.bar1b} rx="1.5">
                  <title>{`${labels.bar1b}: ${formatNumber(r.bar1b)}`}</title>
                </rect>

                {/* Bar 2: stacked bar (two segments) */}
                <rect x={0} y={thickY} width={bar2aW} height={BAR_H} fill={colors.bar2a} rx="2">
                  <title>{`${labels.bar2a}: ${formatNumber(r.bar2a)}`}</title>
                </rect>
                <rect x={bar2aW} y={thickY} width={bar2bW} height={BAR_H} fill={colors.bar2b} rx="2">
                  <title>{`${labels.bar2b}: ${formatNumber(r.bar2b)}`}</title>
                </rect>

                {/* Data labels: value centered in each segment wide enough to hold it */}
                {showDataLabels && (
                  <g fontSize="10" style={{ pointerEvents: 'none' }}>
                    {bar1aW >= MIN_LABEL_WIDTH && (
                      <text x={bar1aW / 2} y={thinY + BAR_H / 2 + 3.5} fill={readableText(colors.bar1a)} textAnchor="middle">
                        {formatNumber(r.bar1a)}
                      </text>
                    )}
                    {bar1bW >= MIN_LABEL_WIDTH && (
                      <text x={bar1aW + bar1bW / 2} y={thinY + BAR_H / 2 + 3.5} fill={readableText(colors.bar1b)} textAnchor="middle">
                        {formatNumber(r.bar1b)}
                      </text>
                    )}
                    {bar2aW >= MIN_LABEL_WIDTH && (
                      <text x={bar2aW / 2} y={thickY + BAR_H / 2 + 3.5} fill={readableText(colors.bar2a)} textAnchor="middle">
                        {formatNumber(r.bar2a)}
                      </text>
                    )}
                    {bar2bW >= MIN_LABEL_WIDTH && (
                      <text x={bar2aW + bar2bW / 2} y={thickY + BAR_H / 2 + 3.5} fill={readableText(colors.bar2b)} textAnchor="middle">
                        {formatNumber(r.bar2b)}
                      </text>
                    )}
                  </g>
                )}

                {/* Point marker, plotted independently on the same x-scale */}
                {r.point !== null && (
                  <>
                    <circle cx={x(r.point)} cy={rowY + 2} r="6" fill={colors.point} stroke="#fff" strokeWidth="1.5">
                      <title>{`${labels.point}: ${formatNumber(r.point)}`}</title>
                    </circle>
                    {showDataLabels && (
                      <text
                        x={x(r.point)}
                        y={rowY - 6}
                        fontSize="10"
                        fill={colors.point}
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {formatNumber(r.point)}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {visibleRows.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: MARGIN.top,
            left: MARGIN.left,
            color: '#999',
            fontSize: 12,
          }}
        >
          All categories are filtered out.
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'row' : 'column',
        gap: 10,
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      {showLegendNow && legendFirst && legendEl}
      {chartArea}
      {showLegendNow && !legendFirst && legendEl}
    </div>
  );
}
