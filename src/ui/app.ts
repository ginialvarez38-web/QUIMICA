/**
 * CHEMICAL SANDBOX — controlador de la aplicacion.
 *
 * Une los motores con la interfaz. NO contiene quimica: cada vez que hace
 * falta una decision quimica, se la pide al motor correspondiente. Esa
 * separacion (§31) es lo que permite que el motor pueda usarse sin interfaz
 * — en pruebas, en un examen generado en servidor, o en una futura app movil.
 */

import { $, $$, delegate, escapeHtml, setPressed, num } from './dom.js';
import { search, LIBRARY_CATEGORIES, type SearchResult } from '../data/search.js';
import { getSpecies } from '../data/species.js';
import { parseFormula } from '../core/formula/parse.js';
import { formatPlainUnicode } from '../core/formula/render.js';
import { classifyFormula } from '../core/classify.js';
import { buildStructure } from '../geometry/vsepr.js';
import { MoleculeRenderer, DEFAULT_RENDER_OPTIONS, type Representation } from '../render/webgl/renderer.js';
import { predict, reactionsAvailableFor, type Prediction } from '../engine/predict.js';
import { findAllRoutes, compareRoutes, outgoingFrom, incomingTo } from '../engine/graph.js';
import { renderFicha, renderEstructura, renderBalance, renderProfesor, renderReactionCard, renderDerivation } from './inspector.js';
import { buildIonicFormula, type BuiltFormula } from '../core/build/ionicFormula.js';
import { getIon } from '../data/ions.js';
import type { Ion, Structure } from '../core/types.js';

type Mode = 'build' | 'react' | 'routes' | 'lab';
type Tab = 'ficha' | 'estructura' | 'balance' | 'profesor';

interface State {
  mode: Mode;
  tab: Tab;
  query: string;
  category: string;
  /** Sustancia seleccionada en la biblioteca. */
  selected: string | null;
  /** Reactivos en el banco. */
  bench: string[];
  predictions: Prediction[];
  activePrediction: Prediction | null;
  /** Atomos marcados con "seguir atomo" (§12). */
  followed: Set<string>;
  /** Ruta: origen y destino. */
  routeFrom: string;
  routeTo: string;
  /** Constructor de compuestos (§5, §7): los dos iones que se combinan. */
  builder: { cation: Ion | null; anion: Ion | null };
}

const state: State = {
  mode: 'build',
  tab: 'ficha',
  query: '',
  category: 'all',
  selected: null,
  bench: [],
  predictions: [],
  activePrediction: null,
  followed: new Set(),
  routeFrom: 'Ca',
  routeTo: 'CaCO3',
  builder: { cation: null, anion: null },
};

let renderer: MoleculeRenderer | null = null;
let currentStructure: Structure | null = null;

/**
 * Tema EFECTIVO, que no es lo mismo que el tema declarado.
 *
 * El atributo `data-theme` solo esta puesto cuando alguien ha elegido
 * explicitamente. Sin el, el tema lo decide la preferencia del sistema. Leer
 * unicamente el atributo produce un fallo concreto: un usuario con el sistema
 * en claro pulsa el conmutador, el codigo ve que el atributo "no es light",
 * deduce que estamos en oscuro y pone... claro. Nada cambia.
 */
function resolveTheme(): 'light' | 'dark' {
  const stamped = document.documentElement.dataset['theme'];
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Fondo del lienzo 3D por tema, en RGB normalizado. */
const CANVAS_BACKGROUND: Record<'light' | 'dark', [number, number, number]> = {
  light: [0.93, 0.945, 0.965],
  dark: [0.043, 0.055, 0.078],
};

// ---------------------------------------------------------------------------
// Estructura 3D
// ---------------------------------------------------------------------------

/** Construye la estructura de una formula, usando la clasificacion para saber
 *  si debe generarse como red ionica o como molecula. */
function structureFor(formula: string): Structure | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;

  const classification = classifyFormula(formula);
  const ionic = classification?.ionic ?? false;

  return buildStructure(formula, parsed.value.composition, {
    ionic,
    ...(classification?.cationSymbol ? { cation: classification.cationSymbol } : {}),
    ...(classification?.anionFormula ? { anion: classification.anionFormula } : {}),
  });
}

function showStructure(formula: string | null): void {
  currentStructure = formula ? structureFor(formula) : null;
  renderer?.setStructure(currentStructure);

  const empty = $('#viewport-empty');
  const badge = $('#viewport-badge');
  empty.hidden = currentStructure !== null;

  if (formula && currentStructure) {
    const species = getSpecies(formula);
    badge.hidden = false;
    badge.textContent = `${formatPlainUnicode(formula)}${species?.names.common ? ` · ${species.names.common}` : ''}`;
  } else {
    badge.hidden = true;
  }

  if (formula && !currentStructure) {
    empty.hidden = false;
    $('h2', empty).textContent = `Sin estructura 3D para ${formatPlainUnicode(formula)}`;
    $('p', empty).textContent =
      'El generador construye moleculas por VSEPR y redes ionicas, pero no adivina la conectividad de cualquier compuesto. Prefiere no mostrar nada antes que dibujar una geometria falsa. La ficha y el balance siguen disponibles.';
  }
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

function dotClass(result: SearchResult): string {
  const tags = result.tags;
  if (tags.includes('acid')) return 'acid';
  if (tags.includes('base') || tags.includes('hydroxide')) return 'base';
  if (tags.includes('salt')) return 'salt';
  if (tags.includes('oxide')) return 'oxide';
  if (tags.includes('organic')) return 'organic';
  if (tags.includes('element')) return 'element';
  return '';
}

function renderLibrary(): void {
  const category = LIBRARY_CATEGORIES.find((c) => c.id === state.category);
  const results = search(state.query, {
    ...(category?.tag ? { tag: category.tag } : {}),
    ...(category?.kind ? { kind: category.kind } : {}),
    limit: 120,
  });

  const list = $('#substance-list');

  if (results.length === 0) {
    // Si el filtro actual no da nada pero SI lo hay en el resto de la
    // biblioteca, se dice y se ofrece el salto. En modo Construir la lista
    // esta filtrada a iones, asi que buscar "HCl" no devolvia nada y el
    // mensaje generico no explicaba por que.
    const elsewhere = state.category === 'all' ? 0 : search(state.query, { limit: 5 }).length;

    list.innerHTML = elsewhere > 0
      ? `<div class="empty-state">
           Ningun resultado en <b>${escapeHtml(category?.label ?? '')}</b> para «${escapeHtml(state.query)}»,
           pero hay ${elsewhere === 5 ? '5 o mas' : elsewhere} en el resto de la biblioteca.
           ${state.mode === 'build' ? '<br><br>El constructor combina <b>iones</b>; las demas sustancias se pueden abrir para consultarlas.' : ''}
           <br><br><button class="button" data-category="all">Buscar en toda la biblioteca</button>
         </div>`
      : `<div class="empty-state">Sin resultados para «${escapeHtml(state.query)}».<br><br>Prueba con el nombre, el simbolo, la formula o un nombre comun: «calcio», «Ca», «CaO», «cal viva».</div>`;
    return;
  }

  list.innerHTML = results
    .map((r) => {
      // En modo Construir, los iones van al constructor; el resto se abre.
      const ionAttrs =
        r.ion !== undefined
          ? ` data-ion-formula="${escapeHtml(r.ion.formula)}" data-ion-charge="${r.ion.charge}"`
          : '';
      const action =
        state.mode === 'build' && r.ion
          ? `<span class="substance-action" title="${r.ion.charge > 0 ? 'Usar como cation' : 'Usar como anion'}">${r.ion.charge > 0 ? '+' : '−'}</span>`
          : `<button class="substance-add" data-add="${escapeHtml(r.formula)}" title="Anadir al banco de reaccion" aria-label="Anadir ${escapeHtml(r.formula)} al banco">+</button>`;

      return `<div class="substance-row">
        <button class="substance" data-formula="${escapeHtml(r.formula)}" data-kind="${r.kind}"${ionAttrs}
                 aria-current="${state.selected === r.formula}">
          <span class="substance-dot ${dotClass(r)}"></span>
          <span class="substance-formula">${escapeHtml(formatPlainUnicode(r.formula))}</span>
          <span class="substance-meta">
            <span class="substance-name">${escapeHtml(r.label)}</span>
            <span class="substance-class">${escapeHtml(r.sublabel)}</span>
          </span>
        </button>
        ${action}
      </div>`;
    })
    .join('');
}

function renderCategories(): void {
  $('#categories').innerHTML = LIBRARY_CATEGORIES.map(
    (c) => `<button class="chip" data-category="${c.id}" aria-pressed="${state.category === c.id}">${escapeHtml(c.label)}</button>`,
  ).join('');
}

// ---------------------------------------------------------------------------
// Constructor de compuestos (§5, §7)
// ---------------------------------------------------------------------------

/** Fórmula construida a partir de los dos iones elegidos, si ya hay ambos. */
function builtFormula(): BuiltFormula | null {
  const { cation, anion } = state.builder;
  if (!cation || !anion) return null;
  const result = buildIonicFormula(cation, anion);
  return result.ok ? result.value : null;
}

function chargeLabel(charge: number): string {
  const magnitude = Math.abs(charge);
  const digits = magnitude === 1 ? '' : String(magnitude);
  return `${digits}${charge > 0 ? '⁺' : '⁻'}`;
}

/**
 * Renderiza el constructor en la zona del banco.
 *
 * La interaccion es la mas directa posible: dos huecos, uno para el cation y
 * otro para el anion. Se rellenan haciendo clic en un ion de la biblioteca, y
 * en cuanto hay los dos aparece la formula. Sin teclas modificadoras ni
 * gestos ocultos.
 */
function renderConstructor(): void {
  const { cation, anion } = state.builder;
  const built = builtFormula();

  const slot = (role: 'cation' | 'anion', ion: Ion | null): string => {
    const isCation = role === 'cation';
    if (!ion) {
      return `<div class="build-slot empty" data-slot="${role}">
        <span class="build-slot-role">${isCation ? 'Cation (+)' : 'Anion (−)'}</span>
        <span class="build-slot-hint">Elige uno en la lista</span>
      </div>`;
    }
    return `<div class="build-slot" data-slot="${role}">
      <span class="build-slot-role">${isCation ? 'Cation' : 'Anion'}</span>
      <span class="build-slot-formula">${escapeHtml(formatPlainUnicode(ion.formula))}${chargeLabel(ion.charge)}</span>
      <span class="build-slot-name">${escapeHtml(ion.name)}</span>
      <button class="build-slot-clear" data-clear="${role}" aria-label="Quitar">×</button>
    </div>`;
  };

  const result = built
    ? `<div class="build-result">
         <span class="build-equals">=</span>
         <div>
           <div class="build-formula">${escapeHtml(built.display)}</div>
           <div class="build-check">${escapeHtml(built.neutralityCheck)}</div>
         </div>
       </div>`
    : `<div class="build-result pending"><span class="build-equals">=</span>
         <span class="build-slot-hint">${cation || anion ? 'Falta el otro ion' : 'Elige un cation y un anion'}</span>
       </div>`;

  $('#build-bar').innerHTML = `
    <div class="build-row">
      ${slot('cation', cation)}
      <span class="build-plus">+</span>
      ${slot('anion', anion)}
      ${result}
    </div>
    <div class="build-actions">
      <button class="button button-primary" id="build-open" ${built ? '' : 'disabled'}>Ver derivacion</button>
      <button class="button" id="build-bench" ${built ? '' : 'disabled'}>Al banco</button>
      <button class="button button-ghost" id="build-clear">Vaciar</button>
    </div>`;

  if (built) {
    showStructure(built.formula);
    state.selected = built.formula;
  }
}

/**
 * Franja de "que hacer ahora".
 *
 * No es un texto de ayuda fijo: cambia con el estado real. En el constructor
 * dice si falta el cation o el anion; en el banco, cuantas sustancias llevas.
 * Un cartel que siempre dice lo mismo se vuelve invisible en dos minutos; uno
 * que responde a lo que acabas de hacer, no.
 */
function renderModeHint(): void {
  const hint = $('#mode-hint');
  let icon = '';
  let text = '';
  let done = false;

  switch (state.mode) {
    case 'build': {
      const { cation, anion } = state.builder;
      if (!cation && !anion) {
        icon = '1';
        text = 'Elige un <b>cation</b> (marcado +) y un <b>anion</b> (marcado −) en la lista de la izquierda.';
      } else if (!cation) {
        icon = '2';
        text = 'Falta el <b>cation</b>: busca uno con la marca <b>+</b> en la lista.';
      } else if (!anion) {
        icon = '2';
        text = 'Falta el <b>anion</b>: busca uno con la marca <b>−</b> en la lista.';
      } else {
        icon = '✓';
        done = true;
        text = `Compuesto construido. Mira <b>como se llega a la formula</b>, paso a paso, en el analisis.`;
      }
      break;
    }

    case 'react': {
      const n = state.bench.length;
      if (n === 0) {
        icon = '1';
        text = 'Pulsa el boton <b>+</b> de dos sustancias de la lista para llevarlas al banco.';
      } else if (n === 1) {
        icon = '2';
        text = 'Ya hay una. Anade <b>otra sustancia</b> con el boton <b>+</b>.';
      } else if (state.predictions.length === 0) {
        icon = '3';
        text = 'Listo. Pulsa <b>Predecir</b> para ver que se forma y por que.';
      } else {
        icon = '✓';
        done = true;
        text = 'Usa <b>Explicame</b> en cualquier resultado para el analisis completo, o <b>Simular</b> para verlo en 3D.';
      }
      break;
    }

    case 'routes':
      icon = '⇢';
      text = 'Abre el <b>analisis</b> y escribe de donde partes y a donde quieres llegar. Prueba <b>S</b> → <b>H2SO4</b>.';
      break;

    case 'lab':
      icon = '⚗';
      text = 'El motor de cantidades esta operativo y probado; su interfaz es lo siguiente en la hoja de ruta.';
      break;
  }

  hint.className = done ? 'mode-hint done' : 'mode-hint';
  hint.innerHTML = `<span class="mode-hint-step">${icon}</span><span>${text}</span>`;
}

/** Coloca un ion en el hueco que le corresponde por su carga. */
function placeIon(ion: Ion): void {
  if (ion.charge > 0) state.builder.cation = ion;
  else state.builder.anion = ion;

  renderConstructor();
  renderLibrary();
  renderModeHint();

  if (builtFormula()) {
    state.tab = 'ficha';
    renderTabs();
  }
  renderInspector();
}

// ---------------------------------------------------------------------------
// Banco de reaccion
// ---------------------------------------------------------------------------

function renderBench(): void {
  const slots = $('#bench-slots');

  if (state.bench.length === 0) {
    slots.innerHTML = '<span class="bench-placeholder">Anade sustancias desde la biblioteca…</span>';
  } else {
    slots.innerHTML = state.bench
      .map(
        (f, i) =>
          `${i > 0 ? '<span class="bench-plus">+</span>' : ''}
           <span class="reagent">${escapeHtml(formatPlainUnicode(f))}
             <button class="reagent-remove" data-remove="${i}" aria-label="Quitar ${escapeHtml(f)}">×</button>
           </span>`,
      )
      .join('');
  }

  ($('#predict-button') as HTMLButtonElement).disabled = state.bench.length === 0;
  renderModeHint();
}

function renderPredictions(): void {
  const container = $('#bench-results');

  if (state.predictions.length === 0 && state.bench.length > 0) {
    return; // el mensaje lo pone runPrediction
  }

  container.innerHTML = state.predictions
    .map((p) => renderReactionCard(p, state.activePrediction?.id === p.id))
    .join('');
}

function runPrediction(): void {
  const result = predict(state.bench);
  state.predictions = [...result.predictions];
  state.activePrediction = result.predictions[0] ?? null;

  const container = $('#bench-results');
  const notice =
    result.predictions.length === 0
      ? `<div class="notice warn">${escapeHtml(result.message)}</div>`
      : result.conditionDependent
        ? `<div class="notice warn">${escapeHtml(result.message)}</div>`
        : '';

  container.innerHTML =
    notice + state.predictions.map((p) => renderReactionCard(p, state.activePrediction?.id === p.id)).join('');

  renderModeHint();

  if (state.activePrediction) {
    // Se muestra el primer producto en el visor: es lo que el usuario acaba
    // de "fabricar".
    const firstProduct = state.activePrediction.products[0];
    if (firstProduct) showStructure(firstProduct);
    state.tab = 'balance';
    renderTabs();
  }

  renderInspector();
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

function renderTabs(): void {
  setPressed($$('.inspector-tab'), (b) => b.dataset['tab'] === state.tab, 'aria-selected');
}

function renderInspector(): void {
  const content = $('#inspector-content');

  // El modo Rutas se apodera del inspector: es su vista natural.
  if (state.mode === 'routes') {
    content.innerHTML = renderRoutes();
    return;
  }

  switch (state.tab) {
    case 'ficha': {
      // En el constructor, lo primero que debe ver el estudiante es COMO se
      // ha llegado a la formula; la ficha del compuesto va justo debajo.
      const built = state.mode === 'build' ? builtFormula() : null;
      if (built) {
        content.innerHTML = renderDerivation(built) + renderFicha(built.formula);
      } else if (state.mode === 'build') {
        content.innerHTML =
          '<div class="empty-state">Elige un cation y un anion abajo, y aqui apareceran los seis pasos del razonamiento que llevan a la formula: los iones, la exigencia de neutralidad, el minimo comun multiplo, cuantos iones hacen falta, la comprobacion de cargas y la formula final.</div>';
      } else {
        content.innerHTML = state.selected
          ? renderFicha(state.selected)
          : '<div class="empty-state">Selecciona una sustancia en la biblioteca para ver su ficha completa: propiedades, nomenclatura en los tres sistemas y estados de oxidacion con su justificacion.</div>';
      }
      break;
    }
    case 'estructura':
      content.innerHTML = state.selected
        ? renderEstructura(state.selected, currentStructure)
        : '<div class="empty-state">Selecciona una sustancia para ver su geometria molecular y su estructura de Lewis.</div>';
      break;
    case 'balance':
      content.innerHTML = renderBalance(state.activePrediction);
      break;
    case 'profesor':
      content.innerHTML = renderProfesor(state.activePrediction, state.selected);
      break;
  }
}

// ---------------------------------------------------------------------------
// Rutas (§21, §22, §42)
// ---------------------------------------------------------------------------

function renderRoutes(): string {
  const routes = findAllRoutes(state.routeFrom, state.routeTo, { maxRoutes: 6 });

  const form = `
    <div class="section">
      <h3 class="section-title">Buscar una ruta</h3>
      <div class="field">
        <label class="field-label" for="route-from">Desde</label>
        <input class="field-input" id="route-from" value="${escapeHtml(state.routeFrom)}" spellcheck="false" />
      </div>
      <div class="field">
        <label class="field-label" for="route-to">Hasta</label>
        <input class="field-input" id="route-to" value="${escapeHtml(state.routeTo)}" spellcheck="false" />
      </div>
      <button class="button button-primary" id="route-search" style="width:100%">Buscar rutas</button>
    </div>`;

  if (routes.length === 0) {
    return `${form}
      <div class="notice warn">No se ha encontrado ninguna ruta de <strong>${escapeHtml(formatPlainUnicode(state.routeFrom))}</strong> a <strong>${escapeHtml(formatPlainUnicode(state.routeTo))}</strong> en la red de transformaciones.<br><br>Eso no significa que sea imposible: significa que la base de datos de reacciones de este sistema no contiene un camino. Prueba con otro destino, o comprueba que las formulas estan bien escritas.</div>`;
  }

  const routeCards = routes
    .map((route, i) => {
      const path = route.nodes
        .map((n) => `<span class="route-node" data-formula="${escapeHtml(n)}">${escapeHtml(formatPlainUnicode(n))}</span>`)
        .join('<span class="route-arrow">→</span>');

      const steps = route.steps
        .map(
          (s) => `<div class="route-step">
            <div class="route-step-equation">${escapeHtml(formatPlainUnicode(s.from))} ${s.reagents.length ? '+ ' + s.reagents.map((r) => escapeHtml(formatPlainUnicode(r))).join(' + ') : ''} → ${escapeHtml(formatPlainUnicode(s.to))}${s.byproducts.length ? ' + ' + s.byproducts.map((b) => escapeHtml(formatPlainUnicode(b))).join(' + ') : ''}</div>
            <div class="route-step-why">${escapeHtml(s.reaction.explanation)}</div>
            ${s.reaction.conditions.description ? `<div class="small faint" style="margin-top:3px">Condiciones: ${escapeHtml(s.reaction.conditions.description)}</div>` : ''}
          </div>`,
        )
        .join('');

      return `<div class="route">
        <div class="small faint" style="margin-bottom:5px">Ruta ${String.fromCharCode(65 + i)}</div>
        <div class="route-path">${path}</div>
        <div class="route-meta">${route.length} paso${route.length === 1 ? '' : 's'} · dificultad ${route.totalDifficulty} · reactivos: ${route.requiredReagents.map((r) => formatPlainUnicode(r)).join(', ') || 'ninguno'}</div>
        ${steps}
      </div>`;
    })
    .join('');

  // Comparacion de las dos primeras rutas (§42).
  let comparison = '';
  if (routes.length >= 2) {
    const cmp = compareRoutes(routes[0]!, routes[1]!);
    const rows = cmp.rows
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.criterion)}</td>
          <td class="${r.better === 'a' ? 'tally-ok' : ''}">${escapeHtml(r.a)}</td>
          <td class="${r.better === 'b' ? 'tally-ok' : ''}">${escapeHtml(r.b)}</td>
        </tr>`,
      )
      .join('');
    comparison = `
      <div class="section">
        <h3 class="section-title">Comparacion A / B</h3>
        <table class="tally-table">
          <thead><tr><th>Criterio</th><th>Ruta A</th><th>Ruta B</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="small muted" style="margin-top:8px">${escapeHtml(cmp.summary)}</p>
      </div>`;
  }

  return `${form}<div class="section"><h3 class="section-title">${routes.length} ruta${routes.length === 1 ? '' : 's'} encontrada${routes.length === 1 ? '' : 's'}</h3>${routeCards}</div>${comparison}`;
}

/** "¿Que puedo hacer con este compuesto?" (§20) */
function renderAvailableReactions(formula: string): void {
  const available = reactionsAvailableFor(formula);
  const container = $('#bench-results');

  if (available.length === 0) {
    const incoming = incomingTo(formula);
    container.innerHTML = `<div class="notice info">No hay reacciones curadas que partan de <strong>${escapeHtml(formatPlainUnicode(formula))}</strong>.
      ${incoming.length ? `<br><br>Si hay ${incoming.length} forma${incoming.length === 1 ? '' : 's'} de OBTENERLO: prueba el modo Rutas.` : ''}
      <br><br>Tambien puedes anadir otra sustancia al banco y pulsar Predecir: el motor aplicara sus reglas aunque no exista una entrada curada.</div>`;
    return;
  }

  state.predictions = [...available];
  state.activePrediction = null;
  container.innerHTML =
    `<div class="notice info">${available.length} transformacion${available.length === 1 ? '' : 'es'} disponible${available.length === 1 ? '' : 's'} desde ${escapeHtml(formatPlainUnicode(formula))}. Cada una indica sus condiciones y su nivel de dificultad.</div>` +
    available.map((p) => renderReactionCard(p, false)).join('');
}

// ---------------------------------------------------------------------------
// Etiquetas de atomos en el visor
// ---------------------------------------------------------------------------

function updateAtomLabels(): void {
  if (!renderer) return;
  const overlay = $('#overlay');

  if (!renderer.getOptions().showLabels || !currentStructure) {
    overlay.innerHTML = '';
    return;
  }

  const positions = renderer.atomPositions();
  // Con demasiados atomos las etiquetas estorban mas de lo que ayudan.
  if (positions.length > 40) {
    overlay.innerHTML = '';
    return;
  }

  const parts: string[] = [];
  for (const atom of positions) {
    const p = renderer.project(atom.position);
    if (!p.visible) continue;
    const followed = state.followed.has(atom.id);
    parts.push(
      `<div class="atom-label" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px${followed ? ';border-color:var(--hazard-special);color:var(--hazard-special)' : ''}">${escapeHtml(atom.symbol)}${followed ? ' ◎' : ''}</div>`,
    );
  }
  overlay.innerHTML = parts.join('');
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/**
 * Cambia de modo y, sobre todo, hace que el cambio SE NOTE.
 *
 * Antes las pestanas apenas alteraban nada visible, asi que parecian rotas.
 * Ahora cada modo reconfigura la biblioteca, la zona inferior y el inspector:
 *
 *   Construir   iones en la lista, constructor abajo
 *   Reaccionar  sustancias en la lista, banco de reaccion abajo
 *   Rutas       buscador de rutas en el inspector
 *   Laboratorio estado del modulo de cantidades
 */
function setMode(mode: Mode): void {
  state.mode = mode;
  setPressed($$('.mode-tab'), (b) => b.dataset['mode'] === mode, 'aria-selected');

  $('#build-bar').hidden = mode !== 'build';
  $('#bench-bar').hidden = mode === 'build';

  switch (mode) {
    case 'build':
      // La lista pasa a mostrar iones: son las piezas del constructor.
      state.category = 'ions';
      renderCategories();
      renderConstructor();
      $('#bench-results').innerHTML = builtFormula()
        ? ''
        : `<div class="notice info"><strong>Construye un compuesto.</strong> Elige un <strong>cation</strong> (carga +) y un <strong>anion</strong> (carga −) de la lista de la izquierda. El sistema calculara la formula neutra y te ensenara los seis pasos del razonamiento, incluida la comprobacion de cargas.</div>`;
      break;

    case 'react':
      if (state.category === 'ions') state.category = 'all';
      renderCategories();
      renderBench();
      if (state.predictions.length === 0) {
        $('#bench-results').innerHTML = `<div class="notice info"><strong>Haz reaccionar dos sustancias.</strong> Pulsa el boton <strong>+</strong> de cualquier sustancia de la lista para anadirla al banco, y despues <strong>Predecir</strong>. El motor te dira que se forma y por que — o por que no ocurre nada.</div>`;
      }
      break;

    case 'routes':
      if (state.selected) state.routeTo = state.selected;
      break;

    case 'lab':
      $('#bench-results').innerHTML = renderLabNotice();
      break;
  }

  renderLibrary();
  renderModeHint();
  renderInspector();
}

function selectSubstance(formula: string): void {
  state.selected = formula;
  state.followed.clear();
  showStructure(formula);
  renderLibrary();
  if (state.tab === 'balance' && !state.activePrediction) state.tab = 'ficha';
  renderTabs();
  renderInspector();
  if (state.mode === 'react') renderAvailableReactions(formula);
}

function addToBench(formula: string): void {
  if (state.bench.includes(formula)) return;
  if (state.bench.length >= 4) state.bench.shift();
  state.bench.push(formula);
  renderBench();
}

// ---------------------------------------------------------------------------
// Linea temporal de la reaccion (§13)
// ---------------------------------------------------------------------------

const PHASES = ['Preparacion', 'Colision', 'Interaccion', 'Reorganizacion', 'Productos'];
let timelineProgress = 0;
let timelinePlaying = false;
let timelineSpeed = 1;
let lastFrameTime = 0;

function tickTimeline(now: number): void {
  if (timelinePlaying) {
    const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
    timelineProgress = Math.min(1, timelineProgress + dt * 0.28 * timelineSpeed);
    if (timelineProgress >= 1) {
      timelinePlaying = false;
      $('#play-button').textContent = '▶';
    }
    updateTimelineUI();
  }
  lastFrameTime = now;
}

function updateTimelineUI(): void {
  $('#timeline-fill').style.width = `${(timelineProgress * 100).toFixed(1)}%`;
  const phaseIndex = Math.min(PHASES.length - 1, Math.floor(timelineProgress * PHASES.length));
  $('#timeline-phase').textContent = PHASES[phaseIndex]!;

  // La estructura mostrada cambia con la fase: reactivos al principio,
  // productos al final. Es una animacion honesta: no simula el mecanismo
  // real, muestra la transicion entre estados conocidos.
  const prediction = state.activePrediction;
  if (!prediction) return;
  const target =
    timelineProgress < 0.5 ? prediction.reactants[0] : prediction.products[0];
  if (target) {
    const next = structureFor(target);
    if (next && next !== currentStructure) {
      const badge = $('#viewport-badge');
      badge.hidden = false;
      badge.textContent = `${formatPlainUnicode(target)} · ${PHASES[phaseIndex]}`;
      currentStructure = next;
      renderer?.setStructure(next);
    }
  }
}

function startSimulation(prediction: Prediction): void {
  state.activePrediction = prediction;
  timelineProgress = 0;
  timelinePlaying = true;
  lastFrameTime = 0;
  $('#timeline').hidden = false;
  $('#play-button').textContent = '⏸';
  updateTimelineUI();
  renderPredictions();
  renderInspector();
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

function wireEvents(): void {
  // --- Biblioteca --------------------------------------------------------
  const searchInput = $<HTMLInputElement>('#search');
  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    renderLibrary();
  });

  delegate($('#categories'), 'click', '[data-category]', (_e, target) => {
    state.category = target.dataset['category']!;
    renderCategories();
    renderLibrary();
  });

  delegate($('#substance-list'), 'click', '.substance', (_e, target) => {
    // En modo Construir, un ion va directo al constructor.
    const ionFormula = target.dataset['ionFormula'];
    const ionCharge = target.dataset['ionCharge'];
    if (state.mode === 'build' && ionFormula && ionCharge) {
      const ion = getIon(ionFormula, Number(ionCharge));
      if (ion) {
        placeIon(ion);
        return;
      }
    }

    const formula = target.dataset['formula']!;
    // En modo Reaccionar, elegir una sustancia la anade al banco: es lo que
    // se espera de ese modo, y ademas se abre su ficha.
    if (state.mode === 'react') addToBench(formula);
    selectSubstance(formula);
  });

  // Salto a "Todo" desde el estado vacio de la lista.
  delegate($('#substance-list'), 'click', '[data-category]', (_e, target) => {
    state.category = target.dataset['category']!;
    renderCategories();
    renderLibrary();
  });

  // Boton "+" explicito: anadir al banco sin teclas modificadoras.
  delegate($('#substance-list'), 'click', '[data-add]', (event, target) => {
    event.stopPropagation();
    addToBench(target.dataset['add']!);
    if (state.mode !== 'react') setMode('react');
  });

  // --- Constructor -------------------------------------------------------
  delegate($('#build-bar'), 'click', '[data-clear]', (_e, target) => {
    if (target.dataset['clear'] === 'cation') state.builder.cation = null;
    else state.builder.anion = null;
    renderConstructor();
    renderLibrary();
    renderModeHint();
    renderInspector();
  });

  delegate($('#build-bar'), 'click', '#build-clear', () => {
    state.builder = { cation: null, anion: null };
    renderConstructor();
    renderLibrary();
    renderModeHint();
    renderInspector();
  });

  delegate($('#build-bar'), 'click', '#build-open', () => {
    const built = builtFormula();
    if (built) selectSubstance(built.formula);
  });

  delegate($('#build-bar'), 'click', '#build-bench', () => {
    const built = builtFormula();
    if (!built) return;
    addToBench(built.formula);
    setMode('react');
  });

  // --- Banco -------------------------------------------------------------
  delegate($('#bench-slots'), 'click', '[data-remove]', (_e, target) => {
    state.bench.splice(Number(target.dataset['remove']), 1);
    renderBench();
  });

  $('#predict-button').addEventListener('click', runPrediction);
  $('#clear-button').addEventListener('click', () => {
    state.bench = [];
    state.predictions = [];
    state.activePrediction = null;
    $('#bench-results').innerHTML = '';
    $('#timeline').hidden = true;
    renderBench();
    renderInspector();
  });

  delegate($('#bench-results'), 'click', '[data-action]', (_e, target) => {
    const card = target.closest<HTMLElement>('[data-prediction]');
    const action = target.dataset['action'];

    if (action === 'open') {
      const formula = target.dataset['formula'];
      if (formula) selectSubstance(formula);
      return;
    }

    if (!card) return;
    const prediction = state.predictions.find((p) => p.id === card.dataset['prediction']);
    if (!prediction) return;

    state.activePrediction = prediction;
    switch (action) {
      case 'simulate':
        startSimulation(prediction);
        break;
      case 'explain':
        state.tab = 'profesor';
        renderTabs();
        renderInspector();
        renderPredictions();
        break;
      case 'balance':
      case 'select':
        state.tab = 'balance';
        renderTabs();
        renderInspector();
        renderPredictions();
        break;
    }
  });

  // --- Inspector ---------------------------------------------------------
  delegate($('#inspector-tabs'), 'click', '[data-tab]', (_e, target) => {
    state.tab = target.dataset['tab'] as Tab;
    renderTabs();
    renderInspector();
  });

  // Rutas: los nodos son clicables y el formulario relanza la busqueda.
  delegate($('#inspector-content'), 'click', '[data-formula]', (_e, target) => {
    selectSubstance(target.dataset['formula']!);
  });

  delegate($('#inspector-content'), 'click', '#route-search', () => {
    state.routeFrom = $<HTMLInputElement>('#route-from').value.trim() || state.routeFrom;
    state.routeTo = $<HTMLInputElement>('#route-to').value.trim() || state.routeTo;
    renderInspector();
  });

  // --- Modos -------------------------------------------------------------
  delegate($('#mode-tabs'), 'click', '[data-mode]', (_e, target) => {
    setMode(target.dataset['mode'] as Mode);
  });

  // --- Barra del visor ---------------------------------------------------
  delegate($('.viewport-toolbar'), 'click', '[data-repr]', (_e, target) => {
    const repr = target.dataset['repr'] as Representation;
    renderer?.setOptions({ representation: repr });
    setPressed($$('[data-repr]'), (b) => b.dataset['repr'] === repr);
  });

  delegate($('.viewport-toolbar'), 'click', '[data-toggle]', (_e, target) => {
    const which = target.dataset['toggle'];
    const options = renderer?.getOptions();
    if (!options) return;
    if (which === 'bonds') {
      renderer?.setOptions({ showBonds: !options.showBonds });
      target.setAttribute('aria-pressed', String(!options.showBonds));
    } else if (which === 'labels') {
      renderer?.setOptions({ showLabels: !options.showLabels });
      target.setAttribute('aria-pressed', String(!options.showLabels));
    }
  });

  // --- Seguir atomo (§12) ------------------------------------------------
  $('#gl-canvas').addEventListener('click', (event) => {
    const mouse = event as MouseEvent;
    const hit = renderer?.pick(mouse.clientX, mouse.clientY);
    if (!hit) return;
    if (state.followed.has(hit.atomId)) state.followed.delete(hit.atomId);
    else state.followed.add(hit.atomId);
    renderer?.setOptions({ highlighted: new Set(state.followed) });
  });

  // --- Linea temporal ----------------------------------------------------
  $('#play-button').addEventListener('click', () => {
    if (timelineProgress >= 1) timelineProgress = 0;
    timelinePlaying = !timelinePlaying;
    lastFrameTime = 0;
    $('#play-button').textContent = timelinePlaying ? '⏸' : '▶';
  });

  $('#restart-button').addEventListener('click', () => {
    timelineProgress = 0;
    timelinePlaying = false;
    lastFrameTime = 0;
    $('#play-button').textContent = '▶';
    updateTimelineUI();
  });

  $<HTMLSelectElement>('#speed-select').addEventListener('change', (event) => {
    timelineSpeed = Number((event.target as HTMLSelectElement).value);
  });

  $('#timeline-track').addEventListener('click', (event) => {
    const mouse = event as MouseEvent;
    const track = $('#timeline-track');
    const rect = track.getBoundingClientRect();
    timelineProgress = Math.max(0, Math.min(1, (mouse.clientX - rect.left) / rect.width));
    updateTimelineUI();
  });

  // --- Tema --------------------------------------------------------------
  $('#theme-toggle').addEventListener('click', () => {
    const next = resolveTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem('sandbox-theme', next);
    } catch {
      // El almacenamiento puede estar bloqueado; el tema simplemente no
      // persistira entre sesiones. No es motivo para romper nada.
    }
    renderer?.setOptions({ background: CANVAS_BACKGROUND[next] });
  });

  // --- Panel movil -------------------------------------------------------
  const toggleSheet = (open: boolean): void => {
    const app = $('#app');
    if (open) app.dataset['sheet'] = 'open';
    else delete app.dataset['sheet'];
    $('#mobile-switch').textContent = open ? 'Cerrar' : 'Analisis';
  };

  $('#mobile-switch').addEventListener('click', () => {
    toggleSheet($('#app').dataset['sheet'] !== 'open');
  });
  $('#sheet-backdrop').addEventListener('click', () => toggleSheet(false));
  $('#sheet-close').addEventListener('click', () => toggleSheet(false));

  // Escape cierra la hoja, como cualquier capa modal.
  document.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') toggleSheet(false);
  });

  // --- Zoom con botones ---------------------------------------------------
  $('#zoom-in').addEventListener('click', () => renderer?.zoom('in'));
  $('#zoom-out').addEventListener('click', () => renderer?.zoom('out'));
}

function renderLabNotice(): string {
  return `<div class="notice info">
    <strong>Laboratorio virtual</strong> — en construccion.<br><br>
    El motor de cantidades ya esta operativo y cubierto por pruebas: conversion entre gramos, moles, litros y molaridad; reactivo limitante y exceso; rendimiento teorico y porcentual; volumen de gas y ley de los gases ideales.
    Lo que falta es la capa visual de material de vidrio (vasos, buretas, pipetas) y el trasvase entre recipientes.<br><br>
    Ver <span class="mono">src/engine/stoichiometry.ts</span> y las pruebas correspondientes, donde el ejemplo del brief —2,00 g de CaCO₃ en 50 mL de HCl 1,0 M— se resuelve completo: limitante, exceso y volumen de CO₂ desprendido.
  </div>`;
}

function boot(): void {
  // Tema guardado.
  try {
    const saved = localStorage.getItem('sandbox-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset['theme'] = saved;
  } catch {
    // sin persistencia; se usa el tema por defecto
  }

  // Renderizador 3D. Si WebGL2 no esta disponible, la aplicacion sigue
  // funcionando: se pierde el visor, no la quimica.
  try {
    renderer = new MoleculeRenderer($<HTMLCanvasElement>('#gl-canvas'));
    renderer.setOptions({
      ...DEFAULT_RENDER_OPTIONS,
      background: CANVAS_BACKGROUND[resolveTheme()],
    });

    // Si el usuario no ha elegido tema, el lienzo debe seguir al sistema
    // cuando este cambie: el CSS lo hace solo, pero el color de fondo de
    // WebGL se fija por codigo y hay que actualizarlo a mano.
    globalThis.matchMedia?.('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (!document.documentElement.dataset['theme']) {
        renderer?.setOptions({ background: CANVAS_BACKGROUND[resolveTheme()] });
      }
    });
    renderer.start(() => {
      updateAtomLabels();
      tickTimeline(performance.now());
    });
  } catch (error) {
    $('#viewport-empty').hidden = false;
    $('h2', $('#viewport-empty')).textContent = 'Visor 3D no disponible';
    $('p', $('#viewport-empty')).textContent =
      `${error instanceof Error ? error.message : 'WebGL2 no esta disponible.'} El resto del sandbox funciona con normalidad: biblioteca, prediccion de reacciones, balanceo, rutas y modo profesor.`;
  }

  renderCategories();
  renderLibrary();
  renderBench();
  renderTabs();
  wireEvents();

  // Se arranca en el constructor con un ejemplo ya montado: el calcio y el
  // oxido, que dan la cal viva y abren la cadena del calcio. Ver algo
  // construido explica el modo mejor que cualquier texto de ayuda.
  state.builder.cation = getIon('Ca', 2) ?? null;
  state.builder.anion = getIon('O', -2) ?? null;
  setMode('build');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
