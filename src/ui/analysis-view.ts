/**
 * VISTA DEL CHEMICAL ANALYSIS ENGINE (§50, §61, §66).
 *
 * Presenta el perfil completo de una especie y, sobre todo, implementa la
 * navegacion «¿POR QUE?».
 *
 * LA DECISION QUE GOBIERNA ESTE ARCHIVO
 * Ningun texto explicativo se escribe aqui. Todo lo que se muestra sale de los
 * hallazgos que produjo el motor, incluidas las razones. Esta vista solo sabe
 * dibujar un hallazgo y seguir sus aristas hacia abajo. La consecuencia es que
 * la explicacion no puede desincronizarse del calculo: si el motor cambia de
 * opinion, el texto cambia con el.
 *
 * El descenso no tiene fondo prefijado: se puede seguir preguntando «¿por que?»
 * hasta llegar a la formula de partida, que es lo que pide el §66.
 */

import type { AnalysisProfile } from '../analysis/analyze.js';
import type { Finding } from '../analysis/findings.js';
import {
  SECTION_LABEL,
  LEVEL_LABEL,
  CONFIDENCE_LABEL,
  CONFIDENCE_NOTE,
} from '../analysis/findings.js';
import { escapeHtml } from './dom.js';

/** Iconos por seccion. Ayudan a localizar un bloque sin leer el titulo. */
const SECTION_ICON: Record<string, string> = {
  identidad: '🏷',
  composicion: '∑',
  atomos: '⚛',
  electrones: '◉',
  lewis: '⋮',
  resonancia: '↔',
  enlaces: '—',
  hibridacion: '⌬',
  geometria: '△',
  polaridad: '⇢',
  intermoleculares: '⋯',
  propiedades: '🌡',
  'acido-base': '⇌',
  redox: '⚡',
  reactividad: '✦',
};

function chip(finding: Finding): string {
  return (
    `<span class="conf conf-${finding.confidence}" title="${escapeHtml(CONFIDENCE_NOTE[finding.confidence])}">` +
    `${escapeHtml(CONFIDENCE_LABEL[finding.confidence])}</span>`
  );
}

function stepsHtml(finding: Finding): string {
  if (!finding.steps || finding.steps.length === 0) return '';
  return (
    '<ol class="why-steps">' +
    finding.steps
      .map(
        (s) =>
          `<li>${escapeHtml(s.text)}${s.math ? `<code class="why-math">${escapeHtml(s.math)}</code>` : ''}</li>`,
      )
      .join('') +
    '</ol>'
  );
}

/**
 * Una tarjeta de resultado con su boton «¿por que?».
 *
 * El boton solo aparece si el hallazgo TIENE de que depender. Un boton que no
 * lleva a ninguna parte enseña al usuario a no pulsarlo, y entonces deja de
 * pulsarlo tambien donde si lleva.
 */
function findingCard(finding: Finding, hasDependencies: boolean): string {
  return `
    <article class="finding" data-finding="${escapeHtml(finding.id)}">
      <header class="finding-head">
        <span class="finding-label">${escapeHtml(finding.label)}</span>
        ${chip(finding)}
      </header>
      <div class="finding-value">${escapeHtml(finding.value)}</div>
      ${
        hasDependencies
          ? `<button class="why-button" data-why="${escapeHtml(finding.id)}">¿Por que? →</button>`
          : `<p class="finding-because">${escapeHtml(finding.because)}</p>`
      }
    </article>`;
}

/**
 * El perfil completo, agrupado por secciones y filtrado por nivel (§48).
 */
export function renderAnalysis(profile: AnalysisProfile, level: number): string {
  const visible = profile.graph.upToLevel(level);
  const sections = [...new Set(visible.map((f) => f.section))];

  const breakdown = profile.graph.confidenceBreakdown();
  const totals = Object.entries(breakdown)
    .filter(([, n]) => n > 0)
    .map(
      ([kind, n]) =>
        `<span class="conf conf-${kind}">${escapeHtml(CONFIDENCE_LABEL[kind as keyof typeof CONFIDENCE_LABEL])} ${n}</span>`,
    )
    .join('');

  const body = sections
    .map((section) => {
      const findings = visible.filter((f) => f.section === section);
      return `
        <section class="analysis-section">
          <h3 class="analysis-section-title">
            <span class="section-icon">${SECTION_ICON[section] ?? '•'}</span>
            ${escapeHtml(SECTION_LABEL[section] ?? section)}
          </h3>
          <div class="finding-grid">
            ${findings.map((f) => findingCard(f, profile.graph.why(f.id).length > 0)).join('')}
          </div>
        </section>`;
    })
    .join('');

  const limitations =
    profile.limitations.length > 0
      ? `<section class="analysis-section">
           <h3 class="analysis-section-title"><span class="section-icon">⚠</span>Lo que este motor NO afirma</h3>
           <ul class="limitations">
             ${profile.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
           </ul>
         </section>`
      : '';

  return `
    <div class="analysis">
      <header class="analysis-head">
        <div>
          <div class="analysis-formula">${escapeHtml(profile.pretty)}</div>
          <div class="analysis-count">${profile.graph.size} resultados encadenados</div>
        </div>
        <div class="conf-legend">${totals}</div>
      </header>

      <div class="level-control">
        <label for="analysis-level">Profundidad</label>
        <input type="range" id="analysis-level" min="1" max="5" value="${level}" step="1">
        <output id="analysis-level-label">${escapeHtml(LEVEL_LABEL[level] ?? '')}</output>
      </div>

      <p class="analysis-hint">
        Pulsa <strong>¿Por que?</strong> en cualquier resultado para ver de que otros resultados sale.
        Desde ahi puedes seguir bajando hasta la formula de partida.
      </p>

      ${body}
      ${limitations}
    </div>`;
}

/**
 * La vista de «¿por que?»: un hallazgo, su razonamiento, y los hallazgos de
 * los que sale — cada uno con su propio boton para seguir bajando.
 *
 * `trail` es el camino recorrido. Se muestra como migas de pan porque, cuatro
 * o cinco niveles abajo, es facil perder de vista desde donde se empezo.
 */
export function renderWhy(profile: AnalysisProfile, trail: readonly string[]): string {
  const id = trail[trail.length - 1]!;
  const finding = profile.graph.get(id);
  if (!finding) return '<div class="empty-state">Ese resultado ya no esta disponible.</div>';

  const supports = profile.graph.why(id);
  const usedBy = profile.graph.usedBy(id);

  /*
   * Con cinco o seis niveles la fila de migas se convierte en tres lineas de
   * texto que empujan el contenido fuera de la pantalla, sobre todo en movil.
   * Se conserva lo que sirve para orientarse — el primer paso y los dos
   * ultimos — y el resto se colapsa. La raiz («← Analisis») esta siempre
   * fuera de este recorte, asi que nunca se pierde la salida.
   */
  const MAX_CRUMBS = 4;
  const collapsed = trail.length > MAX_CRUMBS;
  const shown = collapsed ? [trail[0]!, ...trail.slice(-2)] : trail;
  const indexOfShown = (position: number): number =>
    collapsed ? (position === 0 ? 0 : trail.length - (shown.length - position)) : position;

  const crumbs = shown
    .map((step, position) => {
      const index = indexOfShown(position);
      const gap = collapsed && position === 1 ? '<span class="crumb-sep">…</span>' : '';
      const f = profile.graph.get(step);
      if (!f) return '';
      const last = index === trail.length - 1;
      return (
        gap +
        (last
          ? `<span class="crumb current">${escapeHtml(f.label)}</span>`
          : `<button class="crumb" data-crumb="${index}">${escapeHtml(f.label)}</button>`)
      );
    })
    .join('<span class="crumb-sep">›</span>');

  return `
    <div class="why-view">
      <nav class="crumbs">
        <button class="crumb crumb-root" data-crumb="-1">← Analisis</button>
        <span class="crumb-sep">›</span>
        ${crumbs}
      </nav>

      <section class="why-subject">
        <header class="finding-head">
          <span class="finding-label">${escapeHtml(finding.label)}</span>
          ${chip(finding)}
        </header>
        <div class="finding-value big">${escapeHtml(finding.value)}</div>
        <p class="why-because">${escapeHtml(finding.because)}</p>
        ${finding.model ? `<p class="why-model">Modelo empleado: <strong>${escapeHtml(finding.model)}</strong></p>` : ''}
        ${finding.source ? `<p class="why-model">Fuente: ${escapeHtml(finding.source)}</p>` : ''}
        <p class="why-confidence">${escapeHtml(CONFIDENCE_NOTE[finding.confidence])}</p>
        ${stepsHtml(finding)}
      </section>

      ${
        supports.length > 0
          ? `<section class="analysis-section">
               <h3 class="analysis-section-title"><span class="section-icon">↓</span>Esto sale de:</h3>
               <div class="finding-grid">
                 ${supports.map((f) => findingCard(f, profile.graph.why(f.id).length > 0)).join('')}
               </div>
             </section>`
          : `<div class="notice info"><strong>Aqui termina la cadena.</strong> Este resultado es un dato
             de partida: no se deduce de ningun otro, se lee de la formula o de la tabla periodica.</div>`
      }

      ${
        usedBy.length > 0
          ? `<section class="analysis-section">
               <h3 class="analysis-section-title"><span class="section-icon">↑</span>Y sirve para explicar:</h3>
               <div class="used-by">
                 ${usedBy
                   .map(
                     (f) =>
                       `<button class="used-by-item" data-why="${escapeHtml(f.id)}">${escapeHtml(f.label)}: <strong>${escapeHtml(f.value)}</strong></button>`,
                   )
                   .join('')}
               </div>
             </section>`
          : ''
      }
    </div>`;
}
