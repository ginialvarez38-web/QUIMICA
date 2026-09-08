/**
 * EL AVATAR — la cara del guia.
 *
 * Un matraz con ojos, dibujado en SVG en linea. No hay imagenes que cargar ni
 * dependencias: la expresion son cuatro trazos que cambian con el estado de
 * animo, y el liquido se tine del color del momento.
 *
 * POR QUE UN MATRAZ Y NO UNA MASCOTA
 * Porque tiene que poder ponerse serio. Este guia avisa de riesgos quimicos —
 * «no intentes esto sin controles profesionales» — y un personaje demasiado
 * simpatico le quita peso a esa frase justo cuando mas pesa. Un matraz con dos
 * ojos es reconocible y amable sin ser un juguete.
 *
 * LO QUE ESTA VISTA NO HACE
 * No escribe ni una frase de quimica. Todo el texto viene del motor del guia,
 * incluida la procedencia de cada pista. Aqui solo se decide como se ve.
 */

import type { GuideMessage, GuideMood } from '../teach/guide.js';
import { escapeHtml } from './dom.js';

/** Que color lleva el liquido en cada estado. */
const MOOD_TOKEN: Record<GuideMood, string> = {
  idle: 'var(--accent)',
  pointing: 'var(--mode-accent, var(--accent))',
  asking: 'var(--violet)',
  warning: 'var(--hazard-danger)',
  done: 'var(--evidence-established)',
};

/**
 * Los ojos.
 *
 * Cambian de forma, no solo de color: quien no distinga los tonos tiene que
 * poder ver igualmente que el guia esta preguntando o avisando.
 */
function eyes(mood: GuideMood): string {
  switch (mood) {
    // Contentos: dos arcos hacia arriba.
    case 'done':
      return '<path d="M20 30q3-4 6 0M34 30q3-4 6 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
    // Alerta: cejas caidas hacia dentro.
    case 'warning':
      return (
        '<circle cx="23" cy="31" r="2.6" fill="currentColor"/><circle cx="37" cy="31" r="2.6" fill="currentColor"/>' +
        '<path d="M18 25l7 3M42 25l-7 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
      );
    // Preguntando: una ceja levantada.
    case 'asking':
      return (
        '<circle cx="23" cy="31" r="2.8" fill="currentColor"/><circle cx="37" cy="31" r="2.8" fill="currentColor"/>' +
        '<path d="M18 25.5q3.5-2.5 7 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
      );
    default:
      return '<circle cx="23" cy="31" r="2.8" fill="currentColor"/><circle cx="37" cy="31" r="2.8" fill="currentColor"/>';
  }
}

/** El matraz, con el liquido a la altura que corresponde. */
export function renderAvatar(mood: GuideMood): string {
  const tint = MOOD_TOKEN[mood];
  return `
    <svg class="guide-avatar-svg" viewBox="0 0 60 64" width="44" height="47" aria-hidden="true">
      <defs>
        <clipPath id="guide-flask-clip">
          <path d="M24 6h12v18l13 24a6 6 0 0 1-5 9H16a6 6 0 0 1-5-9l13-24z"/>
        </clipPath>
      </defs>

      <!-- Liquido: recortado por la silueta, para que no se salga del vidrio. -->
      <g clip-path="url(#guide-flask-clip)">
        <rect x="0" y="40" width="60" height="24" fill="${tint}" opacity="0.85"/>
        <circle cx="20" cy="46" r="2.4" fill="#fff" opacity="0.45"/>
        <circle cx="33" cy="52" r="1.7" fill="#fff" opacity="0.35"/>
        <circle cx="40" cy="44" r="1.3" fill="#fff" opacity="0.4"/>
      </g>

      <!-- Vidrio -->
      <path d="M24 6h12v18l13 24a6 6 0 0 1-5 9H16a6 6 0 0 1-5-9l13-24z"
            fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M21 4h18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>

      ${eyes(mood)}
    </svg>`;
}

/**
 * El panel desplegado: lo que el guia tiene que decir ahora.
 */
export function renderGuidePanel(
  message: GuideMessage,
  answer: { readonly chosen: string; readonly correct: boolean } | null,
): string {
  const hints = message.hints.length
    ? `<ul class="guide-hints">${message.hints
        .map(
          (h) =>
            `<li>${escapeHtml(h.text)}<span class="guide-source">${escapeHtml(h.from)}</span></li>`,
        )
        .join('')}</ul>`
    : '';

  /*
   * La pregunta del §23. Tras responder se muestra SIEMPRE la explicacion,
   * se haya acertado o no: el valor esta en entender por que, no en el
   * marcador. Y la opcion correcta se senala aunque el usuario haya fallado,
   * porque dejarlo con la duda seria peor que no preguntar.
   */
  const question = message.question
    ? `<div class="guide-question">
         <p class="guide-question-text">${escapeHtml(message.question.text)}</p>
         <div class="guide-options">
           ${message.question.options
             .map((o) => {
               const state = !answer
                 ? ''
                 : o.correct
                   ? ' is-correct'
                   : o.id === answer.chosen
                     ? ' is-wrong'
                     : ' is-dim';
               return `<button class="guide-option${state}" data-guide-option="${escapeHtml(o.id)}"${answer ? ' disabled' : ''}>
                         ${escapeHtml(o.label)}
                       </button>`;
             })
             .join('')}
         </div>
         ${
           answer
             ? `<div class="guide-reveal${answer.correct ? ' ok' : ''}">
                  <strong>${answer.correct ? 'Correcto.' : 'No era eso.'}</strong>
                  ${escapeHtml(message.question.reveal)}
                </div>`
             : '<p class="guide-question-note">Elige una. No se puntua: solo sirve para que compares tu razonamiento con el del motor.</p>'
         }
       </div>`
    : '';

  return `
    <div class="guide-panel-head">
      <h3 class="guide-headline">${escapeHtml(message.headline)}</h3>
      <button class="guide-close" id="guide-close" aria-label="Cerrar el guia">×</button>
    </div>
    <p class="guide-body">${escapeHtml(message.body)}</p>
    ${question}
    ${hints}`;
}
