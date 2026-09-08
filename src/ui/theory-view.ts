/**
 * UNIDAD 1 — vista.
 *
 * Indice fijo a la izquierda y el temario entero a la derecha, en una sola
 * columna que se lee de arriba abajo. No es un acordeon a proposito: un
 * temario se estudia seguido, y obligar a abrir doce cajas para leerlo entero
 * es trabajo que no aporta nada.
 *
 * Lo que distingue esta pantalla de un apunte es que las leyes no se afirman:
 * se calculan. Cada bloque «⚙» de abajo es una demostracion hecha con los
 * mismos motores que usa el resto de la aplicacion, no una tabla escrita a
 * mano.
 */

import type { TheoryTopic, TheoryDemo, Analogy, WorkedExample, SelfCheck } from '../teach/theory.js';
import { SEPARATION_METHODS, AVOGADRO } from '../teach/theory.js';
import { escapeHtml } from './dom.js';

const num = (value: number, digits = 3): string =>
  value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 6.02214076e23 → "6,02214076 × 10²³" */
function scientific(value: number): string {
  const [mantissa, exponent] = value.toExponential(8).split('e');
  const superscript = String(Number(exponent))
    .split('')
    .map((c) => ('⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)] ?? c))
    .join('');
  return `${mantissa!.replace('.', ',')} × 10${superscript}`;
}

// ---------------------------------------------------------------------------
// Las demostraciones
// ---------------------------------------------------------------------------

function renderDemo(demo: TheoryDemo): string {
  switch (demo.kind) {
    /*
     * Conservacion: se CUENTAN los atomos de los dos lados. La ecuacion la
     * ajusto el balanceador por su cuenta; aqui solo se comprueba.
     */
    case 'conservation':
      return `
        <div class="demo">
          <div class="demo-title">Comprobado contando los atomos</div>
          <p class="demo-equation">${escapeHtml(demo.equation)}</p>
          <table class="demo-table">
            <thead><tr><th>Elemento</th><th>Izquierda</th><th>Derecha</th><th></th></tr></thead>
            <tbody>
              ${demo.rows
                .map(
                  (r) =>
                    `<tr><th scope="row">${escapeHtml(r.symbol)}</th><td>${r.left}</td><td>${r.right}</td>
                     <td class="demo-check">${r.balanced ? '✓' : '✗'}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p class="demo-note">
            Masa total: <strong>${num(demo.massLeft, 4)} g/mol</strong> a la izquierda y
            <strong>${num(demo.massRight, 4)} g/mol</strong> a la derecha. No sobra ni falta un atomo,
            y por eso tampoco sobra ni falta masa.
          </p>
        </div>`;

    /*
     * Proporciones definidas: el reparto en masa NO depende del tamano de la
     * muestra. Se aplica el mismo porcentaje a dos muestras muy distintas.
     */
    case 'definite':
      return `
        <div class="demo">
          <div class="demo-title">Calculado para ${escapeHtml(demo.display)}</div>
          <table class="demo-table">
            <thead><tr><th>Elemento</th><th>Atomos</th><th>Masa aportada</th><th>% en masa</th></tr></thead>
            <tbody>
              ${demo.rows
                .map(
                  (r) =>
                    `<tr><th scope="row">${escapeHtml(r.symbol)}</th><td>${r.count}</td>
                     <td>${num(r.subtotal)} g</td><td><strong>${num(r.percent, 2)} %</strong></td></tr>`,
                )
                .join('')}
              <tr class="demo-total"><th scope="row">Total</th><td></td><td>${num(demo.total)} g/mol</td><td>100 %</td></tr>
            </tbody>
          </table>
          <p class="demo-note">Y ese porcentaje no cambia con la cantidad:</p>
          <table class="demo-table">
            <thead><tr><th>Muestra</th>${demo.rows.map((r) => `<th>${escapeHtml(r.symbol)}</th>`).join('')}</tr></thead>
            <tbody>
              ${demo.samples
                .map(
                  (s) =>
                    `<tr><th scope="row">${s.grams} g</th>${s.parts
                      .map((p) => `<td>${num(p.grams)} g</td>`)
                      .join('')}</tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

    /*
     * Proporciones multiples: se fija un gramo de un elemento y se mide cuanto
     * del otro le acompana en cada compuesto. El cociente sale entero solo.
     */
    case 'multiple':
      return `
        <div class="demo">
          <div class="demo-title">
            Fijando 1 g de ${escapeHtml(demo.fixedElement)} y midiendo el ${escapeHtml(demo.variableElement)}
          </div>
          <table class="demo-table">
            <thead><tr><th>Compuesto</th><th>g de ${escapeHtml(demo.variableElement)} por g de ${escapeHtml(demo.fixedElement)}</th><th>Relativo</th></tr></thead>
            <tbody>
              ${demo.rows
                .map(
                  (r) =>
                    `<tr><th scope="row">${escapeHtml(r.display)}</th><td>${num(r.perGram, 4)}</td>
                     <td><strong>${num(r.relative, 4)}</strong></td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p class="demo-result">Razon: <strong>${escapeHtml(demo.ratioText)}</strong></p>
          <p class="demo-note">
            Numeros enteros pequenos, sin haberlo forzado: el calculo parte de las masas atomicas
            medidas. Que salga exactamente ${escapeHtml(demo.ratioText)} y no una cifra cualquiera solo
            tiene sentido si lo que se combina son unidades que se cuentan de una en una. Eso son los
            atomos.
          </p>
        </div>`;

    /*
     * Gay-Lussac: los volumenes van como los coeficientes, y los coeficientes
     * los puso el balanceador.
     */
    case 'gay-lussac':
      return `
        <div class="demo">
          <div class="demo-title">Volumenes de combinacion</div>
          <p class="demo-equation">${escapeHtml(demo.equation)}</p>
          <table class="demo-table">
            <thead><tr><th>Gas</th><th>Volumenes</th><th>Lado</th></tr></thead>
            <tbody>
              ${demo.volumes
                .map(
                  (v) =>
                    `<tr><th scope="row">${escapeHtml(v.display)}</th><td><strong>${v.volumes}</strong></td>
                     <td>${escapeHtml(v.side)}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p class="demo-result">Razon de volumenes: <strong>${escapeHtml(demo.ratioText)}</strong></p>
          <p class="demo-note">
            Son los coeficientes de la ecuacion, que calculo el balanceador sin saber nada de
            volumenes. Coinciden porque volumenes iguales de gases distintos contienen el mismo numero
            de moleculas — que es exactamente el principio de Avogadro del apartado siguiente.
          </p>
        </div>`;

    /*
     * Mol de atomos frente a mol de moleculas: la confusion mas repetida.
     */
    case 'mole':
      return `
        <div class="demo">
          <div class="demo-title">Un mol de ${escapeHtml(demo.display)}</div>
          <table class="demo-table">
            <thead><tr><th>Entidad</th><th>Moles</th><th>Particulas</th></tr></thead>
            <tbody>
              <tr><th scope="row">Moleculas de ${escapeHtml(demo.display)}</th><td>1</td>
                  <td>${escapeHtml(scientific(demo.molecules))}</td></tr>
              ${demo.atoms
                .map(
                  (a) =>
                    `<tr><th scope="row">Atomos de ${escapeHtml(a.symbol)}</th><td>${a.moles}</td>
                     <td>${escapeHtml(scientific(a.atoms))}</td></tr>`,
                )
                .join('')}
              <tr class="demo-total"><th scope="row">Atomos en total</th>
                  <td>${demo.atoms.reduce((s, a) => s + a.moles, 0)}</td>
                  <td>${escapeHtml(scientific(demo.totalAtoms))}</td></tr>
            </tbody>
          </table>
          <p class="demo-note">
            Masa molar: <strong>${num(demo.molarMass)} g/mol</strong>. Es decir, ${num(demo.molarMass)} g
            de ${escapeHtml(demo.display)} contienen ${escapeHtml(scientific(demo.molecules))} moleculas
            — y ${escapeHtml(scientific(demo.totalAtoms))} atomos, que no es lo mismo.
          </p>
        </div>`;
  }
}

/** La tabla de metodos de separacion (1.6.3). */
function renderSeparationMethods(): string {
  return `
    <div class="demo">
      <div class="demo-title">Que propiedad aprovecha cada metodo</div>
      <div class="demo-scroll">
        <table class="demo-table methods-table">
          <thead><tr><th>Metodo</th><th>Que separa</th><th>Propiedad que usa</th><th>Ejemplo</th></tr></thead>
          <tbody>
            ${SEPARATION_METHODS.map(
              (m) => `<tr>
                <th scope="row">${escapeHtml(m.name)}</th>
                <td>${escapeHtml(m.separates)}</td>
                <td><strong>${escapeHtml(m.property)}</strong></td>
                <td class="method-example">${escapeHtml(m.example)}</td>
              </tr>`,
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// El temario
// ---------------------------------------------------------------------------

/**
 * Una analogia SIEMPRE con su limite pegado debajo.
 *
 * Van juntas en la misma caja y no en dos bloques separados a proposito: si el
 * limite se pudiera saltar leyendo, la analogia haria mas dano que bien.
 */
function renderAnalogy(analogy: Analogy): string {
  return `
    <div class="topic-analogy">
      <span class="topic-key-label">Imaginalo asi</span>
      ${escapeHtml(analogy.image)}
      <span class="analogy-limit"><strong>Donde falla la comparacion:</strong> ${escapeHtml(analogy.limit)}</span>
    </div>`;
}

function renderWorked(worked: WorkedExample): string {
  return `
    <div class="topic-worked">
      <span class="topic-key-label">Ejercicio resuelto</span>
      <p class="worked-question">${escapeHtml(worked.question)}</p>
      <ol class="worked-steps">
        ${worked.steps
          .map(
            (s) =>
              `<li>${escapeHtml(s.text)}${s.math ? `<code class="why-math">${escapeHtml(s.math)}</code>` : ''}</li>`,
          )
          .join('')}
      </ol>
      <p class="worked-answer"><strong>Respuesta:</strong> ${escapeHtml(worked.answer)}</p>
    </div>`;
}

/**
 * Autocomprobacion con la respuesta tapada.
 *
 * Se usa <details> del propio navegador en lugar de JavaScript: funciona sin
 * guion, es accesible de serie y el navegador ya sabe abrirlo con el teclado.
 */
function renderCheck(checks: readonly SelfCheck[]): string {
  return `
    <div class="topic-check">
      <span class="topic-key-label">Comprueba que lo has entendido</span>
      ${checks
        .map(
          (c) => `
          <details class="check-item">
            <summary>${escapeHtml(c.question)}</summary>
            <div class="check-answer">${escapeHtml(c.answer)}</div>
          </details>`,
        )
        .join('')}
      <p class="check-note">Intenta responder ANTES de abrir. Leer la respuesta sin haberlo intentado
      da sensacion de haber entendido sin haber recuperado nada de memoria.</p>
    </div>`;
}

function renderConnects(
  connects: readonly { readonly label: string; readonly topic?: string; readonly mode?: string }[],
): string {
  return `
    <div class="topic-connects">
      <span class="topic-key-label">Esto se conecta con</span>
      <div class="connect-row">
        ${connects
          .map(
            (c) =>
              `<button class="connect-link"${c.topic ? ` data-toc="${escapeHtml(c.topic)}"` : ''}${c.mode ? ` data-theory-mode="${escapeHtml(c.mode)}"` : ''}>
                 ${escapeHtml(c.label)}
               </button>`,
          )
          .join('')}
      </div>
    </div>`;
}

function renderTopic<D>(topic: TheoryTopic<D>, depth: number, demoRenderer: (d: D) => string): string {
  const heading = depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4';

  return `
    <section class="topic topic-d${depth}" id="topic-${escapeHtml(topic.id)}">
      <${heading} class="topic-title">
        <span class="topic-number">${escapeHtml(topic.id)}</span>
        ${escapeHtml(topic.title)}
      </${heading}>
      <p class="topic-body">${escapeHtml(topic.body)}</p>

      ${
        topic.keyIdea
          ? `<div class="topic-key"><span class="topic-key-label">La idea</span>${escapeHtml(topic.keyIdea)}</div>`
          : ''
      }
      ${
        topic.pitfall
          ? `<div class="topic-pitfall"><span class="topic-key-label">Ojo</span>${escapeHtml(topic.pitfall)}</div>`
          : ''
      }
      ${topic.analogy ? renderAnalogy(topic.analogy) : ''}
      ${topic.demo ? demoRenderer(topic.demo) : ''}
      ${topic.id === '1.6.3' ? renderSeparationMethods() : ''}
      ${topic.worked ? renderWorked(topic.worked) : ''}
      ${topic.check && topic.check.length > 0 ? renderCheck(topic.check) : ''}
      ${
        topic.gap
          ? `<div class="topic-gap"><span class="topic-key-label">Lo que aqui no hay</span>${escapeHtml(topic.gap)}</div>`
          : ''
      }
      ${topic.connects && topic.connects.length > 0 ? renderConnects(topic.connects) : ''}
      ${
        topic.tryIt
          ? `<button class="button topic-try" ${topic.tryIt.mode ? `data-theory-mode="${escapeHtml(topic.tryIt.mode)}"` : ''} ${topic.tryIt.formula ? `data-theory-formula="${escapeHtml(topic.tryIt.formula)}"` : ''}>
               ${escapeHtml(topic.tryIt.label)} →
             </button>`
          : ''
      }

      ${(topic.children ?? []).map((c) => renderTopic(c, depth + 1, demoRenderer)).join('')}
    </section>`;
}

/** El indice, plano y con sangria por nivel. */
function renderIndex<D>(topic: TheoryTopic<D>, depth = 0): string {
  const self =
    depth === 0
      ? ''
      : `<button class="toc-item toc-d${depth}" data-toc="${escapeHtml(topic.id)}">
           <span class="toc-number">${escapeHtml(topic.id)}</span>${escapeHtml(topic.title)}
         </button>`;
  return self + (topic.children ?? []).map((c) => renderIndex(c, depth + 1)).join('');
}

/**
 * Dibuja una unidad entera.
 *
 * Recibe el renderizador de demostraciones porque cada unidad tiene las suyas
 * — la 1 calcula leyes ponderales, la 2 cuenta nucleones — y asi la carcasa
 * (indice, apartados, avisos) se escribe una sola vez.
 */
export function renderUnit<D>(
  unit: TheoryTopic<D>,
  demoRenderer: (demo: D) => string,
  claim: string,
): string {
  const demos = countDemos(unit);

  return `
    <div class="theory">
      <nav class="theory-toc" aria-label="Indice de la unidad">
        <div class="toc-head">
          <span class="toc-unit">Unidad ${escapeHtml(unit.id)}</span>
          <strong>${escapeHtml(unit.title)}</strong>
        </div>
        ${renderIndex(unit)}
      </nav>

      <div class="theory-content">
        <header class="theory-head">
          <h1 class="theory-title">${escapeHtml(unit.title)}</h1>
          <p class="theory-lead">${escapeHtml(unit.body)}</p>
          <p class="theory-claim">
            <strong>${demos} apartados de esta unidad no se afirman aqui: se calculan.</strong>
            ${claim}
          </p>
        </header>
        ${(unit.children ?? []).map((c) => renderTopic(c, 1, demoRenderer)).join('')}
      </div>
    </div>`;
}

function countDemos<D>(topic: TheoryTopic<D>): number {
  return (topic.demo ? 1 : 0) + (topic.children ?? []).reduce((sum, c) => sum + countDemos(c), 0);
}

/** La unidad 1, con su renderizador de demostraciones. */
export function renderTheory(unit: TheoryTopic<TheoryDemo>): string {
  return renderUnit(
    unit,
    renderDemo,
    'Los atomos de la conservacion se cuentan sobre una ecuacion que ajusto el balanceador; los ' +
      'porcentajes en masa salen del desglose de la masa molar; la razon de las proporciones ' +
      'multiples se obtiene dividiendo masas atomicas medidas. Si manana cambiara un dato, ' +
      'cambiarian los numeros de esta pagina.',
  );
}

/** Utilidades que comparte la vista de la unidad 2. */
export { num, scientific };

/** El numero de Avogadro, ya formateado, para quien lo necesite fuera. */
export const AVOGADRO_TEXT = scientific(AVOGADRO);
