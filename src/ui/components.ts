/**
 * Shared interface components.
 *
 * Every screen is built from these, so a burette control, a numeric readout or
 * a hazard badge looks and behaves identically in Analítica I, in the
 * laboratory and in a research project (§76).
 */

import { h, svg, type Child, type Props } from './dom.js';
import { icon, ghsPictogram, type IconName } from './icons.js';
import { effect, signal, type Signal } from './reactive.js';
import { fmt, fmtWithU, formulaHtml, fmtP } from '../core/format.js';
import { unitLabel } from '../core/units.js';
import type { Measurement, Provenance } from '../core/uncertainty.js';
import { PROVENANCE_LABEL, PROVENANCE_MARK } from '../core/uncertainty.js';

export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger' | 'hazard' | 'accent';

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export interface PanelOptions {
  title?: string;
  subtitle?: string;
  actions?: Child[];
  footer?: Child;
  flush?: boolean;
  tight?: boolean;
  class?: string;
  sunken?: boolean;
}

export function panel(opts: PanelOptions, ...body: Child[]): HTMLElement {
  return h('section', { class: ['panel', opts.sunken && 'panel--sunken', opts.class] },
    (opts.title || opts.actions) && h('header', { class: 'panel__head' },
      opts.title && h('h3', { class: 'panel__title', text: opts.title }),
      opts.subtitle && h('span', { class: 'panel__subtitle', text: opts.subtitle }),
      opts.actions && h('div', { class: 'panel__actions' }, ...opts.actions),
    ),
    h('div', {
      class: ['panel__body', opts.flush && 'panel__body--flush', opts.tight && 'panel__body--tight'],
    }, ...body),
    opts.footer && h('footer', { class: 'panel__foot' }, opts.footer),
  );
}

/** A collapsible section in a tool rail. */
export function railSection(title: string, options: { open?: boolean; flush?: boolean; actions?: Child[] }, ...body: Child[]): HTMLElement {
  const open = signal(options.open ?? true);
  const section = h('div', {
    class: 'rail__section',
    bindAttrs: () => ({ 'data-open': String(open()) }),
  },
  h('button', {
    class: 'rail__head', type: 'button',
    bindAttrs: () => ({ 'aria-expanded': String(open()) }),
    on: { click: () => open.update((v) => !v) },
  },
  title,
  options.actions && h('span', { class: 'panel__actions' }, ...options.actions),
  h('span', { class: 'rail__head-chevron' }, icon('chevron', { size: 14 })),
  ),
  h('div', { class: ['rail__body', options.flush && 'rail__body--flush'] }, ...body),
  );
  return section;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export interface ButtonOptions extends Omit<Props, 'class'> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  iconName?: IconName;
  iconOnly?: boolean;
  block?: boolean;
  pressed?: boolean;
  class?: string;
}

export function button(label: string, opts: ButtonOptions = {}): HTMLButtonElement {
  const { variant = 'default', size = 'md', iconName, iconOnly, block, pressed, class: cls, ...rest } = opts;
  return h('button', {
    type: 'button',
    class: [
      'btn',
      variant !== 'default' && `btn--${variant}`,
      size !== 'md' && `btn--${size}`,
      iconOnly && 'btn--icon',
      block && 'btn--block',
      cls,
    ],
    'aria-pressed': pressed === undefined ? undefined : String(pressed),
    'aria-label': iconOnly ? label : undefined,
    title: iconOnly ? label : rest.title as string | undefined,
    ...rest,
  },
  iconName && icon(iconName, { size: size === 'sm' ? 13 : 15, class: 'btn__icon' }),
  !iconOnly && label,
  );
}

export function buttonGroup(...buttons: Child[]): HTMLElement {
  return h('div', { class: 'btn-group', role: 'group' }, ...buttons);
}

export interface FieldOptions {
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
  id?: string;
}

export function field(opts: FieldOptions, control: Child): HTMLElement {
  const id = opts.id ?? `f${Math.random().toString(36).slice(2, 8)}`;
  if (control instanceof HTMLElement) control.id = id;
  return h('div', { class: 'field' },
    h('label', { class: 'field__label', for: id },
      opts.label,
      opts.unit && h('span', { class: 'field__unit', text: unitLabel(opts.unit) }),
    ),
    control,
    opts.hint && h('span', { class: 'field__hint', text: opts.hint }),
    opts.error && h('span', { class: 'field__error' },
      icon('aviso', { size: 11 }), opts.error),
  );
}

export interface NumberFieldOptions extends FieldOptions {
  value: Signal<number>;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function numberField(opts: NumberFieldOptions): HTMLElement {
  const input = h('input', {
    class: 'field__input num',
    type: 'number',
    min: opts.min, max: opts.max, step: opts.step ?? 'any',
    disabled: opts.disabled,
    value: String(opts.value.peek()),
    on: {
      input: (ev) => {
        const v = Number((ev.target as HTMLInputElement).value);
        if (Number.isFinite(v)) opts.value.set(v);
      },
    },
  });
  effect(() => {
    const v = String(opts.value());
    if (document.activeElement !== input && input.value !== v) input.value = v;
  });
  return field(opts, input);
}

export interface SliderOptions {
  label: string;
  value: Signal<number>;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Format the displayed value; defaults to 3 significant figures. */
  format?: (v: number) => string;
  /** Logarithmic travel — for a concentration spanning decades. */
  log?: boolean;
  disabled?: boolean;
  hint?: string;
}

/**
 * A slider is always paired with the numeric value it sets. A control whose
 * setting you cannot read is not a scientific control (§75, question 4).
 */
export function slider(opts: SliderOptions): HTMLElement {
  const format = opts.format ?? ((v: number) => fmt(v, { sig: 3 }));
  const toSlider = (v: number): number => (opts.log ? Math.log10(Math.max(v, 1e-300)) : v);
  const fromSlider = (v: number): number => (opts.log ? Math.pow(10, v) : v);

  const input = h('input', {
    class: 'slider__range',
    type: 'range',
    min: toSlider(opts.min), max: toSlider(opts.max),
    step: opts.step ?? (opts.log ? 0.01 : (opts.max - opts.min) / 200),
    value: String(toSlider(opts.value.peek())),
    disabled: opts.disabled,
    'aria-label': opts.label,
    on: {
      input: (ev) => opts.value.set(fromSlider(Number((ev.target as HTMLInputElement).value))),
    },
  });
  effect(() => {
    const v = String(toSlider(opts.value()));
    if (input.value !== v && document.activeElement !== input) input.value = v;
  });

  return h('div', { class: 'slider' },
    h('div', { class: 'slider__top' },
      h('span', { class: 'field__label', text: opts.label }),
      h('span', {
        class: 'slider__value',
        bindText: () => `${format(opts.value())}${opts.unit ? ' ' + unitLabel(opts.unit) : ''}`,
      }),
    ),
    input,
    h('div', { class: 'slider__scale' },
      h('span', { text: format(opts.min) }),
      h('span', { text: format(opts.max) }),
    ),
    opts.hint && h('span', { class: 'field__hint', text: opts.hint }),
  );
}

export function switchControl(label: string, value: Signal<boolean>, opts: { disabled?: boolean } = {}): HTMLElement {
  const input = h('input', {
    type: 'checkbox',
    disabled: opts.disabled,
    on: { change: (ev) => value.set((ev.target as HTMLInputElement).checked) },
  });
  effect(() => { input.checked = value(); });
  return h('label', { class: 'switch' },
    input,
    h('span', { class: 'switch__track' }),
    h('span', { class: 'switch__label', text: label }),
  );
}

export interface SelectOption { value: string; label: string; disabled?: boolean }

export function select(options: SelectOption[], value: Signal<string>, opts: { label?: string; onChange?: (v: string) => void } = {}): HTMLElement {
  const el = h('select', {
    class: 'select',
    'aria-label': opts.label,
    on: {
      change: (ev) => {
        const v = (ev.target as HTMLSelectElement).value;
        value.set(v);
        opts.onChange?.(v);
      },
    },
  },
  ...options.map((o) => h('option', { value: o.value, disabled: o.disabled, text: o.label })),
  );
  effect(() => { el.value = value(); });
  return el;
}

export interface TabSpec { id: string; label: string; badge?: string }

export function tabs(specs: TabSpec[], active: Signal<string>, opts: { pills?: boolean } = {}): HTMLElement {
  return h('div', { class: ['tabs', opts.pills && 'tabs--pills'], role: 'tablist' },
    ...specs.map((s) => {
      const btn = h('button', {
        class: 'tab', type: 'button', role: 'tab',
        on: { click: () => active.set(s.id) },
      }, s.label, s.badge && h('span', { class: 'nav__badge', text: s.badge }));
      effect(() => btn.setAttribute('aria-selected', String(active() === s.id)));
      return btn;
    }),
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function badge(label: string, tone: Tone = 'neutral', opts: { dot?: boolean; title?: string } = {}): HTMLElement {
  return h('span', { class: `badge badge--${tone}`, title: opts.title },
    opts.dot && h('span', { class: 'badge__dot' }),
    label,
  );
}

export function chip(label: string, opts: { onRemove?: () => void; colour?: string } = {}): HTMLElement {
  return h('span', { class: ['chip', opts.onRemove && 'chip--removable'] },
    opts.colour && h('span', { class: 'swatch', style: { background: opts.colour } }),
    label,
    opts.onRemove && h('button', {
      class: 'chip__x', type: 'button', 'aria-label': `Quitar ${label}`,
      on: { click: opts.onRemove },
    }, icon('cerrar', { size: 11 })),
  );
}

/** Chemical formula with correct subscripts and charge superscripts. */
export function formula(f: string, opts: { class?: string } = {}): HTMLElement {
  return h('span', { class: ['formula', opts.class], html: formulaHtml(f) });
}

export interface ReadoutOptions {
  label: string;
  /** Displayed value; pass a function to bind it reactively. */
  value: string | (() => string);
  unit?: string;
  sub?: string | (() => string);
  tone?: 'normal' | 'warn' | 'alarm' | 'settling';
  size?: 'sm' | 'md';
  /** Provenance mark — §66. */
  provenance?: Provenance;
  /** Show the "stabilising" animation, e.g. a balance that has not settled. */
  settling?: boolean | (() => boolean);
}

/**
 * An instrument-style numeric display.
 *
 * The provenance mark is not decoration: it is how a reader tells a measured
 * value from a simulated one at a glance, which §66 requires and which matters
 * as soon as a student compares a calculated pH with a metered one.
 */
export function readout(opts: ReadoutOptions): HTMLElement {
  const el = h('div', { class: ['readout', opts.size === 'sm' && 'readout--sm'] },
    h('div', { class: 'readout__label' },
      opts.label,
      opts.provenance && h('span', {
        class: `prov prov--${provClass(opts.provenance)}`,
        title: `Valor ${PROVENANCE_LABEL[opts.provenance]}`,
        text: PROVENANCE_MARK[opts.provenance],
      }),
      typeof opts.settling === 'function' || opts.settling
        ? h('span', { class: 'settling', bindAttrs: () => ({
          style: (typeof opts.settling === 'function' ? opts.settling() : opts.settling)
            ? '' : 'display:none',
        }) }, h('i'), h('i'), h('i'))
        : null,
    ),
    h('div', { class: 'readout__value' },
      typeof opts.value === 'function'
        ? h('span', { bindText: opts.value })
        : opts.value,
      opts.unit && h('span', { class: 'num__unit', text: unitLabel(opts.unit) }),
    ),
    opts.sub && h('div', {
      class: 'readout__sub',
      ...(typeof opts.sub === 'function' ? { bindText: opts.sub } : { text: opts.sub }),
    }),
  );
  if (opts.tone && opts.tone !== 'normal') el.classList.add(`readout--${opts.tone}`);
  return el;
}

const provClass = (p: Provenance): string =>
  ({ theoretical: 'theory', simulated: 'sim', measured: 'measured', estimated: 'estimated' }[p]);

/** A measurement rendered with its uncertainty and provenance. */
export function measurement(m: Measurement, opts: { label?: string; k?: number } = {}): HTMLElement {
  return h('span', { class: 'num' },
    fmtWithU(m, { style: 'plusminus', k: opts.k }),
    m.unit && h('span', { class: 'num__unit', text: unitLabel(m.unit) }),
    h('span', {
      class: `prov prov--${provClass(m.provenance)}`,
      style: { marginLeft: '0.4em' },
      title: `Valor ${PROVENANCE_LABEL[m.provenance]}`,
      text: PROVENANCE_MARK[m.provenance],
    }),
  );
}

export function meter(opts: { label: string; value: number; max?: number; caption?: string; tone?: 'ok' | 'warn' | 'danger'; format?: (v: number) => string }): HTMLElement {
  const max = opts.max ?? 1;
  const pct = Math.max(0, Math.min(1, opts.value / max));
  return h('div', { class: ['meter', opts.tone && `meter--${opts.tone}`] },
    h('div', { class: 'meter__top' },
      h('span', { class: 'meter__label', text: opts.label }),
      h('span', { class: 'meter__value', text: opts.format ? opts.format(opts.value) : `${(pct * 100).toFixed(0)} %` }),
    ),
    h('div', {
      class: 'meter__track', role: 'progressbar',
      'aria-valuenow': String(Math.round(pct * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': opts.label,
    },
    h('div', { class: 'meter__fill', style: { width: `${pct * 100}%` } }),
    ),
    opts.caption && h('span', { class: 'meter__caption', text: opts.caption }),
  );
}

export interface Column<T> {
  key: string;
  label: string;
  /** Right-aligned monospace column. */
  numeric?: boolean;
  render: (row: T) => Child;
  /** Value used for sorting; defaults to the rendered text. */
  sortValue?: (row: T) => number | string;
  width?: string;
}

export interface TableOptions<T> {
  columns: Column<T>[];
  rows: T[];
  caption?: string;
  compact?: boolean;
  onRowClick?: (row: T) => void;
  selectedId?: (row: T) => boolean;
  emptyMessage?: string;
}

export function table<T>(opts: TableOptions<T>): HTMLElement {
  const sortKey = signal<string | null>(null);
  const sortDir = signal<'asc' | 'desc'>('asc');
  const body = h('tbody');

  const renderBody = (): void => {
    let rows = opts.rows.slice();
    const key = sortKey();
    if (key) {
      const col = opts.columns.find((c) => c.key === key);
      if (col?.sortValue) {
        const dir = sortDir() === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        });
      }
    }
    body.replaceChildren(...rows.map((row) => {
      const tr = h('tr', {
        'aria-selected': opts.selectedId?.(row) ? 'true' : undefined,
        style: opts.onRowClick ? { cursor: 'pointer' } : undefined,
        on: opts.onRowClick ? { click: () => opts.onRowClick!(row) } : undefined,
      },
      ...opts.columns.map((c) =>
        h('td', { class: c.numeric ? 'col-num' : undefined }, c.render(row))),
      );
      return tr;
    }));
  };

  effect(renderBody);

  if (opts.rows.length === 0 && opts.emptyMessage) {
    return emptyState({ title: 'Sin datos', text: opts.emptyMessage, iconName: 'tabla' });
  }

  return h('div', { class: 'table-wrap' },
    h('table', { class: ['table', opts.compact && 'table--compact'] },
      h('thead', {},
        h('tr', {}, ...opts.columns.map((c) => {
          const th = h('th', {
            class: c.sortValue ? 'is-sortable' : undefined,
            style: c.width ? { width: c.width } : undefined,
            scope: 'col',
            on: c.sortValue ? {
              click: () => {
                if (sortKey.peek() === c.key) sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
                else { sortKey.set(c.key); sortDir.set('asc'); }
              },
            } : undefined,
          }, c.label);
          if (c.sortValue) {
            effect(() => {
              if (sortKey() === c.key) th.setAttribute('aria-sort', sortDir() === 'asc' ? 'ascending' : 'descending');
              else th.removeAttribute('aria-sort');
            });
          }
          return th;
        })),
      ),
      body,
      opts.caption && h('caption', { text: opts.caption }),
    ),
  );
}

/** A definition list for property sheets. */
export function props(entries: Array<[string, Child]>, opts: { textual?: boolean } = {}): HTMLElement {
  return h('dl', { class: 'props' },
    ...entries.flatMap(([k, v]) => [
      h('dt', { text: k }),
      h('dd', { class: opts.textual ? 'txt' : undefined }, v),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const NOTE_ICON: Record<Tone, IconName> = {
  neutral: 'info', info: 'info', ok: 'ok', warn: 'aviso',
  danger: 'peligro', hazard: 'aviso', accent: 'info',
};

export function note(tone: Tone, title: string | null, ...body: Child[]): HTMLElement {
  return h('div', { class: `note note--${tone}`, role: tone === 'danger' ? 'alert' : undefined },
    icon(NOTE_ICON[tone], { size: 16, class: 'note__icon' }),
    h('div', { class: 'note__body' },
      title && h('div', { class: 'note__title', text: title }),
      ...body,
    ),
  );
}

export function emptyState(opts: { title: string; text?: string; iconName?: IconName; action?: Child }): HTMLElement {
  return h('div', { class: 'empty' },
    icon(opts.iconName ?? 'info', { size: 30, class: 'empty__icon' }),
    h('p', { class: 'empty__title', text: opts.title }),
    opts.text && h('p', { class: 'empty__text', text: opts.text }),
    opts.action,
  );
}

export function loadingState(message = 'Calculando…'): HTMLElement {
  return h('div', { class: 'empty' },
    h('div', { class: 'spinner' }),
    h('p', { class: 'empty__text', text: message }),
  );
}

export function skeleton(height = 16, width = '100%'): HTMLElement {
  return h('div', { class: 'skeleton', style: { height: `${height}px`, width } });
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export function hazardPictograms(hazards: string[], size = 40): HTMLElement {
  return h('div', { class: 'ghs' },
    ...hazards.map((hz) => {
      const p = ghsPictogram(hz, size);
      return p ? h('div', { class: 'ghs__pictogram' }, p) : null;
    }),
  );
}

// ---------------------------------------------------------------------------
// Causality (§64)
// ---------------------------------------------------------------------------

export interface CausalStep {
  quantity: string;
  direction: 'up' | 'down' | 'flat';
  why?: string;
  value?: string;
}

/**
 * The "what is happening?" chain.
 *
 * §64: a simulation becomes a teaching tool only when the student can see the
 * causal chain behind a number. Each step names a quantity, the direction it
 * moved and the reason — assembled by the simulation itself, so it always
 * matches what actually happened.
 */
export function causalChain(steps: CausalStep[]): HTMLElement {
  const arrow = (): HTMLElement => h('div', { class: 'causal__arrow' }, '↓');
  const nodes: Child[] = [];
  steps.forEach((s, i) => {
    if (i > 0) nodes.push(arrow());
    nodes.push(h('div', { class: 'causal__node' },
      h('span', { class: 'causal__q', text: s.quantity }),
      h('span', { class: `causal__dir causal__dir--${s.direction}` },
        s.direction === 'up' ? '↑ aumenta' : s.direction === 'down' ? '↓ disminuye' : '→ sin cambio'),
      s.value && h('span', { class: 'mono dim', text: s.value }),
      s.why && h('span', { class: 'causal__why', text: s.why }),
    ));
  });
  return h('div', { class: 'causal' }, ...nodes);
}

// ---------------------------------------------------------------------------
// Speciation bar (§25)
// ---------------------------------------------------------------------------

export function speciationBars(
  species: Array<{ formula: string; fraction: number }>,
  opts: { minFraction?: number } = {},
): HTMLElement {
  const min = opts.minFraction ?? 0.001;
  const shown = species.filter((s) => s.fraction >= min).sort((a, b) => b.fraction - a.fraction);
  if (shown.length === 0) {
    return h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: 'Ninguna especie alcanza el 0.1 %.' });
  }
  return h('div', { class: 'speciation' },
    ...shown.map((s, i) => h('div', { class: 'speciation__row' },
      h('span', { class: 'speciation__name', html: formulaHtml(s.formula) }),
      h('div', { class: 'speciation__track' },
        h('div', {
          class: 'speciation__fill',
          style: {
            width: `${Math.min(s.fraction * 100, 100)}%`,
            background: `var(--series-${(i % 8) + 1})`,
          },
        }),
      ),
      h('span', {
        class: 'speciation__pct',
        text: s.fraction >= 0.001 ? `${(s.fraction * 100).toFixed(1)}` : '<0.1',
      }),
    )),
  );
}

// ---------------------------------------------------------------------------
// Toasts (§74 — reserved for safety, errors, experiments, tasks, results)
// ---------------------------------------------------------------------------

let toastHost: HTMLElement | null = null;

export function toast(opts: { tone?: Tone; title: string; body?: string; timeout?: number }): void {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const tone = opts.tone ?? 'info';
  const el = h('div', { class: `toast toast--${tone}`, role: tone === 'danger' ? 'alert' : 'status' },
    icon(NOTE_ICON[tone], { size: 15, class: 'note__icon' }),
    h('div', {},
      h('div', { class: 'toast__title', text: opts.title }),
      opts.body && h('div', { class: 'toast__body', text: opts.body }),
    ),
    h('button', {
      class: 'toast__close', type: 'button', 'aria-label': 'Cerrar',
      on: { click: () => el.remove() },
    }, icon('cerrar', { size: 13 })),
  );
  toastHost.appendChild(el);
  const timeout = opts.timeout ?? (tone === 'danger' ? 12000 : 6000);
  if (timeout > 0) setTimeout(() => el.remove(), timeout);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function modal(opts: { title: string; wide?: boolean; footer?: Child[] }, ...body: Child[]): { close: () => void; element: HTMLElement } {
  const backdrop = h('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title });
  const close = (): void => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (ev: KeyboardEvent): void => { if (ev.key === 'Escape') close(); };

  const dialog = h('div', { class: ['modal', opts.wide && 'modal--wide'] },
    h('header', { class: 'modal__head' },
      h('h2', { class: 'modal__title', text: opts.title }),
      h('div', { class: 'spacer' }),
      button('Cerrar', { iconName: 'cerrar', iconOnly: true, variant: 'ghost', on: { click: close } }),
    ),
    h('div', { class: 'modal__body' }, ...body),
    opts.footer && h('footer', { class: 'modal__foot' }, ...opts.footer),
  );
  backdrop.appendChild(dialog);
  backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
  return { close, element: dialog };
}

// ---------------------------------------------------------------------------
// Small helpers used across screens
// ---------------------------------------------------------------------------

export const spacer = (): HTMLElement => h('div', { class: 'spacer' });
export const divider = (): HTMLElement => h('div', { class: 'divider' });
export const verticalDivider = (): HTMLElement => h('div', { class: 'divider--v' });

export function pHValue(pH: number): HTMLElement {
  const tone: Tone = pH < 4 ? 'danger' : pH > 10 ? 'hazard' : pH < 6.5 || pH > 7.5 ? 'warn' : 'ok';
  return h('span', { class: 'row', style: { gap: '6px' } },
    h('span', { class: 'num', text: fmtP(pH, 2) }),
    badge(pH < 6.5 ? 'ácido' : pH > 7.5 ? 'básico' : 'neutro', tone, { dot: true }),
  );
}

/** A colour swatch showing what a solution actually looks like. */
export function solutionSwatch(colour: string, opts: { label?: string; size?: number } = {}): HTMLElement {
  const size = opts.size ?? 26;
  return h('span', {
    class: 'row', style: { gap: '6px' },
    title: opts.label,
  },
  h('span', {
    style: {
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      background: colour,
      border: '1px solid var(--border-default)',
      boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.12)',
      flex: '0 0 auto',
    },
  }),
  opts.label && h('span', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: opts.label }),
  );
}

/** Segmented competency bar (§59) — readable without relying on colour. */
export function competencyRow(name: string, value: number, segments = 10): HTMLElement {
  const filled = Math.round(value * segments);
  const level = value >= 0.75 ? 'high' : value >= 0.5 ? 'mid' : value >= 0.3 ? 'low' : 'crit';
  return h('div', { class: 'competency__row', dataset: { level } },
    h('span', { class: 'competency__name', text: name }),
    h('div', {
      class: 'competency__bar', role: 'progressbar',
      'aria-valuenow': String(Math.round(value * 100)),
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': name,
    },
    ...Array.from({ length: segments }, (_, i) =>
      h('span', { class: 'competency__seg', dataset: { on: i < filled } })),
    ),
    h('span', { class: 'competency__pct', text: `${Math.round(value * 100)}%` }),
  );
}

/** Download a generated file (CSV, notebook export, report). */
export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Small inline sparkline, for a trend in a table cell. */
export function sparkline(values: number[], opts: { width?: number; height?: number; colour?: string } = {}): SVGSVGElement {
  const w = opts.width ?? 64;
  const hgt = opts.height ?? 18;
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = hgt - ((v - min) / span) * hgt;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return svg('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, 'aria-hidden': 'true' },
    svg('polyline', {
      points: pts, fill: 'none',
      stroke: opts.colour ?? 'var(--series-1)', 'stroke-width': 1.4,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }),
  );
}
