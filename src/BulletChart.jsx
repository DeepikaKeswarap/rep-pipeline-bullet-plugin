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

/** Compact number for placeholders (keeps up to 2 decimals for small values). */
function formatStat(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  if (Math.abs(n) < 10 && !Number.isInteger(n)) return String(Math.round(n * 100) / 100);
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

const numInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '4px 6px',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: 12,
};

// Numeric filter operators, mirroring Sigma's numeric condition styles.
const NUMERIC_OPS = [
  { value: 'between', label: 'Between' },
  { value: 'gte', label: '\u2265  Greater than or equal' },
  { value: 'lte', label: '\u2264  Less than or equal' },
  { value: 'eq', label: '=  Equals' },
];

function FunnelIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 2.5h14L9.5 9v4.5l-3 1.5V9L1 2.5z" fill="currentColor" />
    </svg>
  );
}

/** Returns true if a row passes the current filter set (category exclusions
 * AND every active numeric min/max range). Shared by the chart and the panel. */
function rowPasses(row, fields, hidden, ranges) {
  if (hidden.has(String(row.category ?? ''))) return false;
  for (const f of fields) {
    if (f.type !== 'numeric') continue;
    const rng = ranges[f.key];
    if (!rng) continue;
    const op = rng.op || 'between';
    const hasA = rng.a !== '' && rng.a !== null && rng.a !== undefined;
    const hasB = rng.b !== '' && rng.b !== null && rng.b !== undefined;
    if (op === 'between' ? !hasA && !hasB : !hasA) continue;
    const v = row[f.key];
    if (v === null || v === undefined || Number.isNaN(v)) return false;
    const a = Number(rng.a);
    const b = Number(rng.b);
    if (op === 'gte') {
      if (!(v >= a)) return false;
    } else if (op === 'lte') {
      if (!(v <= a)) return false;
    } else if (op === 'eq') {
      if (Math.abs(v - a) > 1e-9) return false;
    } else {
      // between
      if (hasA && v < a) return false;
      if (hasB && v > b) return false;
    }
  }
  return true;
}

/** Top-right filter control that works across any mapped field. Text fields
 * (the category) filter via a checkbox list; numeric fields filter via a
 * min/max range. Purely client-side: it narrows which rows THIS chart draws
 * from the data Sigma already provided — it does not filter the underlying
 * dataset or other workbook elements. */
function DataFilter({ fields, categories, stats, hidden, setHidden, ranges, setRanges }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(fields[0]?.key || 'category');
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

  // Keep the selected field valid if the mapped columns change.
  useEffect(() => {
    if (!fields.some((f) => f.key === selected)) setSelected(fields[0]?.key || 'category');
  }, [fields, selected]);

  const numericActive = (key) => {
    const r = ranges[key];
    if (!r) return false;
    return (r.op || 'between') === 'between' ? r.a !== '' || r.b !== '' : r.a !== '' && r.a != null;
  };
  const activeCount =
    (hidden.size ? 1 : 0) + fields.filter((f) => f.type === 'numeric' && numericActive(f.key)).length;

  const selField = fields.find((f) => f.key === selected) || fields[0];

  const q = query.trim().toLowerCase();
  const shownCats = q ? categories.filter((c) => c.toLowerCase().includes(q)) : categories;

  const toggleCat = (c) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const patchRange = (key, patch) =>
    setRanges((prev) => ({ ...prev, [key]: { op: 'between', a: '', b: '', ...prev[key], ...patch } }));
  const clearRange = (key) =>
    setRanges((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const resetAll = () => {
    setHidden(new Set());
    setRanges({});
  };

  return (
    <div ref={rootRef} style={{ position: 'absolute', top: 2, right: 2, zIndex: 5, fontSize: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Filter data"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          border: '1px solid #d0d0d0',
          borderRadius: 4,
          background: activeCount ? '#eef4ff' : '#fff',
          color: '#333',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <FunnelIcon />
        <span>{activeCount ? `Filter (${activeCount})` : 'Filter'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 0,
            width: 240,
            background: '#fff',
            border: '1px solid #d0d0d0',
            borderRadius: 6,
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            padding: 8,
            zIndex: 6,
          }}
        >
          {/* Field picker */}
          <label style={{ display: 'block', color: '#666', marginBottom: 3 }}>Field</label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setQuery('');
            }}
            style={{ ...numInputStyle, marginBottom: 8 }}
          >
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
                {f.key !== 'category' && numericActive(f.key) ? ' •' : ''}
                {f.key === 'category' && hidden.size ? ' •' : ''}
              </option>
            ))}
          </select>

          {/* Text field -> checkbox list */}
          {selField && selField.type === 'text' && (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                style={{ ...numInputStyle, marginBottom: 6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <button type="button" onClick={() => setHidden(new Set())} style={linkBtnStyle}>
                  Select all
                </button>
                <button type="button" onClick={() => setHidden(new Set(categories))} style={linkBtnStyle}>
                  Clear
                </button>
              </div>
              <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                {shownCats.length === 0 ? (
                  <div style={{ color: '#999', padding: '4px 2px' }}>No matches</div>
                ) : (
                  shownCats.map((c) => (
                    <label
                      key={c}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={!hidden.has(c)} onChange={() => toggleCat(c)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                    </label>
                  ))
                )}
              </div>
            </>
          )}

          {/* Numeric field -> operator + value(s) */}
          {selField && selField.type === 'numeric' && (() => {
            const cur = ranges[selField.key] || { op: 'between', a: '', b: '' };
            const op = cur.op || 'between';
            const st = stats[selField.key];
            return (
              <>
                <label style={{ display: 'block', color: '#666', marginBottom: 3 }}>Condition</label>
                <select
                  value={op}
                  onChange={(e) => patchRange(selField.key, { op: e.target.value })}
                  style={{ ...numInputStyle, marginBottom: 8 }}
                >
                  {NUMERIC_OPS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {op === 'between' ? (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#666', marginBottom: 3 }}>Min</label>
                      <input
                        type="number"
                        value={cur.a ?? ''}
                        onChange={(e) => patchRange(selField.key, { a: e.target.value })}
                        placeholder={st ? formatStat(st.min) : ''}
                        style={numInputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#666', marginBottom: 3 }}>Max</label>
                      <input
                        type="number"
                        value={cur.b ?? ''}
                        onChange={(e) => patchRange(selField.key, { b: e.target.value })}
                        placeholder={st ? formatStat(st.max) : ''}
                        style={numInputStyle}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ display: 'block', color: '#666', marginBottom: 3 }}>Value</label>
                    <input
                      type="number"
                      value={cur.a ?? ''}
                      onChange={(e) => patchRange(selField.key, { a: e.target.value })}
                      placeholder={st ? formatStat(op === 'lte' ? st.max : st.min) : ''}
                      style={numInputStyle}
                    />
                  </div>
                )}

                {st && (
                  <div style={{ color: '#999', marginBottom: 6 }}>
                    Data range: {formatStat(st.min)} – {formatStat(st.max)}
                  </div>
                )}
                <button type="button" onClick={() => clearRange(selField.key)} style={linkBtnStyle}>
                  Clear this field
                </button>
              </>
            );
          })()}

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #eee',
              marginTop: 8,
              paddingTop: 6,
            }}
          >
            <span style={{ color: '#999' }}>
              {activeCount ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active` : 'No filters'}
            </span>
            <button type="button" onClick={resetAll} style={linkBtnStyle} disabled={!activeCount}>
              Reset all
            </button>
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
  filterFields = [],
}) {
  const [containerRef, containerWidth] = useContainerWidth();

  // Client-side filter state: hidden categories + numeric min/max per field.
  const [hidden, setHidden] = useState(() => new Set());
  const [ranges, setRanges] = useState({});

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

  // Min/max per numeric field, for the filter panel's placeholders + hint.
  const stats = useMemo(() => {
    const out = {};
    filterFields
      .filter((f) => f.type === 'numeric')
      .forEach((f) => {
        let mn = Infinity;
        let mx = -Infinity;
        let has = false;
        rows.forEach((r) => {
          const v = r[f.key];
          if (v !== null && v !== undefined && !Number.isNaN(v)) {
            has = true;
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
        });
        out[f.key] = has ? { min: mn, max: mx } : null;
      });
    return out;
  }, [rows, filterFields]);

  const visibleRows = useMemo(
    () => rows.filter((r) => rowPasses(r, filterFields, hidden, ranges)),
    [rows, filterFields, hidden, ranges],
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
      {enableFilter && filterFields.length > 0 && (
        <DataFilter
          fields={filterFields}
          categories={categories}
          stats={stats}
          hidden={hidden}
          setHidden={setHidden}
          ranges={ranges}
          setRanges={setRanges}
        />
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
                <text x={-12} y={rowY + ROW_HEIGHT / 2 + 4} fontSize="12.5" fill="#333" textAnchor="end">
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
                      <text x={x(r.point)} y={rowY - 6} fontSize="10" fill={colors.point} textAnchor="middle" style={{ pointerEvents: 'none' }}>
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
        <div style={{ position: 'absolute', top: MARGIN.top, left: MARGIN.left, color: '#999', fontSize: 12 }}>
          No rows match the current filters.
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
