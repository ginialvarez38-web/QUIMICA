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
import { renderFicha, renderEstructura, renderBalance, renderProfesor, renderReactionCard } from './inspector.js';
import type { Structure } from '../core/types.js';

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
};

let renderer: MoleculeRenderer | null = null;
let currentStructure: Structure | null = null;

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
    list.innerHTML = `<div class="empty-state">Sin resultados para «${escapeHtml(state.query)}».<br><br>Prueba con el nombre, el simbolo, la formula o un nombre comun: «calcio», «Ca», «CaO», «cal viva».</div>`;
    return;
  }

  list.innerHTML = results
    .map(
      (r) => `<button class="substance" data-formula="${escapeHtml(r.formula)}" data-kind="${r.kind}"
                 aria-current="${state.selected === r.formula}">
        <span class="substance-dot ${dotClass(r)}"></span>
        <span class="substance-formula">${escapeHtml(formatPlainUnicode(r.formula))}</span>
        <span class="substance-meta">
          <span class="substance-name">${escapeHtml(r.label)}</span>
          <span class="substance-class">${escapeHtml(r.sublabel)}</span>
        </span>
      </button>`,
    )
    .join('');
}

function renderCategories(): void {
  $('#categories').innerHTML = LIBRARY_CATEGORIES.map(
    (c) => `<button class="chip" data-category="${c.id}" aria-pressed="${state.category === c.id}">${escapeHtml(c.label)}</button>`,
  ).join('');
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
    case 'ficha':
      content.innerHTML = state.selected
        ? renderFicha(state.selected)
        : '<div class="empty-state">Selecciona una sustancia en la biblioteca para ver su ficha completa: propiedades, nomenclatura en los tres sistemas y estados de oxidacion con su justificacion.</div>';
      break;
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
      `<div class="atom-label" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px${followed ? ';border-color:#f5b342;color:#f5b342' : ''}">${escapeHtml(atom.symbol)}${followed ? ' ◎' : ''}</div>`,
    );
  }
  overlay.innerHTML = parts.join('');
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

function selectSubstance(formula: string): void {
  state.selected = formula;
  state.followed.clear();
  showStructure(formula);
  renderLibrary();
  if (state.tab === 'balance' && !state.activePrediction) state.tab = 'ficha';
  renderTabs();
  renderInspector();
  if (state.mode === 'build') renderAvailableReactions(formula);
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

  delegate($('#substance-list'), 'click', '.substance', (event, target) => {
    const formula = target.dataset['formula']!;
    // Con Alt o en modo Reaccionar, se anade al banco en lugar de abrirlo.
    const mouse = event as MouseEvent;
    if (mouse.altKey || state.mode === 'react') {
      addToBench(formula);
      if (mouse.altKey) return;
    }
    selectSubstance(formula);
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
    state.mode = target.dataset['mode'] as Mode;
    setPressed($$('.mode-tab'), (b) => b.dataset['mode'] === state.mode, 'aria-selected');

    if (state.mode === 'routes') {
      if (state.selected) state.routeTo = state.selected;
      renderInspector();
    } else if (state.mode === 'build' && state.selected) {
      renderAvailableReactions(state.selected);
      renderInspector();
    } else if (state.mode === 'lab') {
      $('#bench-results').innerHTML = renderLabNotice();
      renderInspector();
    } else {
      renderInspector();
    }
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
    const root = document.documentElement;
    const next = root.dataset['theme'] === 'light' ? 'dark' : 'light';
    root.dataset['theme'] = next;
    try {
      localStorage.setItem('sandbox-theme', next);
    } catch {
      // El almacenamiento puede estar bloqueado; el tema simplemente no
      // persistira entre sesiones. No es motivo para romper nada.
    }
    renderer?.setOptions({
      background: next === 'light' ? [0.93, 0.945, 0.965] : [0.043, 0.055, 0.078],
    });
  });

  // --- Panel movil -------------------------------------------------------
  $('#mobile-switch').addEventListener('click', () => {
    const app = $('#app');
    app.dataset['mobilePanel'] = app.dataset['mobilePanel'] === 'inspector' ? 'library' : 'inspector';
  });
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
      background:
        document.documentElement.dataset['theme'] === 'light'
          ? [0.93, 0.945, 0.965]
          : [0.043, 0.055, 0.078],
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
  renderInspector();
  wireEvents();

  // Sustancia de bienvenida: el CaO es el hilo conductor del brief.
  selectSubstance('CaO');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
