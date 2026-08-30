/**
 * TABLA DE COMBINACIONES — vista.
 *
 * Una cuadricula de cationes × aniones para ver de un vistazo que se puede
 * construir, en lugar de descubrirlo una pareja cada vez.
 *
 * LO QUE LA VISTA TIENE QUE COMUNICAR SIN QUE NADIE LO PREGUNTE
 * La aritmetica de cargas valida las 2538 combinaciones, pero solo unas
 * decenas son sustancias verificadas. Si todas se pintaran igual, la tabla
 * afirmaria que existen 2538 compuestos, y eso es falso.
 *
 * Por eso el estado NO se comunica solo con color: las verificadas llevan
 * ademas un punto, y el color es un refuerzo. Quien no distinga los tonos
 * sigue viendo la diferencia, y quien no lea la leyenda la deduce del
 * contraste.
 */

import type { CombinationTable, Combination } from '../engine/combinations.js';
import { comboKey, STATUS_LABEL, STATUS_NOTE, SOLUBILITY_LABEL } from '../engine/combinations.js';
import type { Ion } from '../core/types.js';
import { escapeHtml } from './dom.js';

const SUPERSCRIPT: Record<string, string> = {
  '1': '', '2': '²', '3': '³', '4': '⁴',
};

/** "Ca" con carga 2 → "Ca²⁺"; "SO4" con −2 → "SO₄²⁻". */
export function ionLabel(ion: Ion): string {
  const magnitude = Math.abs(ion.charge);
  const digits = SUPERSCRIPT[String(magnitude)] ?? String(magnitude);
  const sign = ion.charge > 0 ? '⁺' : '⁻';
  const body = ion.formula.replace(/(\d+)/g, (_m, d: string) =>
    [...d].map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]!).join(''),
  );
  return `${body}${digits}${sign}`;
}

export interface CombosFilters {
  /** Texto libre: filtra filas y columnas por formula o nombre del ion. */
  readonly query: string;
  /** Ocultar las combinaciones que el motor no tiene verificadas. */
  readonly onlyVerified: boolean;
  /** Ocultar las que no precipitan, para el trabajo con solubilidad. */
  readonly onlyInsoluble: boolean;
}

function matches(ion: Ion, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    ion.formula.toLowerCase().includes(q) ||
    ion.name.toLowerCase().includes(q) ||
    (ion.traditionalName?.toLowerCase().includes(q) ?? false) ||
    ion.synonyms.some((s) => s.toLowerCase().includes(q))
  );
}

function keeps(combination: Combination, filters: CombosFilters): boolean {
  if (filters.onlyVerified && combination.status !== 'verified') return false;
  if (filters.onlyInsoluble && combination.solubility !== 'insoluble') return false;
  return true;
}

/**
 * Aplica los filtros y devuelve las filas y columnas que quedan.
 *
 * Una fila desaparece cuando NINGUNA de sus celdas sobrevive al filtro, y lo
 * mismo con las columnas. Sin eso, activar «solo verificadas» dejaria una
 * cuadricula casi vacia con decenas de filas en blanco, y habria que buscar
 * los pocos resultados a base de desplazarse.
 */
export function filterTable(
  table: CombinationTable,
  filters: CombosFilters,
): { cations: readonly Ion[]; anions: readonly Ion[]; shown: number } {
  const textCations = table.cations.filter((c) => matches(c, filters.query));
  const textAnions = table.anions.filter((a) => matches(a, filters.query));

  /*
   * El texto busca en LAS DOS listas a la vez. Escribir "sulfato" deja el
   * sulfato como unica columna pero conserva todos los cationes, porque lo
   * que se quiere ver es con quien se combina. Si el texto no casa con ningun
   * ion de una de las dos listas, esa lista se deja entera.
   */
  const cations = textCations.length > 0 ? textCations : table.cations;
  const anions = textAnions.length > 0 ? textAnions : table.anions;

  const keptCations = cations.filter((c) =>
    anions.some((a) => {
      const cell = table.cells.get(comboKey(c, a));
      return cell !== undefined && keeps(cell, filters);
    }),
  );
  const keptAnions = anions.filter((a) =>
    keptCations.some((c) => {
      const cell = table.cells.get(comboKey(c, a));
      return cell !== undefined && keeps(cell, filters);
    }),
  );

  let shown = 0;
  for (const c of keptCations) {
    for (const a of keptAnions) {
      const cell = table.cells.get(comboKey(c, a));
      if (cell && keeps(cell, filters)) shown++;
    }
  }

  return { cations: keptCations, anions: keptAnions, shown };
}

function cellHtml(cell: Combination, filters: CombosFilters, selected: boolean): string {
  if (!keeps(cell, filters)) {
    return '<td class="combo-cell combo-hidden" aria-hidden="true"></td>';
  }

  if (cell.status === 'impossible') {
    return (
      `<td class="combo-cell combo-impossible" title="${escapeHtml(cell.reason ?? '')}">` +
      '<span class="combo-x">—</span></td>'
    );
  }

  const tip =
    `${cell.display} · ${cell.name ?? 'sin nombre'}\n` +
    `${STATUS_LABEL[cell.status]}: ${STATUS_NOTE[cell.status]}\n` +
    (cell.solubility !== 'unknown' ? SOLUBILITY_LABEL[cell.solubility] : '');

  return (
    `<td class="combo-cell combo-${cell.status} sol-${cell.solubility}${selected ? ' is-selected' : ''}" ` +
    `data-combo="${escapeHtml(comboKey(cell.cation, cell.anion))}" ` +
    `title="${escapeHtml(tip)}" tabindex="0" role="button">` +
    `<span class="combo-formula">${escapeHtml(cell.display ?? '')}</span>` +
    (cell.status === 'verified' ? '<span class="combo-dot" aria-label="verificada"></span>' : '') +
    '</td>'
  );
}

export function renderCombos(
  table: CombinationTable,
  filters: CombosFilters,
  selectedKey: string | null,
): string {
  const { cations, anions, shown } = filterTable(table, filters);

  if (cations.length === 0 || anions.length === 0) {
    return `
      <div class="combos-empty">
        <h2>Ningun resultado</h2>
        <p>Con los filtros actuales no queda ninguna combinacion. Prueba a borrar el texto de
        busqueda o a desactivar «${filters.onlyVerified ? 'Solo verificadas' : 'Solo precipitados'}».</p>
      </div>`;
  }

  const head =
    '<thead><tr><th class="combo-corner" scope="col">' +
    '<span class="corner-cation">catión ↓</span><span class="corner-anion">anión →</span>' +
    '</th>' +
    anions
      .map(
        (a) =>
          `<th class="combo-head" scope="col" title="${escapeHtml(a.name)}">` +
          `<span class="head-ion">${escapeHtml(ionLabel(a))}</span>` +
          `<span class="head-name">${escapeHtml(a.name)}</span></th>`,
      )
      .join('') +
    '</tr></thead>';

  const body =
    '<tbody>' +
    cations
      .map((c) => {
        const cells = anions
          .map((a) => {
            const key = comboKey(c, a);
            const cell = table.cells.get(key);
            return cell ? cellHtml(cell, filters, key === selectedKey) : '<td class="combo-cell"></td>';
          })
          .join('');
        return (
          `<tr><th class="combo-row-head" scope="row" title="${escapeHtml(c.name)}">` +
          `<span class="head-ion">${escapeHtml(ionLabel(c))}</span>` +
          `<span class="head-name">${escapeHtml(c.traditionalName ?? c.name)}</span></th>${cells}</tr>`
        );
      })
      .join('') +
    '</tbody>';

  return `
    <div class="combos-meta">
      <span class="combos-shown"><strong>${shown}</strong> combinaciones ·
        ${cations.length} cationes × ${anions.length} aniones</span>
      <span class="combos-legend">
        <span class="legend-item"><span class="swatch combo-verified"><span class="combo-dot"></span></span>
          Verificada <em>(${table.counts.verified})</em></span>
        <span class="legend-item"><span class="swatch combo-derived"></span>
          Derivada <em>(${table.counts.derived})</em></span>
        <span class="legend-item"><span class="swatch sol-insoluble"></span> Precipita</span>
        <span class="legend-item"><span class="swatch combo-impossible">—</span> No procede</span>
      </span>
    </div>

    <div class="combos-scroll">
      <table class="combos-table">${head}${body}</table>
    </div>

    <p class="combos-caution">
      <strong>Verificada</strong> significa que la sustancia esta en la base de datos: existe, y su
      nombre y su solubilidad son datos medidos. <strong>Derivada</strong> significa que la formula se
      deduce correctamente de las cargas — es la respuesta buena al ejercicio de formulacion — pero el
      motor <strong>no afirma</strong> que ese compuesto exista, sea estable o se pueda preparar.
    </p>`;
}

/**
 * El detalle de una combinacion, para el inspector: los seis pasos de la
 * derivacion mas lo que se sepa de la sustancia.
 */
export function renderComboDetail(cell: Combination): string {
  if (cell.status === 'impossible') {
    return `
      <div class="combo-detail">
        <h2 class="combo-detail-formula">${escapeHtml(ionLabel(cell.cation))} + ${escapeHtml(ionLabel(cell.anion))}</h2>
        <div class="notice warn"><strong>Esta combinacion no procede.</strong><br>${escapeHtml(cell.reason ?? '')}</div>
      </div>`;
  }

  const steps = (cell.built?.derivation ?? [])
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.title)}</strong><br>${escapeHtml(s.detail)}` +
        (s.math ? `<code class="why-math">${escapeHtml(s.math)}</code>` : '') +
        '</li>',
    )
    .join('');

  return `
    <div class="combo-detail">
      <header class="combo-detail-head">
        <h2 class="combo-detail-formula">${escapeHtml(cell.display ?? '')}</h2>
        <span class="conf conf-${cell.status === 'verified' ? 'experimental' : 'theoretical'}">
          ${escapeHtml(STATUS_LABEL[cell.status])}</span>
      </header>
      ${cell.name ? `<p class="combo-detail-name">${escapeHtml(cell.name)}</p>` : ''}

      <p class="combo-detail-note">${escapeHtml(STATUS_NOTE[cell.status])}</p>

      <div class="finding-grid">
        <article class="finding">
          <header class="finding-head"><span class="finding-label">Iones</span></header>
          <div class="finding-value">${escapeHtml(ionLabel(cell.cation))} + ${escapeHtml(ionLabel(cell.anion))}</div>
          <p class="finding-because">${escapeHtml(cell.cation.name)} y ${escapeHtml(cell.anion.name)}</p>
        </article>
        <article class="finding">
          <header class="finding-head"><span class="finding-label">Proporcion</span></header>
          <div class="finding-value">${cell.cationCount} : ${cell.anionCount}</div>
          <p class="finding-because">${escapeHtml(cell.neutralityCheck ?? '')}</p>
        </article>
        ${
          cell.solubility !== 'unknown'
            ? `<article class="finding">
                 <header class="finding-head"><span class="finding-label">En agua</span></header>
                 <div class="finding-value">${escapeHtml(SOLUBILITY_LABEL[cell.solubility])}</div>
               </article>`
            : ''
        }
      </div>

      <h3 class="analysis-section-title"><span class="section-icon">⬡</span>Como se llega a la formula</h3>
      <ol class="combo-steps">${steps}</ol>

      <button class="button button-primary" data-open-formula="${escapeHtml(cell.formula ?? '')}">
        Abrir ${escapeHtml(cell.display ?? '')} y analizarlo
      </button>
    </div>`;
}
