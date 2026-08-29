/**
 * Universal search (§61).
 *
 * One box over every entity CHEMIA knows: substances, elements, molecules,
 * instruments, courses, topics, concepts, equations, half-reactions,
 * mechanisms and indicators. Results are grouped by kind and fully
 * keyboard-navigable.
 */

import { h, replace } from './dom.js';
import { icon, type IconName } from './icons.js';
import { signal, debounce } from './reactive.js';
import { search, groupResults, KIND_LABEL, type EntityKind, type SearchResult } from '../domain/search.js';
import { formulaHtml } from '../core/format.js';

const KIND_ICON: Record<EntityKind, IconName> = {
  sustancia: 'matraz',
  elemento: 'tabla-periodica',
  molecula: 'molecula',
  asignatura: 'universidad',
  tema: 'cuaderno',
  concepto: 'grafo',
  ecuacion: 'progreso',
  instrumento: 'balanza',
  reaccion: 'reaccion',
  mecanismo: 'equilibrio',
  indicador: 'espectro',
  experimento: 'laboratorio',
  proyecto: 'investigacion',
};

let openPanel: HTMLElement | null = null;

/** Suggestions shown before the reader has typed anything. */
const STARTERS: Array<{ label: string; query: string }> = [
  { label: 'NaOH', query: 'NaOH' },
  { label: 'bureta', query: 'bureta' },
  { label: 'pH', query: 'pH' },
  { label: 'Nernst', query: 'nernst' },
  { label: 'EDTA', query: 'edta' },
  { label: 'hierro', query: 'hierro' },
  { label: 'cinética', query: 'cinetica' },
  { label: 'espectro IR', query: 'infrarrojo' },
];

export function openSearch(initial = ''): void {
  if (openPanel) {
    openPanel.querySelector<HTMLInputElement>('.omni__input')?.focus();
    return;
  }

  const query = signal(initial);
  const active = signal(0);
  let flat: SearchResult[] = [];

  const results = h('div', { class: 'omni__results', role: 'listbox', 'aria-label': 'Resultados' });

  const input = h('input', {
    class: 'omni__input',
    type: 'search',
    placeholder: 'Buscar sustancias, instrumentos, conceptos, ecuaciones…',
    'aria-label': 'Buscar en CHEMIA',
    autocomplete: 'off',
    spellcheck: 'false',
    value: initial,
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    openPanel = null;
  };

  const go = (r: SearchResult): void => {
    close();
    location.hash = r.entity.href.replace(/^#/, '');
  };

  const render = (): void => {
    const q = query();
    if (q.trim().length === 0) {
      flat = [];
      replace(results,
        h('div', { class: 'omni__group-label', text: 'Prueba a buscar' }),
        h('div', { class: 'row row--wrap', style: { padding: 'var(--sp-2) var(--sp-3) var(--sp-4)', gap: 'var(--sp-2)' } },
          ...STARTERS.map((s) => h('button', {
            class: 'chip', type: 'button',
            on: { click: () => { query.set(s.query); input.value = s.query; render(); } },
          }, s.label)),
        ),
        h('p', {
          class: 'dim',
          style: { padding: '0 var(--sp-3) var(--sp-3)', fontSize: 'var(--fs-2xs)', lineHeight: '1.5' },
          text: 'Una sola búsqueda cubre toda la plataforma: sustancias y sus propiedades, elementos, '
            + 'moléculas, instrumentos con su calibración y sus errores, asignaturas, temas, conceptos, '
            + 'ecuaciones, semirreacciones e indicadores.',
        }),
      );
      return;
    }

    const found = search(q, { limit: 40 });
    flat = found;
    if (found.length === 0) {
      replace(results, h('div', { class: 'empty' },
        icon('buscar', { size: 26, class: 'empty__icon' }),
        h('p', { class: 'empty__title', text: `Sin resultados para «${q}»` }),
        h('p', { class: 'empty__text', text: 'Prueba con la fórmula, el nombre del instrumento o el concepto.' }),
      ));
      return;
    }

    active.set(0);
    const groups = groupResults(found);
    let index = 0;
    const nodes = groups.flatMap((group) => [
      h('div', { class: 'omni__group-label', text: KIND_LABEL[group.kind] }),
      ...group.items.map((r) => {
        const i = index++;
        const item = h('button', {
          class: 'omni__item', type: 'button', role: 'option',
          dataset: { index: i },
          on: { click: () => go(r) },
        },
        icon(KIND_ICON[r.entity.kind], { size: 15 }),
        h('span', { style: { minWidth: '0' } },
          h('span', { html: /^[A-Z][a-z]?\d|·|\^/.test(r.entity.title) ? formulaHtml(r.entity.title) : r.entity.title }),
          r.entity.subtitle && h('div', { class: 'omni__item-sub', text: r.entity.subtitle }),
        ),
        h('span', { class: 'omni__item-kind', text: KIND_LABEL[r.entity.kind] }),
        );
        return item;
      }),
    ]);
    replace(results, ...nodes);
    highlight();
  };

  const highlight = (): void => {
    const i = active();
    results.querySelectorAll<HTMLElement>('.omni__item').forEach((el, k) => {
      const on = k === i;
      el.dataset.active = String(on);
      el.setAttribute('aria-selected', String(on));
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
  };

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      active.set(Math.min(active.peek() + 1, flat.length - 1));
      highlight();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      active.set(Math.max(active.peek() - 1, 0));
      highlight();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const r = flat[active.peek()];
      if (r) go(r);
    }
  };

  input.addEventListener('input', debounce(() => {
    query.set(input.value);
    render();
  }, 110));

  const panel = h('div', { class: 'modal omni', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Búsqueda' },
    input,
    results,
    h('footer', { class: 'modal__foot', style: { justifyContent: 'space-between' } },
      h('span', { class: 'dim', style: { fontSize: 'var(--fs-3xs)' }, text: '↑↓ navegar · ⏎ abrir · Esc cerrar' }),
      h('span', { class: 'dim', style: { fontSize: 'var(--fs-3xs)' }, bindText: () => `${flat.length} resultados` }),
    ),
  );

  const backdrop = h('div', {
    class: 'modal-backdrop',
    style: { alignItems: 'flex-start' },
    on: { click: (ev) => { if (ev.target === backdrop) close(); } },
  }, panel);

  document.body.appendChild(backdrop);
  document.addEventListener('keydown', onKey, true);
  openPanel = backdrop;
  render();
  input.focus();
  input.select();
}
