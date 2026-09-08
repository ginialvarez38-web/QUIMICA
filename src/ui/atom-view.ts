/**
 * UNIDAD 2 — vista.
 *
 * Reutiliza la carcasa de la unidad 1 (indice, apartados, avisos) y aporta lo
 * suyo: los renderizadores de sus demostraciones y la TABLA PERIODICA.
 *
 * SOBRE LA TABLA PERIODICA
 * No es una imagen ni una tabla escrita a mano: se coloca cada uno de los 118
 * elementos en la celda (periodo, grupo) que dicen sus datos, y los lantanidos
 * y actinidos —que no tienen grupo— van a las dos filas de abajo. Si manana se
 * corrigiera el periodo de un elemento, se moveria solo.
 */

import type { AtomDemo } from '../teach/atom.js';
import type { TheoryTopic } from '../teach/theory.js';
import { renderUnit, num } from './theory-view.js';
import { ELEMENTS } from '../data/elements.js';
import type { Element } from '../core/types.js';
import { escapeHtml } from './dom.js';

/** Familias, con el color que las distingue en la tabla. */
const CATEGORY_CLASS: Record<string, string> = {
  'alkali-metal': 'cat-alkali',
  'alkaline-earth-metal': 'cat-alkaline',
  'transition-metal': 'cat-transition',
  'post-transition-metal': 'cat-post',
  metalloid: 'cat-metalloid',
  'reactive-nonmetal': 'cat-nonmetal',
  halogen: 'cat-halogen',
  'noble-gas': 'cat-noble',
  lanthanide: 'cat-lanthanide',
  actinide: 'cat-actinide',
  unknown: 'cat-unknown',
};

const CATEGORY_NAME: Record<string, string> = {
  'alkali-metal': 'Alcalinos',
  'alkaline-earth-metal': 'Alcalinoterreos',
  'transition-metal': 'Transicion',
  'post-transition-metal': 'Metales p',
  metalloid: 'Metaloides',
  'reactive-nonmetal': 'No metales',
  halogen: 'Halogenos',
  'noble-gas': 'Gases nobles',
  lanthanide: 'Lantanidos',
  actinide: 'Actinidos',
  unknown: 'Sin confirmar',
};

/*
 * La cuadricula lleva UNA COLUMNA MAS a la izquierda para el numero de
 * periodo, y los elementos van desplazados una columna.
 *
 * Antes los numeros de periodo vivian en una rejilla paralela, y no habia
 * forma de que coincidieran: las filas de la tabla no miden todas lo mismo, y
 * las dos filas de lantanidos y actinidos anaden altura por debajo. El
 * resultado era que el «6» quedaba junto a la fila de los lantanidos. Dentro
 * de la misma rejilla, la alineacion es automatica.
 */
const PT_COLUMNS = 'grid-template-columns: 22px repeat(18, minmax(34px, 1fr))';

function cellHtml(element: Element, column: number, row: number): string {
  const cls = CATEGORY_CLASS[element.category] ?? 'cat-unknown';
  const tip =
    `${element.name} (${element.symbol})\n` +
    `Z = ${element.Z} · masa ${num(element.atomicMass, 3)} u\n` +
    `Grupo ${element.group ?? '—'} · periodo ${element.period} · bloque ${element.block}\n` +
    `${CATEGORY_NAME[element.category] ?? element.category}`;

  return `<button class="pt-cell ${cls}" data-element="${escapeHtml(element.symbol)}"
                  style="grid-column:${column};grid-row:${row}"
                  title="${escapeHtml(tip)}">
            <span class="pt-z">${element.Z}</span>
            <span class="pt-symbol">${escapeHtml(element.symbol)}</span>
            <span class="pt-mass">${num(element.atomicMass, element.massIsNominal ? 0 : 2)}</span>
          </button>`;
}

/**
 * La tabla periodica.
 *
 * Los lantanidos y actinidos se sacan a dos filas aparte, que es la
 * convencion — su sitio real esta intercalado en los periodos 6 y 7, entre los
 * grupos 3 y 4, y se dibujan abajo solo para que la tabla quepa. El apartado
 * 2.10.2 lo dice explicitamente para que nadie crea que estan fuera.
 */
export function renderPeriodicTable(): string {
  const main = ELEMENTS.filter((e) => e.group !== null);
  const lanthanides = ELEMENTS.filter((e) => e.category === 'lanthanide');
  const actinides = ELEMENTS.filter((e) => e.category === 'actinide');

  const groupHeaders =
    '<span class="pt-axis" style="grid-column:1;grid-row:1"></span>' +
    Array.from({ length: 18 }, (_, i) =>
      `<span class="pt-axis pt-group" style="grid-column:${i + 2};grid-row:1">${i + 1}</span>`,
    ).join('');

  const periodLabels = Array.from({ length: 7 }, (_, i) =>
    `<span class="pt-axis pt-period" style="grid-column:1;grid-row:${i + 1}">${i + 1}</span>`,
  ).join('');

  // Las dos filas de abajo se sangran hasta la columna del grupo 3, que es de
  // donde salen.
  const innerRow = (list: readonly Element[], row: number, label: string): string =>
    `<span class="pt-axis pt-period" style="grid-column:1;grid-row:${row}">${label}</span>` +
    list.map((e, i) => cellHtml(e, i + 4, row)).join('');

  const legend = Object.entries(CATEGORY_NAME)
    .map(
      ([key, label]) =>
        `<span class="pt-legend-item"><span class="pt-swatch ${CATEGORY_CLASS[key]}"></span>${escapeHtml(label)}</span>`,
    )
    .join('');

  return `
    <div class="demo">
      <div class="demo-title">Los 118 elementos, colocados por sus propios datos</div>
      <div class="pt-scroll">
        <div class="pt-wrap">
          <div class="pt-grid pt-header" style="${PT_COLUMNS}">${groupHeaders}</div>
          <div class="pt-grid" style="${PT_COLUMNS}">
            ${periodLabels}
            ${main.map((e) => cellHtml(e, e.group! + 1, e.period)).join('')}
          </div>
          <div class="pt-grid pt-inner" style="${PT_COLUMNS}">
            ${innerRow(lanthanides, 1, '6')}
            ${innerRow(actinides, 2, '7')}
          </div>
        </div>
      </div>
      <div class="pt-legend">${legend}</div>
      <p class="demo-note">
        Cada celda esta en la posicion que dicen sus datos: columna = grupo, fila = periodo. No hay
        ninguna imagen detras. Pasa el raton por encima para ver masa, bloque y familia, o pulsa para
        abrir el elemento. Las dos filas sueltas son lantanidos y actinidos: su sitio real esta
        intercalado en los periodos 6 y 7, y se dibujan aparte solo para que la tabla quepa.
      </p>
    </div>`;
}

// ---------------------------------------------------------------------------

function renderDemo(demo: AtomDemo): string {
  switch (demo.kind) {
    /* Protones, neutrones y electrones: tres restas a partir de Z y A. */
    case 'atom-composition':
      return `
        <div class="demo">
          <div class="demo-title">Calculado a partir de Z y A</div>
          <div class="demo-scroll">
            <table class="demo-table nuclide-table">
              <thead><tr><th>Nucleido</th><th>Z</th><th>A</th><th>p⁺</th><th>n⁰</th><th>e⁻</th><th>Por que</th></tr></thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) =>
                      `<tr><th scope="row">${escapeHtml(r.label)}</th>
                       <td>${r.Z}</td><td>${r.A}</td>
                       <td><strong>${r.protons}</strong></td><td><strong>${r.neutrons}</strong></td>
                       <td><strong>${r.electrons}</strong></td>
                       <td class="nuclide-note">${escapeHtml(r.note)}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">
            protones = Z · neutrones = A − Z · electrones = Z − carga. Fijate en las dos ultimas filas:
            en un ion cambian los ELECTRONES, nunca los protones. Si cambiaran los protones ya no seria
            el mismo elemento.
          </p>
        </div>`;

    /*
     * La demostracion mas valiosa de la unidad: la masa atomica NO se copia de
     * una tabla, se deduce de las abundancias y se compara con el valor IUPAC.
     */
    case 'abundance':
      return `
        <div class="demo">
          <div class="demo-title">La masa atomica del ${escapeHtml(demo.elementName)}, deducida</div>
          <table class="demo-table">
            <thead><tr><th>Isotopo</th><th>Masa (u)</th><th>Abundancia</th><th>Aporta</th></tr></thead>
            <tbody>
              ${demo.rows
                .map(
                  (r) =>
                    `<tr><th scope="row">${escapeHtml(r.label)}</th>
                     <td>${num(r.mass, 5)}</td><td>${num(r.abundance, 4)} %</td>
                     <td><strong>${num(r.contribution, 5)}</strong></td></tr>`,
                )
                .join('')}
              <tr class="demo-total"><th scope="row">Media ponderada</th><td></td><td></td>
                  <td><strong>${num(demo.weighted, 4)}</strong></td></tr>
            </tbody>
          </table>
          <p class="demo-result">
            Calculado <strong>${num(demo.weighted, 4)}</strong> · IUPAC <strong>${num(demo.tabulated, 4)}</strong>
            · diferencia ${num(demo.difference, 5)} u
          </p>
          <p class="demo-note">
            Coinciden porque esto ES la definicion de masa atomica estandar: la media de las masas
            isotopicas ponderada por su abundancia. Y observa que ningun isotopo pesa el valor medio —
            ningun atomo real tiene esa masa.
          </p>
        </div>`;

    /* Isobaras e isotonos: se BUSCAN en los datos agrupando. */
    case 'isobars':
    case 'isotones': {
      const isobars = demo.kind === 'isobars';
      return `
        <div class="demo">
          <div class="demo-title">
            ${isobars ? 'Buscados en los datos agrupando por numero masico' : 'Buscados agrupando por numero de neutrones'}
          </div>
          ${
            demo.groups.length === 0
              ? '<p class="demo-note">No hay ningun grupo entre los nucleidos curados.</p>'
              : demo.groups
                  .map(
                    (g) => `
                      <div class="nuclide-group">
                        <span class="nuclide-group-key">${isobars ? `A = ${g.value}` : `N = ${g.value}`}</span>
                        <div class="nuclide-chips">
                          ${g.members
                            .map(
                              (m) =>
                                `<span class="nuclide-chip">
                                   <strong>${escapeHtml(m.label)}</strong>
                                   <span>Z ${m.Z} · N ${m.neutrons} · A ${m.A}</span>
                                 </span>`,
                            )
                            .join('')}
                        </div>
                      </div>`,
                  )
                  .join('')
          }
          <p class="demo-note">
            ${
              isobars
                ? 'Mismo numero de nucleones, distinto elemento. No hay lista escrita: si se anade un nucleido a los datos, las parejas nuevas aparecen solas.'
                : 'Mismo numero de neutrones, distinto elemento y distinto numero masico. Solo coincide N = A − Z.'
            }
          </p>
        </div>`;
    }

    /*
     * Los modelos atomicos como CADENA, no como galeria.
     *
     * Lo que se destaca de cada uno es lo que NO pudo explicar, porque es la
     * razon de que exista el siguiente. Estudiarlos como cinco dibujos
     * sueltos pierde lo unico que ensenan.
     */
    case 'models':
      return `
        <div class="demo">
          <div class="demo-title">Cada modelo cayo por un experimento concreto</div>
          <ol class="models">
            ${demo.models
              .map(
                (m) => `
                <li class="model">
                  <div class="model-head">
                    <span class="model-year">${escapeHtml(m.year)}</span>
                    <strong class="model-name">${escapeHtml(m.name)}</strong>
                    <span class="model-author">${escapeHtml(m.author)}</span>
                  </div>
                  <p class="model-proposal">${escapeHtml(m.proposal)}</p>
                  <div class="model-grid">
                    <div class="model-cell model-evidence">
                      <span class="model-label">En que se apoya</span>${escapeHtml(m.evidence)}
                    </div>
                    <div class="model-cell model-explains">
                      <span class="model-label">Explica</span>${escapeHtml(m.explains)}
                    </div>
                    <div class="model-cell model-fails">
                      <span class="model-label">No puede explicar</span>${escapeHtml(m.fails)}
                    </div>
                    <div class="model-cell model-survives">
                      <span class="model-label">Que sobrevive hoy</span>${escapeHtml(m.survives)}
                    </div>
                  </div>
                </li>`,
              )
              .join('')}
          </ol>
          <p class="demo-note">
            Lee la columna «No puede explicar» de arriba abajo: es el guion de la historia. Cada
            modelo se abandono el dia que aparecio un experimento que no encajaba, no por ser «falso».
            Y fijate en la ultima columna: de todos ellos sobrevive algo, y el de Dalton — de 1803 —
            sigue siendo el que se usa para ajustar una ecuacion.
          </p>
        </div>`;

    /* La tabla periodica, contada. */
    case 'periodic-stats':
      return `
        ${renderPeriodicTable()}
        <div class="demo">
          <div class="demo-title">Los ${demo.total} elementos, contados</div>
          <div class="stats-row">
            <div class="stat"><span class="stat-value">${demo.metals}</span><span class="stat-label">Metales</span></div>
            <div class="stat"><span class="stat-value">${demo.nonmetals}</span><span class="stat-label">No metales</span></div>
            <div class="stat"><span class="stat-value">${demo.metalloids}</span><span class="stat-label">Metaloides</span></div>
          </div>
          <p class="demo-note">
            La gran mayoria de los elementos son metales, cosa que la tabla no deja ver de un vistazo
            porque los no metales ocupan la esquina superior derecha, que es la parte que mas se usa.
          </p>
          <table class="demo-table">
            <thead><tr><th>Bloque</th><th>Elementos</th><th>Que significa</th></tr></thead>
            <tbody>
              ${demo.byBlock
                .map(
                  (b) =>
                    `<tr><th scope="row">${escapeHtml(b.block)}</th><td>${b.count}</td>
                     <td class="nuclide-note">${escapeHtml(b.meaning)}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <table class="demo-table">
            <thead><tr><th>Familia</th><th>Elementos</th></tr></thead>
            <tbody>
              ${demo.byCategory
                .map((c) => `<tr><th scope="row">${escapeHtml(c.label)}</th><td>${c.count}</td></tr>`)
                .join('')}
            </tbody>
          </table>
        </div>`;
  }
}

export function renderAtomUnit(unit: TheoryTopic<AtomDemo>): string {
  return renderUnit(
    unit,
    renderDemo,
    'La composicion de cada nucleido sale de Z y A; la masa atomica se deduce de las abundancias ' +
      'isotopicas y se compara con el valor IUPAC; las isobaras y los isotonos se buscan agrupando los ' +
      'datos; y la tabla periodica se dibuja colocando cada elemento donde dicen su grupo y su periodo.',
  );
}
