/**
 * One chart theme for the product.
 *
 * The five Analytics charts each carried their own colours — six unrelated
 * palettes, none of them brand — on top of Recharts' light-mode defaults. The
 * primary "Historical Score" line was `#294036` on a `#0F1113` card, roughly
 * 1.5:1, and the gridlines were `#e7e5e4`: a near-white lattice drawn across a
 * near-black panel, louder than the data on top of it.
 *
 * The categorical slots are validated as a set against the `#0D0F11` chart
 * surface (OKLab ΔE, all pairs): worst CVD pair 11.8, worst normal-vision pair
 * 21.2, every slot inside the dark lightness band and above 3:1 on the surface.
 * `SERIES[0]` is a deeper step of the brand gold than the UI's `#C9A227`, which
 * sits above the band and would read as the brightest thing on the page.
 *
 * Assign slots in fixed order and never cycle them — a filter that drops a
 * series must not repaint the ones that remain.
 */

export const SERIES = ['#B38D1C', '#3987e5', '#d55181'] as const;

/** The muted step used for a "previous period" or baseline comparison. */
export const SERIES_MUTED = 'rgba(255,255,255,0.16)';

export const CHART_SURFACE = '#0D0F11';

/** Grid and axes stay recessive — they orient, they are not the data. */
export const GRID_STROKE = 'rgba(255,255,255,0.07)';
export const AXIS_TICK = { fill: '#6E747A', fontSize: 12 };

/** Bar/area hover band. */
export const CURSOR_FILL = 'rgba(255,255,255,0.04)';

export const TOOLTIP_STYLE = {
  backgroundColor: '#0D0F11',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
  color: '#E6E8EA',
  fontSize: '12.5px',
} as const;

export const TOOLTIP_LABEL_STYLE = { color: '#9BA1A6', marginBottom: 4 } as const;

export const TOOLTIP_ITEM_STYLE = { color: '#E6E8EA' } as const;

export const LEGEND_STYLE = { fontSize: '12.5px', color: '#9BA1A6' } as const;

/** Shared props, so a new chart cannot quietly reintroduce the light defaults. */
export const gridProps = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: GRID_STROKE,
} as const;

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
} as const;

export const tooltipProps = {
  contentStyle: TOOLTIP_STYLE,
  labelStyle: TOOLTIP_LABEL_STYLE,
  itemStyle: TOOLTIP_ITEM_STYLE,
  cursor: { fill: CURSOR_FILL, stroke: 'rgba(255,255,255,0.15)' },
} as const;
