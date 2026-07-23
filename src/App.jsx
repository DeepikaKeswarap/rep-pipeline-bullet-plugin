import React, { useEffect, useMemo } from 'react';
import {
  useEditorPanelConfig,
  useConfig,
  useElementColumns,
  useElementData,
  useLoadingState,
} from '@sigmacomputing/plugin';
import BulletChart from './BulletChart';

// Editor panel definition. This is what shows up in the right-hand panel
// in Sigma when a user selects this plugin element and clicks around.
//
// - "source" lets the user pick which data element (table) in the workbook
//   to read from.
// - "category", "bar1a"/"bar1b", "bar2a"/"bar2b", and "point" are column
//   pickers scoped to that source element.
// - The color pickers are optional and fall back to sensible defaults.
const CONFIG = [
  { name: 'source', type: 'element', label: 'Data source' },
  {
    name: 'category',
    type: 'column',
    label: 'Category (e.g. Rep name)',
    source: 'source',
    allowMultiple: false,
  },
  {
    name: 'bar1a',
    type: 'column',
    label: 'Bar 1 – Segment A value',
    source: 'source',
    allowMultiple: false,
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'bar1b',
    type: 'column',
    label: 'Bar 1 – Segment B value',
    source: 'source',
    allowMultiple: false,
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'bar2a',
    type: 'column',
    label: 'Bar 2 – Segment A value',
    source: 'source',
    allowMultiple: false,
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'bar2b',
    type: 'column',
    label: 'Bar 2 – Segment B value',
    source: 'source',
    allowMultiple: false,
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'point',
    type: 'column',
    label: 'Point marker value',
    source: 'source',
    allowMultiple: false,
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'title',
    type: 'text',
    label: 'Chart title',
    defaultValue: 'Rep Pipeline vs Target',
  },
  {
    name: 'sortBy',
    type: 'dropdown',
    label: 'Sort by',
    values: [
      'None',
      'Category',
      'Bar 1 – Segment A',
      'Bar 1 – Segment B',
      'Bar 2 – Segment A',
      'Bar 2 – Segment B',
      'Point marker',
    ],
    defaultValue: 'None',
  },
  {
    name: 'sortDir',
    type: 'dropdown',
    label: 'Sort direction',
    values: ['Descending', 'Ascending'],
    defaultValue: 'Descending',
  },
  {
    name: 'showDataLabels',
    type: 'toggle',
    label: 'Show data labels',
    defaultValue: false,
  },
  { name: 'bar1aColor', type: 'color', label: 'Bar 1 – Segment A color' },
  { name: 'bar1bColor', type: 'color', label: 'Bar 1 – Segment B color' },
  { name: 'bar2aColor', type: 'color', label: 'Bar 2 – Segment A color' },
  { name: 'bar2bColor', type: 'color', label: 'Bar 2 – Segment B color' },
  { name: 'pointColor', type: 'color', label: 'Point marker color' },
];

const DEFAULT_COLORS = {
  bar1a: '#34C796',
  bar1b: '#D9D9D9',
  bar2a: '#0B2D6B',
  bar2b: '#F16A6A',
  point: '#F5821F',
};

export default function App() {
  useEditorPanelConfig(CONFIG);
  const [, setLoading] = useLoadingState(true);

  const source = useConfig('source');
  const categoryCol = useConfig('category');
  const bar1aCol = useConfig('bar1a');
  const bar1bCol = useConfig('bar1b');
  const bar2aCol = useConfig('bar2a');
  const bar2bCol = useConfig('bar2b');
  const pointCol = useConfig('point');
  const title = useConfig('title');
  const sortBy = useConfig('sortBy');
  const sortDir = useConfig('sortDir');
  const showDataLabels = useConfig('showDataLabels');

  const bar1aColor = useConfig('bar1aColor');
  const bar1bColor = useConfig('bar1bColor');
  const bar2aColor = useConfig('bar2aColor');
  const bar2bColor = useConfig('bar2bColor');
  const pointColor = useConfig('pointColor');

  const columns = useElementColumns(source);
  const data = useElementData(source);

  useEffect(() => {
    // Tell Sigma we're done loading once we've got a data payload (or once
    // we know there's nothing to load because no source is picked yet).
    if (data || !source) setLoading(false);
  }, [data, source, setLoading]);

  const rows = useMemo(() => {
    if (!data || !categoryCol) return [];
    const catArr = data[categoryCol] || [];
    const n = catArr.length;
    const get = (colId) => (colId ? data[colId] || [] : []);
    const a1 = get(bar1aCol);
    const b1 = get(bar1bCol);
    const a2 = get(bar2aCol);
    const b2 = get(bar2bCol);
    const p = get(pointCol);

    return Array.from({ length: n }, (_, i) => ({
      category: catArr[i],
      bar1a: Number(a1[i]) || 0,
      bar1b: Number(b1[i]) || 0,
      bar2a: Number(a2[i]) || 0,
      bar2b: Number(b2[i]) || 0,
      point: p[i] !== undefined && p[i] !== null && p[i] !== '' ? Number(p[i]) : null,
    }));
  }, [data, categoryCol, bar1aCol, bar1bCol, bar2aCol, bar2bCol, pointCol]);

  // Maps the human-readable "Sort by" dropdown choices onto row field keys.
  const SORT_FIELD = {
    Category: 'category',
    'Bar 1 – Segment A': 'bar1a',
    'Bar 1 – Segment B': 'bar1b',
    'Bar 2 – Segment A': 'bar2a',
    'Bar 2 – Segment B': 'bar2b',
    'Point marker': 'point',
  };

  const sortedRows = useMemo(() => {
    const field = SORT_FIELD[sortBy];
    if (!field) return rows;
    const dir = sortDir === 'Ascending' ? 1 : -1;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (field === 'category') {
        return dir * String(a.category ?? '').localeCompare(String(b.category ?? ''));
      }
      // Nulls / non-numbers sort to the bottom regardless of direction.
      const av = a[field] === null || a[field] === undefined || Number.isNaN(a[field]) ? -Infinity : a[field];
      const bv = b[field] === null || b[field] === undefined || Number.isNaN(b[field]) ? -Infinity : b[field];
      return dir * (av - bv);
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  const labels = useMemo(
    () => ({
      bar1a: columns?.[bar1aCol]?.name || 'Bar 1 – Segment A',
      bar1b: columns?.[bar1bCol]?.name || 'Bar 1 – Segment B',
      bar2a: columns?.[bar2aCol]?.name || 'Bar 2 – Segment A',
      bar2b: columns?.[bar2bCol]?.name || 'Bar 2 – Segment B',
      point: columns?.[pointCol]?.name || 'Point marker',
      category: columns?.[categoryCol]?.name || 'Category',
    }),
    [columns, bar1aCol, bar1bCol, bar2aCol, bar2bCol, pointCol, categoryCol],
  );

  const colors = {
    bar1a: bar1aColor || DEFAULT_COLORS.bar1a,
    bar1b: bar1bColor || DEFAULT_COLORS.bar1b,
    bar2a: bar2aColor || DEFAULT_COLORS.bar2a,
    bar2b: bar2bColor || DEFAULT_COLORS.bar2b,
    point: pointColor || DEFAULT_COLORS.point,
  };

  if (!source || !categoryCol) {
    return (
      <div className="empty-state">
        Select a data source and a category column in the editor panel to get
        started, then add at least one bar or point measure. →
      </div>
    );
  }

  return (
    <BulletChart
      rows={sortedRows}
      title={title}
      colors={colors}
      labels={labels}
      showDataLabels={showDataLabels}
    />
  );
}
