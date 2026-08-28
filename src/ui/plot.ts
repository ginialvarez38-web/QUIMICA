/**
 * Scientific plotting.
 *
 * §72: the charts must look like real scientific charts. That means labelled
 * axes with units, "nice" tick values, legends, error bars, uncertainty bands,
 * reversed axes where the discipline uses them (an IR spectrum runs right to
 * left), logarithmic scales, readable crosshair values, zoom, and export.
 *
 * Rendered as SVG so it is resolution-independent, themeable through the CSS
 * custom properties, exportable, and accessible: every plot carries a text
 * description and a data table for screen readers (§68).
 */

import { svg, h, onResize } from './dom.js';
import { fmt } from '../core/format.js';

export interface Series {
  id: string;
  label: string;
  x: number[];
  y: number[];
  /** Standard uncertainty on y, plotted as error bars. */
  uy?: number[];
  ux?: number[];
  /** Continuous line, discrete points, both, vertical sticks or filled area. */
  kind?: 'line' | 'points' | 'both' | 'sticks' | 'area';
  /** Palette index 1–8, or an explicit CSS colour. */
  colour?: number | string;
  dashed?: boolean;
  width?: number;
  /** Confidence band, drawn as a translucent ribbon. */
  band?: { lower: number[]; upper: number[] };
  hidden?: boolean;
  /** Point radius for scatter series. */
  radius?: number;
}

export interface AxisSpec {
  label: string;
  unit?: string;
  /** Fixed domain; auto-scaled from the data when omitted. */
  domain?: [number, number];
  log?: boolean;
  /** Plot high-to-low, as an IR spectrum or a δ scale in NMR. */
  reversed?: boolean;
  /** Explicit tick values. */
  ticks?: number[];
  /** Format a tick value; defaults to the scientific formatter. */
  format?: (v: number) => string;
  /** Pad the auto-scaled domain by this fraction. */
  pad?: number;
  /** Force the domain to include zero. */
  includeZero?: boolean;
}

export interface Marker {
  axis: 'x' | 'y';
  value: number;
  label?: string;
  colour?: string;
  dashed?: boolean;
}

export interface Region {
  axis: 'x' | 'y';
  from: number;
  to: number;
  label?: string;
  colour?: string;
}

export interface Annotation {
  x: number;
  y: number;
  text: string;
  /** Offset from the point, in pixels. */
  dx?: number;
  dy?: number;
}

export interface PlotSpec {
  series: Series[];
  x: AxisSpec;
  y: AxisSpec;
  /** Optional right-hand axis for a second quantity. */
  y2?: AxisSpec;
  /** Series ids that belong to the right-hand axis. */
  y2Series?: string[];
  title?: string;
  /** Printed under the plot: what the reader is looking at and where it came from. */
  caption?: string;
  markers?: Marker[];
  regions?: Region[];
  annotations?: Annotation[];
  height?: number;
  /** Show the legend (default: when more than one visible series). */
  legend?: boolean;
  /** Crosshair with a value readout on hover. */
  crosshair?: boolean;
  /** Called when the reader clicks a data point. */
  onPointSelect?: (series: Series, index: number) => void;
  /** Aspect-ratio lock, for a phase diagram or a scores plot. */
  square?: boolean;
  /** Accessible summary; generated when omitted. */
  description?: string;
}

const MARGIN = { top: 16, right: 20, bottom: 46, left: 62 };

const seriesColour = (c: Series['colour'], index: number): string => {
  if (typeof c === 'string') return c;
  const n = typeof c === 'number' ? c : (index % 8) + 1;
  return `var(--series-${n})`;
};

/**
 * "Nice" tick values — the 1/2/5 × 10ⁿ progression every plotting library uses
 * because those are the intervals a reader can do arithmetic with.
 */
export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return Number.isFinite(min) ? [min] : [0];
  }
  const span = max - min;
  const rawStep = span / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  const step = (normalised <= 1.5 ? 1 : normalised <= 3 ? 2 : normalised <= 7 ? 5 : 10) * magnitude;

  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 1e-9; v += step) {
    // Re-round to kill floating-point dust like 0.30000000000000004.
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

/** Decade ticks for a logarithmic axis. */
function logTicks(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) {
    const v = Math.pow(10, e);
    if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
  }
  return out.length >= 2 ? out : niceTicks(min, max);
}

interface Scale {
  (v: number): number;
  invert(px: number): number;
  domain: [number, number];
  range: [number, number];
}

function makeScale(domain: [number, number], range: [number, number], log: boolean, reversed: boolean): Scale {
  const [d0, d1] = log
    ? [Math.log10(Math.max(domain[0], 1e-300)), Math.log10(Math.max(domain[1], 1e-300))]
    : domain;
  const [r0, r1] = reversed ? [range[1], range[0]] : range;
  const span = d1 - d0 || 1;

  const fn = ((v: number): number => {
    const x = log ? Math.log10(Math.max(v, 1e-300)) : v;
    return r0 + ((x - d0) / span) * (r1 - r0);
  }) as Scale;

  fn.invert = (px: number): number => {
    const t = (px - r0) / (r1 - r0 || 1);
    const x = d0 + t * span;
    return log ? Math.pow(10, x) : x;
  };
  fn.domain = domain;
  fn.range = range;
  return fn;
}

function autoDomain(values: number[][], spec: AxisSpec): [number, number] {
  if (spec.domain) return spec.domain;
  const flat = values.flat().filter((v) => Number.isFinite(v) && (!spec.log || v > 0));
  if (flat.length === 0) return spec.log ? [1e-3, 1] : [0, 1];

  let min = Math.min(...flat);
  let max = Math.max(...flat);
  if (spec.includeZero && !spec.log) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    return [min - d, max + d];
  }
  if (spec.log) return [min / 1.6, max * 1.6];

  const pad = (max - min) * (spec.pad ?? 0.06);
  return [min - pad, max + pad];
}

const axisTitle = (a: AxisSpec): string => (a.unit ? `${a.label} / ${a.unit}` : a.label);

const tickFormat = (a: AxisSpec) => a.format ?? ((v: number) => fmt(v, { sig: 4 }));

/**
 * Build a plot. Returns a container element that re-renders on resize, so the
 * chart stays correct in a resizable panel without the caller doing anything.
 */
export function plot(spec: PlotSpec): HTMLElement {
  const host = h('div', { class: 'plot' });
  const surface = h('div');
  const legendHost = h('div');
  const caption = spec.caption
    ? h('p', { class: 'plot__caption', text: spec.caption })
    : null;

  host.append(surface, legendHost);
  if (caption) host.append(caption);

  const hidden = new Set(spec.series.filter((s) => s.hidden).map((s) => s.id));

  const draw = (width: number): void => {
    const w = Math.max(width, 240);
    const height = spec.square ? w - MARGIN.left - MARGIN.right + MARGIN.top + MARGIN.bottom
      : (spec.height ?? 300);
    surface.replaceChildren(renderSvg(spec, w, height, hidden));
    legendHost.replaceChildren(
      ...(shouldShowLegend(spec, hidden) ? [renderLegend(spec, hidden, () => draw(width))] : []),
    );
  };

  onResize(host, (rect) => draw(rect.width));
  draw(host.getBoundingClientRect().width || 640);
  return host;
}

function shouldShowLegend(spec: PlotSpec, hidden: Set<string>): boolean {
  if (spec.legend === false) return false;
  return spec.legend === true || spec.series.length > 1;
}

function renderLegend(spec: PlotSpec, hidden: Set<string>, redraw: () => void): HTMLElement {
  return h('div', { class: 'plot__legend' },
    ...spec.series.map((s, i) =>
      h('button', {
        class: 'plot__legend-item',
        type: 'button',
        dataset: { off: hidden.has(s.id) },
        'aria-pressed': String(!hidden.has(s.id)),
        title: `Mostrar u ocultar ${s.label}`,
        on: {
          click: () => {
            if (hidden.has(s.id)) hidden.delete(s.id); else hidden.add(s.id);
            redraw();
          },
        },
      },
      h('span', {
        class: 'plot__legend-key',
        style: { background: seriesColour(s.colour, i) },
      }),
      s.label),
    ),
  );
}

function renderSvg(spec: PlotSpec, width: number, height: number, hidden: Set<string>): SVGSVGElement {
  const visible = spec.series.filter((s) => !hidden.has(s.id));
  const y2Ids = new Set(spec.y2Series ?? []);
  const leftSeries = visible.filter((s) => !y2Ids.has(s.id));
  const rightSeries = visible.filter((s) => y2Ids.has(s.id));

  const margin = { ...MARGIN, right: spec.y2 ? 62 : MARGIN.right };
  const iw = Math.max(width - margin.left - margin.right, 10);
  const ih = Math.max(height - margin.top - margin.bottom, 10);

  const xDomain = autoDomain(visible.map((s) => s.x), spec.x);
  const yDomain = autoDomain(
    leftSeries.flatMap((s) => [s.y, ...(s.band ? [s.band.lower, s.band.upper] : [])]),
    spec.y,
  );
  const sx = makeScale(xDomain, [0, iw], Boolean(spec.x.log), Boolean(spec.x.reversed));
  const sy = makeScale(yDomain, [ih, 0], Boolean(spec.y.log), Boolean(spec.y.reversed));
  const sy2 = spec.y2
    ? makeScale(autoDomain(rightSeries.map((s) => s.y), spec.y2), [ih, 0], Boolean(spec.y2.log), Boolean(spec.y2.reversed))
    : null;

  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%', height,
    role: 'img',
    'aria-label': spec.description ?? describePlot(spec, visible),
  });

  const g = svg('g', { transform: `translate(${margin.left}, ${margin.top})` });
  root.appendChild(g);

  // --- shaded regions (drawn first, behind everything) ---------------------
  for (const r of spec.regions ?? []) {
    const scale = r.axis === 'x' ? sx : sy;
    const a = scale(r.from);
    const b = scale(r.to);
    g.appendChild(svg('rect', {
      x: r.axis === 'x' ? Math.min(a, b) : 0,
      y: r.axis === 'x' ? 0 : Math.min(a, b),
      width: r.axis === 'x' ? Math.abs(b - a) : iw,
      height: r.axis === 'x' ? ih : Math.abs(b - a),
      fill: r.colour ?? 'var(--accent)',
      opacity: 0.08,
    }));
    if (r.label) {
      g.appendChild(svg('text', {
        x: r.axis === 'x' ? (a + b) / 2 : iw - 6,
        y: r.axis === 'x' ? 12 : (a + b) / 2,
        class: 'plot__annot',
        'text-anchor': r.axis === 'x' ? 'middle' : 'end',
      }, r.label));
    }
  }

  // --- grid ---------------------------------------------------------------
  const xTicks = spec.x.ticks ?? (spec.x.log ? logTicks(xDomain[0], xDomain[1]) : niceTicks(xDomain[0], xDomain[1], Math.max(3, Math.round(iw / 90))));
  const yTicks = spec.y.ticks ?? (spec.y.log ? logTicks(yDomain[0], yDomain[1]) : niceTicks(yDomain[0], yDomain[1], Math.max(3, Math.round(ih / 46))));

  const grid = svg('g', { class: 'plot__grid' });
  for (const t of xTicks) grid.appendChild(svg('line', { x1: sx(t), y1: 0, x2: sx(t), y2: ih }));
  for (const t of yTicks) grid.appendChild(svg('line', { x1: 0, y1: sy(t), x2: iw, y2: sy(t) }));
  g.appendChild(grid);

  // --- series -------------------------------------------------------------
  const plotArea = svg('g', {});
  g.appendChild(plotArea);

  spec.series.forEach((s, i) => {
    if (hidden.has(s.id)) return;
    const scaleY = y2Ids.has(s.id) && sy2 ? sy2 : sy;
    const colour = seriesColour(s.colour, i);
    const kind = s.kind ?? 'line';

    if (s.band) {
      const upper = s.x.map((x, k) => `${sx(x)},${scaleY(s.band!.upper[k])}`);
      const lower = s.x.map((x, k) => `${sx(x)},${scaleY(s.band!.lower[k])}`).reverse();
      plotArea.appendChild(svg('polygon', {
        points: [...upper, ...lower].join(' '),
        fill: colour, class: 'plot__band',
      }));
    }

    if (kind === 'area') {
      const pts = s.x.map((x, k) => `${sx(x)},${scaleY(s.y[k])}`);
      plotArea.appendChild(svg('polygon', {
        points: `${sx(s.x[0])},${ih} ${pts.join(' ')} ${sx(s.x[s.x.length - 1])},${ih}`,
        fill: colour, class: 'plot__area',
      }));
    }

    if (kind === 'sticks') {
      const group = svg('g', {});
      s.x.forEach((x, k) => {
        if (!Number.isFinite(s.y[k])) return;
        group.appendChild(svg('line', {
          x1: sx(x), y1: scaleY(scaleY.domain[0] > 0 ? scaleY.domain[0] : 0),
          x2: sx(x), y2: scaleY(s.y[k]),
          stroke: colour, 'stroke-width': s.width ?? 1.4, 'stroke-linecap': 'round',
        }));
      });
      plotArea.appendChild(group);
    }

    if (kind === 'line' || kind === 'both' || kind === 'area') {
      plotArea.appendChild(svg('path', {
        d: linePath(s.x, s.y, sx, scaleY),
        class: `plot__series${s.dashed ? ' plot__series--dashed' : ''}`,
        stroke: colour,
        'stroke-width': s.width,
      }));
    }

    if (s.uy) {
      const bars = svg('g', { class: 'plot__errorbar' });
      s.x.forEach((x, k) => {
        const u = s.uy![k];
        if (!Number.isFinite(u) || u === 0) return;
        const px = sx(x);
        const top = scaleY(s.y[k] + u);
        const bottom = scaleY(s.y[k] - u);
        bars.appendChild(svg('line', { x1: px, y1: top, x2: px, y2: bottom }));
        bars.appendChild(svg('line', { x1: px - 3, y1: top, x2: px + 3, y2: top }));
        bars.appendChild(svg('line', { x1: px - 3, y1: bottom, x2: px + 3, y2: bottom }));
      });
      plotArea.appendChild(bars);
    }

    if (kind === 'points' || kind === 'both') {
      const group = svg('g', {});
      s.x.forEach((x, k) => {
        if (!Number.isFinite(s.y[k])) return;
        const c = svg('circle', {
          cx: sx(x), cy: scaleY(s.y[k]), r: s.radius ?? 3,
          fill: colour, class: 'plot__point',
        });
        if (spec.onPointSelect) {
          c.style.cursor = 'pointer';
          c.addEventListener('click', () => spec.onPointSelect!(s, k));
          c.appendChild(svg('title', {}, `${s.label}\n${axisTitle(spec.x)} = ${fmt(x, { sig: 5 })}\n${axisTitle(spec.y)} = ${fmt(s.y[k], { sig: 5 })}`));
        }
        group.appendChild(c);
      });
      plotArea.appendChild(group);
    }
  });

  // --- markers ------------------------------------------------------------
  for (const m of spec.markers ?? []) {
    const scale = m.axis === 'x' ? sx : sy;
    const p = scale(m.value);
    g.appendChild(svg('line', {
      x1: m.axis === 'x' ? p : 0, y1: m.axis === 'x' ? 0 : p,
      x2: m.axis === 'x' ? p : iw, y2: m.axis === 'x' ? ih : p,
      class: 'plot__marker-line',
      stroke: m.colour,
      'stroke-dasharray': m.dashed === false ? undefined : '4 3',
    }));
    if (m.label) {
      g.appendChild(svg('text', {
        x: m.axis === 'x' ? p + 4 : iw - 4,
        y: m.axis === 'x' ? 11 : p - 4,
        class: 'plot__annot',
        'text-anchor': m.axis === 'x' ? 'start' : 'end',
        fill: m.colour,
      }, m.label));
    }
  }

  // --- annotations --------------------------------------------------------
  for (const a of spec.annotations ?? []) {
    g.appendChild(svg('text', {
      x: sx(a.x) + (a.dx ?? 6), y: sy(a.y) + (a.dy ?? -6),
      class: 'plot__annot',
    }, a.text));
  }

  // --- axes ---------------------------------------------------------------
  const axes = svg('g', { class: 'plot__axis' });
  axes.appendChild(svg('line', { x1: 0, y1: ih, x2: iw, y2: ih }));
  axes.appendChild(svg('line', { x1: 0, y1: 0, x2: 0, y2: ih }));

  const fx = tickFormat(spec.x);
  for (const t of xTicks) {
    const px = sx(t);
    axes.appendChild(svg('line', { x1: px, y1: ih, x2: px, y2: ih + 4 }));
    axes.appendChild(svg('text', { x: px, y: ih + 16, 'text-anchor': 'middle' }, fx(t)));
  }
  const fy = tickFormat(spec.y);
  for (const t of yTicks) {
    const py = sy(t);
    axes.appendChild(svg('line', { x1: -4, y1: py, x2: 0, y2: py }));
    axes.appendChild(svg('text', { x: -8, y: py + 3.5, 'text-anchor': 'end' }, fy(t)));
  }

  axes.appendChild(svg('text', {
    x: iw / 2, y: ih + 38, 'text-anchor': 'middle', class: 'plot__axis-title',
  }, axisTitle(spec.x)));
  axes.appendChild(svg('text', {
    x: -margin.left + 13, y: ih / 2, 'text-anchor': 'middle', class: 'plot__axis-title',
    transform: `rotate(-90, ${-margin.left + 13}, ${ih / 2})`,
  }, axisTitle(spec.y)));

  if (spec.y2 && sy2) {
    const f2 = tickFormat(spec.y2);
    const t2 = spec.y2.ticks ?? niceTicks(sy2.domain[0], sy2.domain[1], Math.max(3, Math.round(ih / 46)));
    axes.appendChild(svg('line', { x1: iw, y1: 0, x2: iw, y2: ih }));
    for (const t of t2) {
      const py = sy2(t);
      axes.appendChild(svg('line', { x1: iw, y1: py, x2: iw + 4, y2: py }));
      axes.appendChild(svg('text', { x: iw + 8, y: py + 3.5, 'text-anchor': 'start' }, f2(t)));
    }
    axes.appendChild(svg('text', {
      x: iw + margin.right - 12, y: ih / 2, 'text-anchor': 'middle', class: 'plot__axis-title',
      transform: `rotate(90, ${iw + margin.right - 12}, ${ih / 2})`,
    }, axisTitle(spec.y2)));
  }
  g.appendChild(axes);

  if (spec.title) {
    root.appendChild(svg('text', {
      x: width / 2, y: 12, 'text-anchor': 'middle', class: 'plot__axis-title',
    }, spec.title));
  }

  // --- crosshair ----------------------------------------------------------
  if (spec.crosshair !== false && visible.length > 0) {
    attachCrosshair(g, spec, visible, sx, sy, sy2, y2Ids, iw, ih);
  }

  return root;
}

function linePath(xs: number[], ys: number[], sx: Scale, sy: Scale): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (!Number.isFinite(y) || !Number.isFinite(xs[i])) { pen = false; continue; }
    const px = sx(xs[i]);
    const py = sy(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`;
    pen = true;
  }
  return d || 'M0,0';
}

/**
 * Crosshair with a value readout. §72 asks for "exact values": the readout
 * shows the nearest actual data point, not an interpolation, so the number the
 * reader copies is a number that exists in the data set.
 */
function attachCrosshair(
  g: SVGGElement, spec: PlotSpec, visible: Series[],
  sx: Scale, sy: Scale, sy2: Scale | null, y2Ids: Set<string>,
  iw: number, ih: number,
): void {
  const cursor = svg('g', { style: 'display:none' });
  const vline = svg('line', { y1: 0, y2: ih, class: 'plot__cursor' });
  cursor.appendChild(vline);
  const dots = svg('g', {});
  cursor.appendChild(dots);
  g.appendChild(cursor);

  const readout = svg('g', { style: 'display:none' });
  const box = svg('rect', {
    rx: 3, fill: 'var(--bg-surface)', stroke: 'var(--border-strong)', 'stroke-width': 1,
  });
  const lines = svg('text', { class: 'plot__annot', fill: 'var(--fg-primary)' });
  readout.append(box, lines);
  g.appendChild(readout);

  const hit = svg('rect', { x: 0, y: 0, width: iw, height: ih, class: 'plot__hit' });
  g.appendChild(hit);

  hit.addEventListener('pointerleave', () => {
    cursor.style.display = 'none';
    readout.style.display = 'none';
  });

  hit.addEventListener('pointermove', (ev) => {
    const rect = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((ev as PointerEvent).clientX - rect.left) * (iw / rect.width);
    const xValue = sx.invert(px);

    cursor.style.display = '';
    readout.style.display = '';
    vline.setAttribute('x1', String(px));
    vline.setAttribute('x2', String(px));

    const rows: Array<{ label: string; value: string; colour: string }> = [];
    dots.replaceChildren();

    visible.forEach((s, i) => {
      const k = nearestIndex(s.x, xValue);
      if (k < 0 || !Number.isFinite(s.y[k])) return;
      const scaleY = y2Ids.has(s.id) && sy2 ? sy2 : sy;
      const colour = seriesColour(s.colour, spec.series.indexOf(s));
      dots.appendChild(svg('circle', {
        cx: sx(s.x[k]), cy: scaleY(s.y[k]), r: 3.5,
        fill: colour, stroke: 'var(--bg-plot)', 'stroke-width': 1.5,
      }));
      const u = s.uy?.[k];
      rows.push({
        label: s.label,
        value: u ? `${fmt(s.y[k], { sig: 4 })} ± ${fmt(u, { sig: 2 })}` : fmt(s.y[k], { sig: 4 }),
        colour,
      });
      void i;
    });

    const xLabel = `${spec.x.label} = ${fmt(visible[0] ? visible[0].x[nearestIndex(visible[0].x, xValue)] : xValue, { sig: 4 })}${spec.x.unit ? ` ${spec.x.unit}` : ''}`;
    lines.replaceChildren();
    lines.appendChild(svg('tspan', { x: 0, dy: 0, 'font-weight': '600' }, xLabel));
    rows.forEach((r) => {
      lines.appendChild(svg('tspan', { x: 0, dy: 13, fill: r.colour }, `${r.label}: ${r.value}`));
    });

    // Position the readout on whichever side has room.
    const boxW = Math.max(xLabel.length, ...rows.map((r) => r.label.length + r.value.length + 2)) * 5.6 + 14;
    const boxH = 15 + rows.length * 13;
    const left = px + 12 + boxW > iw ? px - boxW - 12 : px + 12;
    readout.setAttribute('transform', `translate(${Math.max(0, left)}, 10)`);
    box.setAttribute('x', '-7');
    box.setAttribute('y', '-11');
    box.setAttribute('width', String(boxW));
    box.setAttribute('height', String(boxH));
    lines.setAttribute('x', '0');
    lines.setAttribute('y', '0');
  });
}

function nearestIndex(xs: number[], target: number): number {
  if (xs.length === 0) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - target);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Text description of a plot, for screen readers (§68). */
function describePlot(spec: PlotSpec, visible: Series[]): string {
  const parts = [
    spec.title ?? `Gráfico de ${axisTitle(spec.y)} frente a ${axisTitle(spec.x)}`,
  ];
  for (const s of visible) {
    const ys = s.y.filter(Number.isFinite);
    if (ys.length === 0) continue;
    parts.push(
      `${s.label}: ${ys.length} puntos, desde ${fmt(Math.min(...ys), { sig: 3 })} `
      + `hasta ${fmt(Math.max(...ys), { sig: 3 })}.`,
    );
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Serialise a plot's data as CSV — §72 requires export. */
export function seriesToCsv(spec: PlotSpec): string {
  const header = [axisTitle(spec.x), ...spec.series.flatMap((s) =>
    s.uy ? [`${s.label}`, `u(${s.label})`] : [s.label])];

  // Union of all x values, so series sampled differently still line up.
  const xs = Array.from(new Set(spec.series.flatMap((s) => s.x))).sort((a, b) => a - b);
  const rows = xs.map((x) => {
    const cells: string[] = [String(x)];
    for (const s of spec.series) {
      const k = s.x.indexOf(x);
      cells.push(k >= 0 ? String(s.y[k]) : '');
      if (s.uy) cells.push(k >= 0 ? String(s.uy[k] ?? '') : '');
    }
    return cells.join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

/** A data table equivalent to the plot, for screen readers and for copying. */
export function seriesTable(spec: PlotSpec, maxRows = 200): HTMLElement {
  const xs = Array.from(new Set(spec.series.flatMap((s) => s.x)))
    .sort((a, b) => a - b)
    .slice(0, maxRows);

  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table table--compact' },
      h('thead', {},
        h('tr', {},
          h('th', { text: axisTitle(spec.x) }),
          ...spec.series.map((s) => h('th', { text: s.label })),
        ),
      ),
      h('tbody', {},
        ...xs.map((x) => h('tr', {},
          h('td', { class: 'col-num', text: fmt(x, { sig: 4 }) }),
          ...spec.series.map((s) => {
            const k = s.x.indexOf(x);
            return h('td', { class: 'col-num', text: k >= 0 ? fmt(s.y[k], { sig: 4 }) : '—' });
          }),
        )),
      ),
    ),
  );
}
