/**
 * Numeric presentation for scientific readouts.
 *
 * Rules enforced here:
 *  - Significant figures follow the uncertainty, not an arbitrary decimal count.
 *  - Uncertainty is quoted to one or two significant figures (GUM convention),
 *    and the value is rounded to the same decimal place.
 *  - Scientific notation is used outside a readable decade window, with a real
 *    superscript exponent rather than "e-7".
 *  - Nothing is ever silently rounded to look nicer than it is.
 */

import type { Measurement } from './uncertainty.js';
import { unitLabel } from './units.js';

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '',
};

export const superscript = (s: string | number): string =>
  String(s).split('').map((c) => SUPER[c] ?? c).join('');

/** Order of magnitude, floor(log10|x|). Returns 0 for x = 0. */
export function magnitude(x: number): number {
  if (x === 0 || !Number.isFinite(x)) return 0;
  return Math.floor(Math.log10(Math.abs(x)));
}

/** Round x to n significant figures. */
export function sigRound(x: number, n: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const d = Math.ceil(Math.log10(Math.abs(x)));
  const power = n - d;
  const mag = Math.pow(10, power);
  return Math.round(x * mag) / mag;
}

/** Number of significant digits implied by a decimal string. */
export function sigFigs(s: string): number {
  const cleaned = s.replace(/[^0-9.eE+-]/g, '').split(/[eE]/)[0];
  const digits = cleaned.replace(/[-+.]/g, '');
  const trimmed = digits.replace(/^0+/, '');
  if (trimmed === '') return 0;
  return cleaned.includes('.') ? trimmed.length : trimmed.replace(/0+$/, '').length;
}

export interface FormatOptions {
  /** Significant figures. Ignored when an uncertainty drives the rounding. */
  sig?: number;
  /** Force scientific notation on/off. Auto by default. */
  sci?: boolean;
  /** Decade window inside which plain decimal notation is used. */
  window?: [number, number];
  /** Thin-space thousands separators for long integers. */
  group?: boolean;
}

/**
 * Format a bare number for a scientific readout.
 * Returns plain text; `formatHtml` produces the marked-up form.
 */
export function fmt(x: number, opts: FormatOptions = {}): string {
  if (Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  if (x === 0) return '0';

  const sig = opts.sig ?? 4;
  const [lo, hi] = opts.window ?? [-3, 5];
  const m = magnitude(x);
  const useSci = opts.sci ?? (m < lo || m > hi);

  if (useSci) {
    const mant = x / Math.pow(10, m);
    const mantStr = trimZeros(mant.toFixed(Math.max(sig - 1, 0)));
    return `${mantStr}×10${superscript(m)}`;
  }

  const decimals = Math.max(0, Math.min(12, sig - 1 - m));
  let s = x.toFixed(decimals);
  if (s.includes('.')) s = trimZeros(s);
  if (opts.group) s = groupDigits(s);
  return s.replace('-', '−');
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

function groupDigits(s: string): string {
  const [int, frac] = s.split('.');
  const sign = int.startsWith('-') || int.startsWith('−') ? int[0] : '';
  const body = sign ? int.slice(1) : int;
  const grouped = body.length > 4 ? body.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : body;
  return sign + grouped + (frac ? '.' + frac : '');
}

/**
 * Format a value with its uncertainty in the concise parenthetical form used
 * by every metrology table:  1.2345(12) means 1.2345 ± 0.0012.
 */
export function fmtWithU(m: Measurement, opts: { style?: 'paren' | 'plusminus'; k?: number } = {}): string {
  const style = opts.style ?? 'paren';
  const k = opts.k ?? 1;
  const U = m.u * k;

  if (!Number.isFinite(m.value)) return fmt(m.value);
  if (!(U > 0) || !Number.isFinite(U)) return fmt(m.value, { sig: 5 });

  // Uncertainty gets 2 sig figs when its leading digit is 1 or 2, else 1.
  const uMag = magnitude(U);
  const lead = Math.floor(U / Math.pow(10, uMag));
  const uSig = lead <= 2 ? 2 : 1;
  const decimals = Math.max(0, uSig - 1 - uMag);

  const vMag = magnitude(m.value);
  const sci = vMag < -3 || vMag > 5;

  if (sci) {
    const scaleP = Math.pow(10, vMag);
    const v = m.value / scaleP;
    const u = U / scaleP;
    const d = Math.max(0, decimals + vMag);
    const vs = v.toFixed(d);
    const us = u.toFixed(d);
    return style === 'paren'
      ? `${vs}(${us.replace(/[0.]*/, '') || us})×10${superscript(vMag)}`
      : `(${vs} ± ${us})×10${superscript(vMag)}`;
  }

  const vs = m.value.toFixed(decimals).replace('-', '−');
  const us = U.toFixed(decimals);

  if (style === 'plusminus') return `${vs} ± ${us}`;

  // Parenthetical form: the digits of U aligned with the last digits of the value.
  const uDigits = us.replace('.', '').replace(/^0+/, '') || '0';
  return `${vs}(${uDigits})`;
}

/** "value ± U unit" with the unit rendered typographically. */
export function fmtMeasurement(m: Measurement, opts: { k?: number; style?: 'paren' | 'plusminus' } = {}): string {
  const body = fmtWithU(m, { style: opts.style ?? 'plusminus', k: opts.k });
  const u = unitLabel(m.unit);
  return u ? `${body} ${u}` : body;
}

/**
 * pH-style quantity: fixed decimals, because the meaningful resolution of a
 * logarithmic scale is set by the instrument, not by significant figures.
 */
export const fmtP = (x: number, decimals = 2): string =>
  Number.isFinite(x) ? x.toFixed(decimals).replace('-', '−') : '—';

/** Percentage with sensible precision for composition tables. */
export function fmtPercent(fraction: number, decimals = 1): string {
  if (!Number.isFinite(fraction)) return '—';
  const p = fraction * 100;
  if (p > 0 && p < Math.pow(10, -decimals)) return `<${Math.pow(10, -decimals).toFixed(decimals)} %`;
  return `${p.toFixed(decimals)} %`;
}

/** Duration in laboratory-readable form. */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 90) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const min = seconds / 60;
  if (min < 90) return `${min.toFixed(min < 10 ? 1 : 0)} min`;
  const h = min / 60;
  if (h < 48) return `${h.toFixed(1)} h`;
  const d = h / 24;
  if (d < 730) return `${d.toFixed(d < 10 ? 1 : 0)} d`;
  return `${(d / 365.25).toFixed(2)} a`;
}

/** Half-life / geological timescales for nuclear chemistry. */
export function fmtHalfLife(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const units: Array<[number, string]> = [
    [1e-9, 'ns'], [1e-6, 'µs'], [1e-3, 'ms'], [1, 's'],
    [60, 'min'], [3600, 'h'], [86400, 'd'], [31557600, 'a'],
  ];
  let chosen = units[0];
  for (const u of units) if (seconds >= u[0]) chosen = u;
  const v = seconds / chosen[0];
  return `${fmt(v, { sig: 3 })} ${chosen[1]}`;
}

/** Clock time for laboratory logs. */
export function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/**
 * Chemical formula → HTML with subscripts and charge superscripts.
 * "H2SO4"    → H<sub>2</sub>SO<sub>4</sub>
 * "SO4^2-"   → SO<sub>4</sub><sup>2−</sup>
 * "Fe(CN)6^3-" keeps the parentheses.
 */
export function formulaHtml(formula: string): string {
  const [body, charge] = splitCharge(formula);
  const sub = body.replace(/([A-Za-z)\]])(\d+)/g, '$1<sub>$2</sub>');
  const sup = charge ? `<sup>${charge.replace('-', '−')}</sup>` : '';
  return sub + sup;
}

function splitCharge(formula: string): [string, string | null] {
  const caret = formula.indexOf('^');
  if (caret >= 0) return [formula.slice(0, caret), formula.slice(caret + 1)];
  const m = formula.match(/^(.*?)((?:\d*[+-])+)$/);
  if (m && m[1] && /[A-Za-z)\]]$/.test(m[1])) return [m[1], m[2]];
  return [formula, null];
}

/** Plain-text formula with Unicode subscripts, for canvas/SVG labels. */
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};
export function formulaText(formula: string): string {
  const [body, charge] = splitCharge(formula);
  const sub = body.replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) =>
    a + d.split('').map((c) => SUB[c] ?? c).join(''));
  return charge ? sub + superscript(charge) : sub;
}
