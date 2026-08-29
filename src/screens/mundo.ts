/**
 * Mundo químico (§16–§19).
 *
 * The interactive periodic table with property filters and a colour scale that
 * always prints its value, the substance dossier that gathers everything the
 * platform knows about a compound, and the 3D molecular viewer with its
 * measurement tools.
 */

import { h, replace, svg, type Child } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, setContext } from '../ui/shell.js';
import {
  panel, button, badge, note, tabs, emptyState, props, hazardPictograms,
  formula as formulaEl, buttonGroup, table, measurement, toast, download,
} from '../ui/components.js';
import { href, navigate, route, setParam } from '../ui/router.js';
import { signal, effect } from '../ui/reactive.js';
import { plot, seriesToCsv } from '../ui/plot.js';
import { MoleculeViewer, RENDER_MODE_LABEL, type RenderMode, type Measurement as MolMeasurement } from '../ui/viewer3d.js';
import {
  ELEMENTS, elementBySymbol, tablePosition, CATEGORY_LABEL, isMetal,
  type Element, type ElementCategory,
} from '../data/elements.js';
import { isotopesOf, averageMassFromIsotopes } from '../data/isotopes.js';
import { SUBSTANCES, substanceById, searchSubstances } from '../data/substances.js';
import { MOLECULES, moleculeById } from '../data/molecules.js';
import {
  vseprOf, estimateDipole, validate, molecularMass, boundingRadius,
} from '../core/mol/molecule.js';
import { isotopePattern, elementalAnalysis, monoisotopic } from '../core/chem/formula.js';
import { HALF_REACTIONS, halfReactionById, nernst } from '../core/chem/electrochem.js';
import { substanceDossier } from '../domain/search.js';
import { fmt, formulaHtml, fmtPercent } from '../core/format.js';
import { PHASE_LABEL, dominantForm } from '../domain/substance.js';
import { kelvinToCelsius } from '../core/units.js';
import { meas } from '../core/uncertainty.js';

export function mundoScreen(): HTMLElement {
  const r = route();
  const [, second, third] = r.segments;

  if (second === 'elemento' && third) return elementView(third);
  if (second === 'sustancia' && third) return substanceView(third);
  if (second === 'molecula' && third) return moleculeView(third);
  if (second === 'redox' && third) return redoxView(decodeURIComponent(third));
  if (second === 'sustancias') return substanceIndex();
  if (second === 'moleculas') return moleculeIndex();
  return periodicTableView();
}

// ===========================================================================
// Periodic table (§16)
// ===========================================================================

type ScaleKey = 'ninguna' | 'electronegatividad' | 'ionisation1' | 'radiusCovalent'
  | 'electronAffinity' | 'density' | 'meltingPoint' | 'abundanceCrust';

const SCALES: Array<{ id: ScaleKey; label: string; unit: string; log?: boolean; get: (e: Element) => number | null }> = [
  { id: 'ninguna', label: 'Categoría', unit: '', get: () => null },
  { id: 'electronegatividad', label: 'Electronegatividad', unit: 'Pauling', get: (e) => e.electronegativity },
  { id: 'ionisation1', label: 'Energía de ionización', unit: 'kJ·mol⁻¹', get: (e) => e.ionisation1 },
  { id: 'electronAffinity', label: 'Afinidad electrónica', unit: 'kJ·mol⁻¹', get: (e) => e.electronAffinity },
  { id: 'radiusCovalent', label: 'Radio covalente', unit: 'pm', get: (e) => e.radiusCovalent },
  { id: 'density', label: 'Densidad', unit: 'g·cm⁻³', log: true, get: (e) => e.density },
  { id: 'meltingPoint', label: 'Punto de fusión', unit: 'K', get: (e) => e.meltingPoint },
  { id: 'abundanceCrust', label: 'Abundancia en la corteza', unit: 'ppm', log: true, get: (e) => e.abundanceCrust },
];

const CATEGORY_COLOUR: Record<ElementCategory, string> = {
  alcalino: 'var(--series-6)',
  alcalinoterreo: 'var(--series-5)',
  transicion: 'var(--series-1)',
  postransicion: 'var(--series-8)',
  metaloide: 'var(--series-3)',
  nometal: 'var(--series-7)',
  halogeno: 'var(--series-4)',
  noble: 'var(--series-2)',
  lantanido: 'var(--series-4)',
  actinido: 'var(--series-6)',
  desconocido: 'var(--fg-muted)',
};

function periodicTableView(): HTMLElement {
  setContext([{ label: 'Mundo químico' }, { label: 'Tabla periódica' }]);

  const scale = signal<ScaleKey>((route().params.get('escala') as ScaleKey) ?? 'ninguna');
  const filterCategory = signal<ElementCategory | 'todas'>('todas');
  const filterState = signal<'todos' | 'solido' | 'liquido' | 'gas'>('todos');
  const filterMetal = signal<'todos' | 'metal' | 'nometal'>('todos');
  const selected = signal<string | null>(route().params.get('elemento'));

  const grid = h('div', { class: 'ptable' });
  const legend = h('div', { class: 'ptable__legend' });
  const detail = h('div');

  effect(() => {
    const key = scale();
    const spec = SCALES.find((s) => s.id === key)!;
    const cat = filterCategory();
    const st = filterState();
    const met = filterMetal();

    const values = ELEMENTS.map(spec.get).filter((v): v is number => v !== null && (!spec.log || v > 0));
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;

    const cells: Child[] = [];
    // Row-major placement with explicit grid positions, so the f-block sits in
    // its two detached rows and the gaps in periods 1–3 stay empty.
    for (const e of ELEMENTS) {
      const pos = tablePosition(e);
      const dimmed = (cat !== 'todas' && e.category !== cat)
        || (st !== 'todos' && e.standardState !== st)
        || (met === 'metal' && !isMetal(e))
        || (met === 'nometal' && isMetal(e));

      const v = spec.get(e);
      const band = key === 'ninguna'
        ? CATEGORY_COLOUR[e.category]
        : v === null ? 'var(--border-subtle)' : scaleColour(v, lo, hi, Boolean(spec.log));

      cells.push(h('button', {
        class: 'ptable__cell',
        type: 'button',
        style: { gridRow: String(pos.row), gridColumn: String(pos.col) },
        dataset: { dim: dimmed },
        'aria-pressed': String(selected() === e.symbol),
        title: `${e.name} · Z = ${e.Z}${v !== null ? ` · ${spec.label}: ${fmt(v, { sig: 4 })} ${spec.unit}` : ''}`,
        on: { click: () => { selected.set(e.symbol); setParam('elemento', e.symbol); } },
      },
      h('span', { class: 'ptable__band', style: { background: band } }),
      h('span', { class: 'ptable__z', text: String(e.Z) }),
      h('span', { class: 'ptable__sym', text: e.symbol }),
      h('span', { class: 'ptable__name', text: e.name }),
      // The value is always printed, so the map never depends on colour (§68).
      h('span', { class: 'ptable__mass', text: key === 'ninguna' ? e.mass.toFixed(e.massIsNominal ? 0 : 2) : (v === null ? '—' : fmt(v, { sig: 3 })) }),
      ));
    }

    // Labels for the two detached f-block rows.
    cells.push(h('div', {
      class: 'ptable__series-label',
      style: { gridRow: '8', gridColumn: '1 / -1' },
      text: 'Lantánidos y actínidos',
    }));

    replace(grid, ...cells);

    replace(legend,
      key === 'ninguna'
        ? h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-3)' } },
          ...(Object.keys(CATEGORY_COLOUR) as ElementCategory[]).map((c) =>
            h('span', { class: 'row', style: { gap: '5px' } },
              h('span', { class: 'swatch', style: { background: CATEGORY_COLOUR[c] } }),
              h('span', { text: CATEGORY_LABEL[c] }),
            )),
        )
        : h('div', { class: 'ptable__scale' },
          h('span', { class: 'mono', text: `${fmt(lo, { sig: 3 })}` }),
          h('span', {
            class: 'ptable__scale-bar',
            style: { background: 'linear-gradient(90deg, var(--series-1), var(--series-3), var(--series-5), var(--series-2))' },
          }),
          h('span', { class: 'mono', text: `${fmt(hi, { sig: 3 })}` }),
          h('span', { class: 'dim', text: spec.unit }),
        ),
    );
  });

  effect(() => {
    const sym = selected();
    replace(detail, sym ? elementPanel(sym) : emptyState({
      title: 'Selecciona un elemento',
      text: 'Cada celda muestra el valor de la propiedad elegida, de modo que la información no depende del color.',
      iconName: 'tabla-periodica',
    }));
  });

  return screen({
    eyebrow: 'Mundo químico',
    title: 'Tabla periódica',
    lede: 'Los 118 elementos con su configuración electrónica, radios, energías de ionización, '
      + 'estados de oxidación y abundancia. Elige una propiedad para verla como mapa de color.',
  },
  h('div', { class: 'stack' },
    panel({
      title: 'Filtros',
      tight: true,
    },
    h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-4)' } },
      labelled('Escala de color', h('select', {
        class: 'select', style: { width: 'auto' },
        on: { change: (ev) => { const v = (ev.target as HTMLSelectElement).value as ScaleKey; scale.set(v); setParam('escala', v === 'ninguna' ? undefined : v); } },
      }, ...SCALES.map((s) => h('option', { value: s.id, selected: s.id === scale.peek() ? '' : undefined, text: s.label })))),
      labelled('Categoría', h('select', {
        class: 'select', style: { width: 'auto' },
        on: { change: (ev) => filterCategory.set((ev.target as HTMLSelectElement).value as ElementCategory | 'todas') },
      },
      h('option', { value: 'todas', text: 'Todas' }),
      ...(Object.keys(CATEGORY_COLOUR) as ElementCategory[]).map((c) =>
        h('option', { value: c, text: CATEGORY_LABEL[c] })))),
      labelled('Estado a 298 K', h('select', {
        class: 'select', style: { width: 'auto' },
        on: { change: (ev) => filterState.set((ev.target as HTMLSelectElement).value as 'todos') },
      },
      h('option', { value: 'todos', text: 'Todos' }),
      h('option', { value: 'solido', text: 'Sólido' }),
      h('option', { value: 'liquido', text: 'Líquido' }),
      h('option', { value: 'gas', text: 'Gas' }))),
      labelled('Metal / no metal', h('select', {
        class: 'select', style: { width: 'auto' },
        on: { change: (ev) => filterMetal.set((ev.target as HTMLSelectElement).value as 'todos') },
      },
      h('option', { value: 'todos', text: 'Todos' }),
      h('option', { value: 'metal', text: 'Metales' }),
      h('option', { value: 'nometal', text: 'No metales' }))),
    ),
    ),
    panel({ title: 'Tabla', flush: true },
      h('div', { class: 'ptable-wrap' }, grid),
      legend,
    ),
    detail,
  ),
  );
}

function labelled(label: string, control: Child): HTMLElement {
  return h('label', { class: 'field', style: { width: 'auto' } },
    h('span', { class: 'field__label', text: label }),
    control,
  );
}

function scaleColour(v: number, lo: number, hi: number, log: boolean): string {
  const t = log
    ? (Math.log10(Math.max(v, 1e-12)) - Math.log10(Math.max(lo, 1e-12)))
      / (Math.log10(Math.max(hi, 1e-12)) - Math.log10(Math.max(lo, 1e-12)) || 1)
    : (v - lo) / (hi - lo || 1);
  const clamped = Math.max(0, Math.min(1, t));
  const stops = ['var(--series-1)', 'var(--series-3)', 'var(--series-5)', 'var(--series-2)'];
  return stops[Math.min(stops.length - 1, Math.floor(clamped * stops.length))];
}

function elementPanel(symbol: string): HTMLElement {
  const e = elementBySymbol(symbol);
  if (!e) return emptyState({ title: 'Elemento desconocido' });

  const isotopes = isotopesOf(symbol);
  const recomputed = averageMassFromIsotopes(symbol);
  const compounds = SUBSTANCES.filter((s) => symbol in s.composition);

  return panel({
    title: `${e.name} (${e.symbol})`,
    subtitle: CATEGORY_LABEL[e.category],
    actions: [button('Ficha completa', { size: 'sm', on: { click: () => navigate(`mundo/elemento/${symbol}`) } })],
  },
  h('div', { class: 'grid grid--3' },
    props([
      ['Número atómico', String(e.Z)],
      ['Masa atómica', `${e.mass}${e.massIsNominal ? ' (isótopo más estable)' : ''} g·mol⁻¹`],
      ['Configuración', e.config],
      ['Grupo / periodo', `${e.group ?? '—'} / ${e.period}`],
      ['Bloque', e.block],
      ['Estado a 298 K', e.standardState],
    ]),
    props([
      ['Electronegatividad', e.electronegativity !== null ? String(e.electronegativity) : 'no definida'],
      ['1.ª ionización', e.ionisation1 !== null ? `${e.ionisation1} kJ·mol⁻¹` : '—'],
      ['Afinidad electrónica', e.electronAffinity !== null ? `${e.electronAffinity} kJ·mol⁻¹` : '—'],
      ['Radio covalente', e.radiusCovalent !== null ? `${e.radiusCovalent} pm` : '—'],
      ['Radio de van der Waals', e.radiusVdW !== null ? `${e.radiusVdW} pm` : '—'],
      ['Estados de oxidación', e.oxidationStates.length ? e.oxidationStates.map((o) => (o > 0 ? `+${o}` : String(o))).join(', ') : '—'],
    ]),
    props([
      ['Densidad', e.density !== null ? `${e.density} g·cm⁻³` : '—'],
      ['Fusión', e.meltingPoint !== null ? `${e.meltingPoint} K (${kelvinToCelsius(e.meltingPoint).toFixed(0)} °C)` : '—'],
      ['Ebullición', e.boilingPoint !== null ? `${e.boilingPoint} K (${kelvinToCelsius(e.boilingPoint).toFixed(0)} °C)` : '—'],
      ['Abundancia', e.abundanceCrust !== null ? `${fmt(e.abundanceCrust, { sig: 3 })} ppm` : '—'],
      ['Electrones por capa', e.shells.join('–')],
      ['Descubrimiento', e.discovered !== null ? String(e.discovered) : 'conocido desde la antigüedad'],
    ]),
  ),
  isotopes.length > 0 && h('div', { style: { marginTop: 'var(--sp-5)' } },
    h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Isótopos' }),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'table table--compact' },
        h('thead', {}, h('tr', {},
          h('th', { text: 'Nucleido' }), h('th', { text: 'Masa (u)' }),
          h('th', { text: 'Abundancia' }), h('th', { text: 'Vida media' }), h('th', { text: 'Desintegración' }),
        )),
        h('tbody', {}, ...isotopes.map((i) => h('tr', {},
          h('td', { class: 'col-key' }, h('sup', { text: String(i.A) }), i.symbol),
          h('td', { class: 'col-num', text: i.mass.toFixed(6) }),
          h('td', { class: 'col-num', text: i.abundance > 0 ? fmtPercent(i.abundance, 4) : '—' }),
          h('td', { class: 'col-num', text: i.halfLife !== null ? fmt(i.halfLife / 31557600, { sig: 3 }) + ' a' : 'estable' }),
          h('td', { text: i.decayMode ?? '—' }),
        ))),
      ),
    ),
    recomputed !== null && h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', marginTop: 'var(--sp-2)' },
      text: `Comprobación: la media ponderada de estos isótopos da ${recomputed.toFixed(4)} g·mol⁻¹, `
        + `frente a ${e.mass} tabulado.` }),
  ),
  compounds.length > 0 && h('div', { style: { marginTop: 'var(--sp-5)' } },
    h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Compuestos en la plataforma' }),
    h('div', { class: 'xlinks' },
      ...compounds.map((s) => h('a', { class: 'xlink', href: href(`mundo/sustancia/${s.id}`) },
        h('span', { html: formulaHtml(s.formula) }), ' ', s.name)),
    ),
  ),
  );
}

function elementView(symbol: string): HTMLElement {
  const e = elementBySymbol(symbol);
  setContext([
    { label: 'Mundo químico', href: href('mundo') },
    { label: 'Tabla periódica', href: href('mundo/tabla') },
    { label: e?.name ?? symbol },
  ]);
  if (!e) return screen({ title: 'Elemento no encontrado' }, emptyState({ title: 'Ese elemento no existe' }));

  // Periodic trend plot: this element's group and period.
  const groupMembers = e.group !== null
    ? ELEMENTS.filter((x) => x.group === e.group && x.block !== 'f')
    : [];
  const periodMembers = ELEMENTS.filter((x) => x.period === e.period && x.block !== 'f');

  return screen({
    eyebrow: `Z = ${e.Z} · ${CATEGORY_LABEL[e.category]}`,
    title: `${e.name} (${e.symbol})`,
    lede: `${e.config} · ${e.mass} g·mol⁻¹`,
  },
  h('div', { class: 'stack stack--loose' },
    elementPanel(symbol),
    h('div', { class: 'grid grid--2' },
      groupMembers.length > 2 && panel({ title: `Tendencia en el grupo ${e.group}` },
        plot({
          series: [{
            id: 'en', label: 'Electronegatividad',
            x: groupMembers.map((x) => x.period),
            y: groupMembers.map((x) => x.electronegativity ?? NaN),
            kind: 'both', colour: 1,
          }, {
            id: 'r', label: 'Radio covalente',
            x: groupMembers.map((x) => x.period),
            y: groupMembers.map((x) => x.radiusCovalent ?? NaN),
            kind: 'both', colour: 2,
          }],
          y2Series: ['r'],
          x: { label: 'Periodo', format: (v) => String(Math.round(v)) },
          y: { label: 'Electronegatividad', unit: 'Pauling' },
          y2: { label: 'Radio covalente', unit: 'pm' },
          height: 240,
          markers: [{ axis: 'x', value: e.period, label: e.symbol }],
          caption: 'Al bajar en el grupo el radio crece y la electronegatividad disminuye: '
            + 'el electrón de valencia queda más lejos del núcleo y más apantallado.',
        }),
      ),
      panel({ title: `Tendencia en el periodo ${e.period}` },
        plot({
          series: [{
            id: 'ie', label: 'Energía de ionización',
            x: periodMembers.map((x) => x.group ?? 0),
            y: periodMembers.map((x) => x.ionisation1 ?? NaN),
            kind: 'both', colour: 5,
          }],
          x: { label: 'Grupo', format: (v) => String(Math.round(v)) },
          y: { label: 'Energía de ionización', unit: 'kJ·mol⁻¹' },
          height: 240,
          markers: [{ axis: 'x', value: e.group ?? 0, label: e.symbol }],
          caption: 'A lo largo del periodo la carga nuclear efectiva aumenta y el radio disminuye, '
            + 'de modo que cuesta más arrancar un electrón. Las caídas en los grupos 13 y 16 delatan '
            + 'la estructura de subcapas.',
        }),
      ),
    ),
  ),
  );
}

// ===========================================================================
// Substance dossier (§15, §61)
// ===========================================================================

function substanceIndex(): HTMLElement {
  setContext([{ label: 'Mundo químico', href: href('mundo') }, { label: 'Sustancias' }]);
  const query = signal(route().params.get('q') ?? '');
  const listHost = h('div');

  effect(() => {
    const q = query();
    const list = q.trim() ? searchSubstances(q, 100) : SUBSTANCES;
    replace(listHost, table({
      columns: [
        { key: 'name', label: 'Nombre', render: (s) => h('a', { href: href(`mundo/sustancia/${s.id}`), text: s.name }), sortValue: (s) => s.name },
        { key: 'formula', label: 'Fórmula', render: (s) => formulaEl(s.formula), sortValue: (s) => s.formula },
        { key: 'mass', label: 'M / g·mol⁻¹', numeric: true, render: (s) => s.molarMass.toFixed(3), sortValue: (s) => s.molarMass },
        { key: 'phase', label: 'Estado', render: (s) => PHASE_LABEL[s.phase], sortValue: (s) => s.phase },
        { key: 'pka', label: 'pKa', numeric: true, render: (s) => s.acidBase?.pKa.map((p) => p.toFixed(2)).join(', ') ?? '—', sortValue: (s) => s.acidBase?.pKa[0] ?? 99 },
        {
          key: 'ghs', label: 'Peligros',
          render: (s) => s.safety.ghs.length
            ? h('div', { class: 'row', style: { gap: '4px' } }, ...s.safety.ghs.slice(0, 3).map((g) => badge(g, 'hazard')))
            : badge('sin clasificar', 'neutral'),
        },
        { key: 'cat', label: 'Categorías', render: (s) => h('span', { class: 'dim', style: { fontSize: 'var(--fs-3xs)' }, text: s.categories.join(', ') }) },
      ],
      rows: list,
      caption: `${list.length} sustancias. Cada una es una entidad única compartida por todos los módulos.`,
    }));
  });

  return screen({
    eyebrow: 'Mundo químico',
    title: 'Sustancias',
    lede: 'Una sola entidad por sustancia. El HCl que aparece aquí es el mismo que usa la valoración, '
      + 'el mismo que consulta el panel de seguridad y el mismo que entra en el equilibrio.',
  },
  h('div', { class: 'stack' },
    h('input', {
      class: 'field__input', type: 'search', placeholder: 'Filtrar por nombre, fórmula, CAS o categoría…',
      value: query.peek(),
      on: { input: (ev) => { const v = (ev.target as HTMLInputElement).value; query.set(v); setParam('q', v); } },
    }),
    listHost,
  ),
  );
}

function substanceView(id: string): HTMLElement {
  const s = substanceById(id);
  setContext([
    { label: 'Mundo químico', href: href('mundo') },
    { label: 'Sustancias', href: href('mundo/sustancias') },
    { label: s?.name ?? id },
  ]);
  if (!s) return screen({ title: 'Sustancia no encontrada' }, emptyState({ title: 'No existe esa sustancia' }));

  const dossier = substanceDossier(id);
  const analysis = elementalAnalysis(s.composition);
  const pattern = isotopePattern(s.composition, { threshold: 0.005 });

  return screen({
    eyebrow: `${s.categories.join(' · ')}${s.casNumber ? ` · CAS ${s.casNumber}` : ''}`,
    title: s.name,
    lede: s.role,
    actions: [
      s.moleculeId ? button('Ver en 3D', {
        iconName: 'molecula',
        on: { click: () => navigate(`mundo/molecula/${s.moleculeId}`) },
      }) : null,
    ].filter(Boolean) as Child[],
  },
  h('div', { class: 'stack stack--loose' },
    h('div', { class: 'grid grid--sidebar' },
      h('div', { class: 'stack' },
        panel({ title: 'Identidad' },
          h('div', { class: 'grid grid--2' },
            props([
              ['Fórmula', formulaEl(s.formula)],
              ['Masa molar', `${s.molarMass.toFixed(4)} g·mol⁻¹`],
              ['Masa monoisotópica', `${monoisotopic(s.composition).toFixed(5)} u`],
              ['Carga', s.charge === 0 ? 'neutra' : (s.charge > 0 ? `+${s.charge}` : String(s.charge))],
              ['Estado', PHASE_LABEL[s.phase]],
            ]),
            props([
              ['CAS', s.casNumber ?? 'no asignado'],
              ['Sinónimos', s.synonyms.length ? s.synonyms.join(', ') : '—'],
              ['Aspecto', s.physical.appearance ?? '—'],
            ], { textual: true }),
          ),
        ),

        panel({ title: 'Composición elemental' },
          h('div', { class: 'table-wrap' },
            h('table', { class: 'table table--compact' },
              h('thead', {}, h('tr', {},
                h('th', { text: 'Elemento' }), h('th', { text: 'Átomos' }),
                h('th', { text: 'Contribución (g·mol⁻¹)' }), h('th', { text: '% en masa' }),
              )),
              h('tbody', {}, ...analysis.map((a) => h('tr', {},
                h('td', { class: 'col-key' },
                  h('a', { href: href(`mundo/elemento/${a.element}`), text: a.element })),
                h('td', { class: 'col-num', text: String(a.atoms) }),
                h('td', { class: 'col-num', text: a.massContribution.toFixed(3) }),
                h('td', { class: 'col-num', text: a.massPercent.toFixed(2) }),
              ))),
            ),
          ),
        ),

        physicalPanel(s),
        s.acidBase ? acidBasePanel(s) : null,
        s.redox && s.redox.length > 0 ? redoxPanel(s) : null,
        s.thermo ? thermoPanel(s) : null,
        s.spectra ? spectraPanel(s, pattern) : null,
      ),

      h('div', { class: 'stack' },
        safetyPanel(s),
        dossier && dossier.relatedTopics.length > 0 && panel({ title: 'Dónde se estudia' },
          h('div', { class: 'stack stack--tight' },
            ...dossier.relatedTopics.map((t) =>
              h('a', { href: t.href, style: { fontSize: 'var(--fs-xs)' }, text: t.title })),
          ),
        ),
        s.reactsWith && s.reactsWith.length > 0 && panel({ title: 'Reacciona con' },
          h('div', { class: 'xlinks' },
            ...s.reactsWith.map((rid) => {
              const other = substanceById(rid);
              return other ? h('a', { class: 'xlink', href: href(`mundo/sustancia/${rid}`), text: other.name }) : null;
            }),
          ),
        ),
      ),
    ),
  ),
  );
}

function physicalPanel(s: NonNullable<ReturnType<typeof substanceById>>): HTMLElement {
  const p = s.physical;
  const rows: Array<[string, Child]> = [];
  if (p.meltingPoint) rows.push(['Fusión', `${p.meltingPoint} K (${kelvinToCelsius(p.meltingPoint).toFixed(1)} °C)`]);
  if (p.boilingPoint) rows.push(['Ebullición', `${p.boilingPoint} K (${kelvinToCelsius(p.boilingPoint).toFixed(1)} °C)`]);
  if (p.density) rows.push(['Densidad', `${p.density} g·mL⁻¹`]);
  if (p.viscosity) rows.push(['Viscosidad', `${p.viscosity} mPa·s`]);
  if (p.refractiveIndex) rows.push(['Índice de refracción', String(p.refractiveIndex)]);
  if (p.permittivity) rows.push(['Constante dieléctrica', String(p.permittivity)]);
  if (p.solubilityWater !== undefined) {
    rows.push(['Solubilidad en agua', p.solubilityWater === Infinity ? 'miscible' : `${p.solubilityWater} g/100 mL`]);
  }
  if (p.logP !== undefined) rows.push(['log P', String(p.logP)]);
  if (p.flashPoint) rows.push(['Punto de inflamación', `${kelvinToCelsius(p.flashPoint).toFixed(0)} °C`]);

  return panel({ title: 'Propiedades físicas' },
    rows.length > 0 ? props(rows) : h('p', { class: 'dim', text: 'Sin datos físicos tabulados.' }),
  );
}

function acidBasePanel(s: NonNullable<ReturnType<typeof substanceById>>): HTMLElement {
  const ab = s.acidBase!;
  const forms = [ab.fullyProtonated, ...ab.conjugates];

  return panel({
    title: 'Comportamiento ácido-base',
    actions: [button('Simular valoración', {
      size: 'sm', iconName: 'bureta',
      on: { click: () => navigate('laboratorio/titulacion', { params: { analito: s.id } }) },
    })],
  },
  h('div', { class: 'stack' },
    h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-2)' } },
      ...forms.map((f, i) => h('span', { class: 'row', style: { gap: 'var(--sp-2)' } },
        h('span', { class: 'chip' }, h('span', { html: formulaHtml(f) })),
        i < ab.pKa.length ? h('span', { class: 'mono dim', style: { fontSize: 'var(--fs-2xs)' },
          text: `⇌ pKa ${ab.pKa[i].toFixed(2)} ⇌` }) : null,
      )),
    ),
    ab.strong && note('info', null, 'Se considera ácido o base fuerte: en agua la disociación es esencialmente completa y el pKa tabulado es nominal.'),
    h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-5)' } },
      ...[1, 4, 7, 10, 13].map((pH) => h('div', { class: 'stack stack--tight' },
        h('span', { class: 'caps dim', text: `pH ${pH}` }),
        h('span', { class: 'formula', html: formulaHtml(dominantForm(s, pH)) }),
      )),
    ),
    h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' },
      text: 'La forma dominante a cada pH sale directamente de los pKa: por encima de un pKa domina la '
        + 'base conjugada de ese paso.' }),
  ),
  );
}

function redoxPanel(s: NonNullable<ReturnType<typeof substanceById>>): HTMLElement {
  return panel({ title: 'Comportamiento redox' },
    h('div', { class: 'stack stack--tight' },
      ...s.redox!.map((r) => h('div', { class: 'row row--between', style: { fontSize: 'var(--fs-xs)' } },
        h('span', {},
          h('span', { class: 'formula', text: r.halfReaction }),
          r.conditions ? h('span', { class: 'dim', style: { marginLeft: '8px', fontSize: 'var(--fs-3xs)' }, text: `(${r.conditions})` }) : null,
        ),
        h('span', { class: 'mono', text: `E° = ${r.E0 >= 0 ? '+' : ''}${r.E0.toFixed(4)} V` }),
      )),
    ),
  );
}

function thermoPanel(s: NonNullable<ReturnType<typeof substanceById>>): HTMLElement {
  const t = s.thermo!;
  const rows: Array<[string, Child]> = [];
  if (t.dHf !== undefined) rows.push(['ΔH°f', `${t.dHf} kJ·mol⁻¹`]);
  if (t.dGf !== undefined) rows.push(['ΔG°f', `${t.dGf} kJ·mol⁻¹`]);
  if (t.S0 !== undefined) rows.push(['S°', `${t.S0} J·mol⁻¹·K⁻¹`]);
  if (t.Cp !== undefined) rows.push(['Cp', `${t.Cp} J·mol⁻¹·K⁻¹`]);
  if (t.dHfus !== undefined) rows.push(['ΔH fusión', `${t.dHfus} kJ·mol⁻¹`]);
  if (t.dHvap !== undefined) rows.push(['ΔH vaporización', `${t.dHvap} kJ·mol⁻¹`]);

  return panel({ title: 'Termodinámica', subtitle: `Estado de referencia: ${PHASE_LABEL[t.phase]}` },
    props(rows),
  );
}

function spectraPanel(
  s: NonNullable<ReturnType<typeof substanceById>>,
  pattern: ReturnType<typeof isotopePattern>,
): HTMLElement {
  const sp = s.spectra!;
  const blocks: Child[] = [];

  if (sp.uv?.length) {
    blocks.push(h('div', {},
      h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'UV-Visible' }),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table table--compact' },
          h('thead', {}, h('tr', {},
            h('th', { text: 'λmax / nm' }), h('th', { text: 'ε / L·mol⁻¹·cm⁻¹' }),
            h('th', { text: 'Especie' }), h('th', { text: 'Asignación' }))),
          h('tbody', {}, ...sp.uv.map((b) => h('tr', {},
            h('td', { class: 'col-num', text: String(b.lambdaMax) }),
            h('td', { class: 'col-num', text: fmt(b.epsilon, { sig: 4 }) }),
            h('td', {}, b.species ? formulaEl(b.species) : '—'),
            h('td', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: b.assignment ?? '' }),
          ))),
        ),
      ),
    ));
  }

  if (sp.ir?.length) {
    const xs: number[] = [];
    for (let w = 400; w <= 4000; w += 2) xs.push(w);
    const ys = xs.map((w) => {
      let t = 1;
      for (const band of sp.ir!) {
        const sigma = band.width / 2.355;
        t -= band.intensity * 0.92 * Math.exp(-((w - band.wavenumber) ** 2) / (2 * sigma * sigma));
      }
      return Math.max(0.02, t) * 100;
    });

    blocks.push(h('div', {},
      h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Infrarrojo' }),
      plot({
        series: [{ id: 'ir', label: 'Transmitancia', x: xs, y: ys, kind: 'line', colour: 1, width: 1.3 }],
        x: { label: 'Número de onda', unit: 'cm⁻¹', reversed: true },
        y: { label: 'Transmitancia', unit: '%', domain: [0, 105] },
        height: 220,
        legend: false,
        annotations: sp.ir.filter((b) => b.intensity > 0.4).map((b) => ({
          x: b.wavenumber,
          y: Math.max(2, (1 - b.intensity * 0.92) * 100) - 4,
          text: `${b.wavenumber}`,
        })),
        caption: 'Espectro sintetizado a partir de las bandas tabuladas de esta sustancia. '
          + 'El eje va de derecha a izquierda, como es convención en infrarrojo.',
      }),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table table--compact' },
          h('thead', {}, h('tr', {},
            h('th', { text: 'cm⁻¹' }), h('th', { text: 'Intensidad' }), h('th', { text: 'Asignación' }))),
          h('tbody', {}, ...sp.ir.map((b) => h('tr', {},
            h('td', { class: 'col-num', text: String(b.wavenumber) }),
            h('td', { class: 'col-num', text: b.intensity.toFixed(2) }),
            h('td', { text: b.assignment }),
          ))),
        ),
      ),
    ));
  }

  if (sp.nmr?.length) {
    blocks.push(h('div', {},
      h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'RMN' }),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table table--compact' },
          h('thead', {}, h('tr', {},
            h('th', { text: 'Núcleo' }), h('th', { text: 'δ / ppm' }), h('th', { text: 'Integración' }),
            h('th', { text: 'Multiplicidad' }), h('th', { text: 'J / Hz' }), h('th', { text: 'Asignación' }))),
          h('tbody', {}, ...sp.nmr.map((n) => h('tr', {},
            h('td', { text: n.nucleus }),
            h('td', { class: 'col-num', text: n.shift.toFixed(2) }),
            h('td', { class: 'col-num', text: String(n.integration) }),
            h('td', { text: multiplicityName(n.neighbours) }),
            h('td', { class: 'col-num', text: n.J ? n.J.toFixed(1) : '—' }),
            h('td', { text: n.assignment }),
          ))),
        ),
      ),
    ));
  }

  // The isotope pattern is computed, not tabulated — worth saying so.
  if (pattern.length > 1) {
    blocks.push(h('div', {},
      h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Patrón isotópico del ion molecular' }),
      plot({
        series: [{
          id: 'iso', label: 'Intensidad relativa',
          x: pattern.map((p) => p.mz), y: pattern.map((p) => p.intensity),
          kind: 'sticks', colour: 4, width: 2.4,
        }],
        x: { label: 'm/z', pad: 0.08 },
        y: { label: 'Intensidad relativa', unit: '%', domain: [0, 108] },
        height: 200, legend: false,
        caption: 'Calculado por convolución de las abundancias isotópicas naturales de los elementos '
          + 'presentes: no es una tabla, es el resultado de la composición.',
      }),
    ));
  }

  if (sp.msFragments?.length) {
    blocks.push(h('div', {},
      h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Fragmentos característicos' }),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table table--compact' },
          h('thead', {}, h('tr', { }, h('th', { text: 'm/z' }), h('th', { text: 'Intensidad' }), h('th', { text: 'Asignación' }))),
          h('tbody', {}, ...sp.msFragments.map((f) => h('tr', {},
            h('td', { class: 'col-num', text: String(f.mz) }),
            h('td', { class: 'col-num', text: String(f.intensity) }),
            h('td', { text: f.assignment }),
          ))),
        ),
      ),
    ));
  }

  return panel({ title: 'Datos espectrales' }, h('div', { class: 'stack stack--loose' }, ...blocks));
}

const multiplicityName = (n: number): string =>
  ['singlete', 'doblete', 'triplete', 'cuadruplete', 'quintuplete', 'sextuplete', 'septuplete'][n] ?? `multiplete (${n + 1})`;

function safetyPanel(s: NonNullable<ReturnType<typeof substanceById>>): HTMLElement {
  const sf = s.safety;
  return panel({
    title: 'Seguridad',
    subtitle: sf.signal ?? undefined,
  },
  h('div', { class: 'stack' },
    sf.ghs.length > 0 ? hazardPictograms(sf.ghs, 44) : badge('Sin clasificación GHS', 'neutral'),
    sf.hazards.length > 0 && h('div', { class: 'stack stack--tight' },
      ...sf.hazards.map((hz) => h('div', { class: 'hazard-row' },
        h('span', { class: 'hazard-row__code', text: hz.code }),
        h('span', { text: hz.text }),
      )),
    ),
    h('div', { class: 'stack stack--tight' },
      h('div', { class: 'caps dim', text: 'Equipo de protección' }),
      h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-2)' } },
        ...sf.ppe.map((p) => h('span', { class: 'chip' }, icon('epp', { size: 12 }), p)),
      ),
    ),
    h('div', { class: 'stack stack--tight' },
      h('div', { class: 'caps dim', text: 'Almacenamiento' }),
      h('p', { style: { fontSize: 'var(--fs-xs)', color: 'var(--fg-secondary)' }, text: sf.storage }),
    ),
    sf.incompatibilities.length > 0 && h('div', { class: 'stack stack--tight' },
      h('div', { class: 'caps dim', text: 'Incompatible con' }),
      h('div', { class: 'xlinks' },
        ...sf.incompatibilities.map((iid) => {
          const other = substanceById(iid);
          return h('a', {
            class: 'xlink',
            style: { borderColor: 'var(--danger-border)', color: 'var(--danger)' },
            href: other ? href(`mundo/sustancia/${iid}`) : '#',
            text: other?.name ?? iid,
          });
        }),
      ),
    ),
    h('div', { class: 'stack stack--tight' },
      h('div', { class: 'caps dim', text: 'Residuos' }),
      h('p', { style: { fontSize: 'var(--fs-xs)', color: 'var(--fg-secondary)' } },
        icon('residuo', { size: 13, style: 'display:inline;vertical-align:-2px;margin-right:6px' }),
        sf.wasteStream),
    ),
    sf.exposureLimitPpm !== undefined && props([['Límite de exposición', `${sf.exposureLimitPpm} ppm (8 h)`]]),
    sf.notes?.length ? note('danger', 'Advertencias específicas',
      h('ul', { class: 'prose', style: { maxWidth: 'none' } }, ...sf.notes.map((n) => h('li', { text: n }))),
    ) : null,
  ),
  );
}

// ===========================================================================
// Molecules (§17, §18)
// ===========================================================================

function moleculeIndex(): HTMLElement {
  setContext([{ label: 'Mundo químico', href: href('mundo') }, { label: 'Moléculas' }]);
  return screen({
    eyebrow: 'Mundo químico',
    title: 'Moléculas',
    lede: 'Modelos tridimensionales con geometría real. Donde se conoce experimentalmente, las '
      + 'distancias y los ángulos son los medidos; donde no, la geometría está construida por RPECV '
      + 'y se indica como tal.',
  },
  h('div', { class: 'grid grid--3' },
    ...MOLECULES.map((m) => h('a', {
      class: 'card', href: href(`mundo/molecula/${m.id}`), style: { textDecoration: 'none' },
    },
    h('div', { class: 'card__label', text: m.geometrySource === 'experimental' ? 'Geometría experimental' : 'Geometría construida' }),
    h('div', { class: 'card__title', text: m.name }),
    h('div', { class: 'row', style: { gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' } },
      formulaEl(m.formula),
      h('span', { class: 'dim mono', style: { fontSize: 'var(--fs-3xs)' }, text: `${molecularMass(m).toFixed(2)} g·mol⁻¹` }),
    ),
    h('div', { class: 'card__meta' },
      `${m.atoms.length} átomos · ${m.bonds.length} enlaces`,
      m.pointGroup ? ` · ${m.pointGroup}` : '',
      m.dipole !== undefined ? ` · µ = ${m.dipole} D` : '',
    ),
    )),
  ),
  );
}

function moleculeView(id: string): HTMLElement {
  const m = moleculeById(id);
  setContext([
    { label: 'Mundo químico', href: href('mundo') },
    { label: 'Moléculas', href: href('mundo/moleculas') },
    { label: m?.name ?? id },
  ]);
  if (!m) return screen({ title: 'Molécula no encontrada' }, emptyState({ title: 'No existe esa molécula' }));

  const mode = signal<RenderMode>('bolas-varillas');
  const labels = signal(true);
  const hydrogens = signal(true);
  const rotate = signal(false);
  const currentMeasure = signal<MolMeasurement | null>(null);
  const selection = signal<number[]>([]);

  const viewer = new MoleculeViewer(m, {
    labels: true,
    onSelect: (s) => selection.set(s),
    onMeasure: (mm) => currentMeasure.set(mm),
  });

  effect(() => viewer.setMode(mode()));
  effect(() => viewer.setLabels(labels()));
  effect(() => viewer.setHydrogens(hydrogens()));
  effect(() => viewer.setAutoRotate(rotate()));

  const geometry = vseprOf(m, 0);
  const dipole = estimateDipole(m);
  const issues = validate(m);

  const measurePanel = h('div');
  effect(() => {
    const mm = currentMeasure();
    const sel = selection();
    replace(measurePanel,
      mm
        ? h('div', { class: 'stack stack--tight' },
          h('div', { class: 'readout' },
            h('div', { class: 'readout__label', text: mm.kind }),
            h('div', { class: 'readout__value', text: `${mm.value.toFixed(mm.kind === 'distancia' ? 3 : 2)}` },
              h('span', { class: 'num__unit', text: mm.unit })),
            h('div', { class: 'readout__sub', text: mm.label }),
          ),
          button('Limpiar selección', { size: 'sm', block: true, on: { click: () => viewer.clearSelection() } }),
        )
        : h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.5' },
          text: sel.length === 1
            ? 'Selecciona un segundo átomo para medir la distancia, un tercero para el ángulo y un cuarto para el diedro.'
            : 'Pulsa sobre dos átomos para medir su distancia, tres para un ángulo de enlace y cuatro para un ángulo diedro.' }),
    );
  });

  return screen({
    eyebrow: m.geometrySource === 'experimental' ? 'Geometría experimental' : 'Geometría construida por RPECV',
    title: m.name,
    lede: `${m.formula} · ${molecularMass(m).toFixed(3)} g·mol⁻¹`,
    actions: [
      button('Exportar coordenadas', {
        size: 'sm', iconName: 'exportar',
        on: {
          click: () => {
            const xyz = [`${m.atoms.length}`, `${m.name} — CHEMIA`,
              ...m.atoms.map((a) => `${a.element} ${a.x.toFixed(5)} ${a.y.toFixed(5)} ${a.z.toFixed(5)}`)].join('\n');
            download(`${m.id}.xyz`, xyz, 'chemical/x-xyz');
            toast({ tone: 'ok', title: 'Coordenadas exportadas', body: `${m.id}.xyz en formato XYZ estándar.` });
          },
        },
      }),
    ],
  },
  h('div', { class: 'grid grid--sidebar' },
    h('div', { class: 'stack' },
      panel({ title: 'Modelo tridimensional', flush: true },
        h('div', { style: { height: '440px', display: 'flex' } }, viewer.element),
        h('div', { class: 'plot__caption' },
          'Arrastra para rotar, rueda para acercar, Mayús+arrastre para desplazar. '
          + 'También responde a las flechas del teclado.'),
      ),
      issues.length > 0 && panel({ title: 'Validación de la estructura' },
        h('div', { class: 'stack stack--tight' },
          ...issues.map((i) => note(
            i.severity === 'error' ? 'danger' : i.severity === 'aviso' ? 'warn' : 'info',
            null, i.message + (i.suggestion ? ` ${i.suggestion}` : ''),
          )),
        ),
      ),
      m.notes && m.notes.length > 0 && panel({ title: 'Notas' },
        h('ul', { class: 'prose', style: { maxWidth: 'none' } }, ...m.notes.map((n) => h('li', { text: n }))),
      ),
    ),

    h('div', { class: 'stack' },
      panel({ title: 'Representación' },
        h('div', { class: 'stack' },
          h('div', { class: 'stack stack--tight' },
            ...(Object.keys(RENDER_MODE_LABEL) as RenderMode[]).map((k) => {
              const btn = button(RENDER_MODE_LABEL[k], {
                size: 'sm', block: true,
                on: { click: () => mode.set(k) },
              });
              effect(() => btn.setAttribute('aria-pressed', String(mode() === k)));
              return btn;
            }),
          ),
          h('div', { class: 'divider' }),
          h('div', { class: 'stack stack--tight' },
            switchRow('Etiquetas de átomo', labels),
            switchRow('Mostrar hidrógenos', hydrogens),
            switchRow('Rotación automática', rotate),
          ),
          button('Reiniciar vista', { size: 'sm', block: true, iconName: 'reiniciar', on: { click: () => viewer.resetView() } }),
        ),
      ),

      panel({ title: 'Medida' }, measurePanel),

      geometry && panel({ title: 'Geometría (RPECV)' },
        h('div', { class: 'stack stack--tight' },
          props([
            ['Número estérico', String(geometry.stericNumber)],
            ['Pares enlazantes', String(geometry.bondingPairs)],
            ['Pares solitarios', String(geometry.lonePairs)],
            ['Geometría electrónica', geometry.electronGeometry],
            ['Geometría molecular', geometry.molecularGeometry],
            ['Hibridación', geometry.hybridisation],
            ['Ángulo ideal', `${geometry.idealAngle}°`],
            ['Ángulo predicho', `${geometry.predictedAngle.toFixed(1)}°`],
          ]),
          h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.5' }, text: geometry.explanation }),
        ),
      ),

      panel({ title: 'Polaridad' },
        h('div', { class: 'stack stack--tight' },
          m.dipole !== undefined
            ? h('div', {},
              h('div', { class: 'caps dim', text: 'Momento dipolar experimental' }),
              h('div', { class: 'num num--lg', text: `${m.dipole} D` }),
            )
            : null,
          h('div', {},
            h('div', { class: 'caps dim', text: 'Estimación por vectores de enlace' }),
            h('div', { class: 'num', text: `${dipole.magnitude.toFixed(2)} D` }),
          ),
          note('info', null, dipole.note),
        ),
      ),

      panel({ title: 'Procedencia de la geometría' },
        note(m.geometrySource === 'experimental' ? 'ok' : 'warn', null,
          m.geometrySource === 'experimental'
            ? 'Las distancias y ángulos proceden de determinaciones experimentales (difracción o espectroscopia rotacional).'
            : 'La geometría está construida a partir de radios covalentes y de la disposición RPECV. '
              + 'Es cualitativamente correcta, pero no es un dato experimental ni el resultado de una optimización.'),
      ),
    ),
  ),
  );
}

function switchRow(label: string, sig: ReturnType<typeof signal<boolean>>): HTMLElement {
  const input = h('input', {
    type: 'checkbox',
    on: { change: (ev) => sig.set((ev.target as HTMLInputElement).checked) },
  });
  effect(() => { input.checked = sig(); });
  return h('label', { class: 'switch' },
    input,
    h('span', { class: 'switch__track' }),
    h('span', { class: 'switch__label', text: label }),
  );
}

// ===========================================================================
// Redox couple
// ===========================================================================

function redoxView(id: string): HTMLElement {
  const r = halfReactionById(id);
  setContext([
    { label: 'Mundo químico', href: href('mundo') },
    { label: 'Semirreacciones' },
    { label: r?.equation ?? id },
  ]);
  if (!r) return screen({ title: 'Semirreacción no encontrada' }, emptyState({ title: 'No existe esa semirreacción' }));

  // Show the pH dependence when there is one — the whole point of the couple.
  const pHs = Array.from({ length: 71 }, (_, i) => i * 0.2);
  const potentials = pHs.map((pH) => nernst(r, {}, { pH }).E);

  return screen({
    eyebrow: 'Semirreacción de reducción',
    title: r.equation,
    lede: r.notes,
  },
  h('div', { class: 'grid grid--sidebar' },
    h('div', { class: 'stack' },
      r.protons ? panel({ title: 'Dependencia del pH' },
        plot({
          series: [{ id: 'e', label: 'E', x: pHs, y: potentials, kind: 'line', colour: 1 }],
          x: { label: 'pH' },
          y: { label: 'Potencial de reducción', unit: 'V vs EEH' },
          height: 280,
          markers: [{ axis: 'y', value: 0, label: 'EEH' }],
          caption: `Con ${r.protons} protones y ${r.n} electrones, la pendiente es `
            + `${(-0.05916 * r.protons / r.n * 1000).toFixed(1)} mV por unidad de pH. `
            + 'Por eso un oxidante dependiente del pH pierde fuerza al alcalinizar el medio.',
        }),
      ) : note('info', null, 'Esta semirreacción no consume protones, de modo que su potencial no depende del pH.'),
      panel({ title: 'Serie electroquímica' },
        h('div', { class: 'table-wrap', style: { maxHeight: '420px', overflowY: 'auto' } },
          h('table', { class: 'table table--compact' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Semirreacción' }), h('th', { text: 'E° / V' }), h('th', { text: 'n' }))),
            h('tbody', {}, ...HALF_REACTIONS.map((x) => h('tr', {
              'aria-selected': x.id === id ? 'true' : undefined,
            },
            h('td', {}, h('a', { href: href(`mundo/redox/${encodeURIComponent(x.id)}`), text: x.equation })),
            h('td', { class: 'col-num', text: `${x.E0 >= 0 ? '+' : ''}${x.E0.toFixed(4)}` }),
            h('td', { class: 'col-num', text: String(x.n) }),
            ))),
          ),
        ),
      ),
    ),
    panel({ title: 'Datos' },
      props([
        ['E° a 25 °C', `${r.E0 >= 0 ? '+' : ''}${r.E0.toFixed(4)} V`],
        ['Electrones', String(r.n)],
        ['Protones', r.protons ? String(r.protons) : '0'],
        ['Categoría', r.category],
        ['Pendiente de Nernst', `${(59.16 / r.n).toFixed(2)} mV/década`],
      ]),
    ),
  ),
  );
}

void svg; void tabs; void buttonGroup; void measurement; void meas; void seriesToCsv; void boundingRadius;
