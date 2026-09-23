/**
 * EL TEMARIO — vista.
 *
 * UN APARTADO POR PANTALLA, NO UNA COLUMNA INTERMINABLE.
 *
 * La primera version pintaba la unidad entera seguida, con el argumento de
 * que un temario se estudia del tirón. Medida, la unidad 2 ocupaba 28.085 px
 * — treinta y una pantallas — y un solo apartado llegaba a 12.703. Eso no es
 * «leer seguido»: es no encontrar nada. El indice de la izquierda tampoco
 * ayudaba, porque solo desplazaba a un punto de un rollo continuo y a los dos
 * segundos ya no se sabia donde se estaba.
 *
 * Ahora el indice NAVEGA: se pinta un apartado cada vez, con su sitio en la
 * unidad («7 de 21») y con anterior y siguiente al pie. Se sigue pudiendo leer
 * del tirón — pulsando «siguiente» — pero ahora hay una unidad de lectura con
 * principio y final, y el indice dice donde estas.
 *
 * Y DENTRO DE CADA APARTADO, DOS CAPAS.
 *
 * Un apartado llegaba a apilar nueve cajas: cuerpo, idea, ojo, analogia,
 * figura, demostracion, ejercicio, autocomprobacion y conexiones. Todas con su
 * marco y su etiqueta, todas con el mismo peso visual — y cuando todo resalta,
 * nada resalta. Se quedan arriba las que responden «¿que es esto?» (cuerpo,
 * idea, figura y demostracion) y pasan a una segunda capa con pestanas las que
 * responden «¿lo he entendido?» (ojo, analogia, ejercicio, comprobacion).
 *
 * No se esconde nada: las pestanas dicen lo que hay detras y estan a un clic.
 *
 * Lo que distingue esta pantalla de un apunte es que las leyes no se afirman:
 * se calculan. Cada bloque «⚙» es una demostracion hecha con los mismos
 * motores que usa el resto de la aplicacion, no una tabla escrita a mano.
 */

import type { TheoryTopic, TheoryDemo, Analogy, WorkedExample } from '../teach/theory.js';
import { SEPARATION_METHODS, AVOGADRO } from '../teach/theory.js';
import { escapeHtml } from './dom.js';
import { renderFigure } from './figure-3d.js';
import type { FlashCard } from '../teach/flashcards.js';
import { cardsOf, deckOf, progressOf } from '../teach/flashcards.js';

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

/**
 * La segunda capa de un apartado.
 *
 * Las cuatro piezas que responden «¿lo he entendido?» —el error tipico, la
 * analogia, el ejercicio resuelto y la autocomprobacion— comparten un bloque
 * con pestanas en lugar de apilarse una debajo de otra.
 *
 * Se pintan TODAS y se ocultan con `hidden` en vez de dibujar solo la activa:
 * asi cambiar de pestana no reconstruye nada, y los <details> de la
 * autocomprobacion conservan si estaban abiertos.
 */
function renderMore<D>(
  topic: TheoryTopic<D>,
  cards: readonly FlashCard[],
  known: ReadonlySet<string>,
): string {
  const parts: { id: string; label: string; html: string }[] = [];

  /*
   * Las tarjetas van LAS PRIMERAS, y no por capricho.
   *
   * La pestana que se abre por defecto es la primera, asi que al terminar de
   * leer un apartado lo que aparece es una pregunta — no el error tipico ni la
   * analogia, que son mas texto para leer. Cerrar con una pregunta es lo unico
   * de esta caja que obliga a recuperar algo de memoria.
   */
  if (cards.length > 0) {
    parts.push({
      id: 'tarjetas',
      label: `Tarjetas · ${cards.length}`,
      html: renderCards(cards, known),
    });
  }

  if (topic.pitfall) {
    parts.push({
      id: 'ojo',
      label: 'Ojo',
      html: `<div class="topic-pitfall">${escapeHtml(topic.pitfall)}</div>`,
    });
  }
  if (topic.analogy) parts.push({ id: 'analogia', label: 'Imaginalo asi', html: renderAnalogy(topic.analogy) });
  if (topic.worked) parts.push({ id: 'ejercicio', label: 'Ejercicio resuelto', html: renderWorked(topic.worked) });

  /*
   * NO HAY PESTANA DE AUTOCOMPROBACION, y su ausencia es deliberada.
   *
   * Las tarjetas se derivan justamente de `check`, asi que poner las dos
   * habria dejado LAS MISMAS PREGUNTAS en dos pestanas contiguas de la misma
   * caja — la duplicacion mas descarada de toda la aplicacion, y en el sitio
   * donde mas canta.
   *
   * Se queda la tarjeta porque hace todo lo que hacia la autocomprobacion —la
   * respuesta llega tapada y hay que pedirla— y ademas dos cosas que la otra
   * no hacia: recuerda si ya te la sabias y se puede repasar suelta, lejos del
   * texto que la contesta.
   */

  if (parts.length === 0) return '';

  return `
    <div class="topic-more">
      <div class="more-tabs" role="tablist" aria-label="Para profundizar">
        ${parts
          .map(
            (part, i) =>
              `<button class="more-tab" role="tab" data-more="${escapeHtml(part.id)}"
                       aria-selected="${i === 0}">${escapeHtml(part.label)}</button>`,
          )
          .join('')}
      </div>
      ${parts
        .map(
          (part, i) =>
            `<div class="more-panel" data-more-panel="${escapeHtml(part.id)}"${i === 0 ? '' : ' hidden'}>
               ${part.html}
             </div>`,
        )
        .join('')}
    </div>`;
}

/** Un boton de anterior / siguiente, con el titulo de a donde lleva. */
function renderStep(topic: TheoryTopic<unknown> | undefined, direction: 'prev' | 'next'): string {
  if (!topic) return '<span class="topic-step is-empty"></span>';
  const arrow = direction === 'prev' ? '←' : '→';
  return `
    <button class="topic-step" data-goto="${escapeHtml(topic.id)}">
      <span class="step-dir">${arrow} ${direction === 'prev' ? 'Anterior' : 'Siguiente'}</span>
      <span class="step-title">${escapeHtml(topic.id)} ${escapeHtml(topic.title)}</span>
    </button>`;
}

/**
 * UN apartado, con su sitio en la unidad y su camino de salida.
 *
 * El orden importa y no es el de antes. Arriba va lo que contesta «¿que es
 * esto?»: el texto, la idea que hay que llevarse, la figura y la
 * demostracion. Debajo, en una sola caja con pestanas, lo que contesta «¿lo he
 * entendido?». Antes las nueve cajas iban seguidas y con el mismo peso, y no
 * habia forma de saber que era lo principal.
 */
export function renderTopicPage<D>(
  topic: TheoryTopic<D>,
  context: {
    readonly unitTitle: string;
    readonly unitId: string;
    readonly position: number;
    readonly total: number;
    readonly previous?: TheoryTopic<D>;
    readonly next?: TheoryTopic<D>;
    /** Lo que el lector ya marco como sabido, para pintar las tarjetas. */
    readonly known: ReadonlySet<string>;
    /** «Antes de esto» y «esto abre», ya dibujados. Sale del arbol. */
    readonly lineage?: string;
  },
  demoRenderer: (d: D) => string,
): string {
  const cards = cardsOf(topic);
  return `
    <article class="topic" id="topic-${escapeHtml(topic.id)}" data-topic="${escapeHtml(topic.id)}">
      <p class="topic-crumb">
        <span class="crumb-unit">Unidad ${escapeHtml(context.unitId)} · ${escapeHtml(context.unitTitle)}</span>
        <span class="crumb-pos">${context.position} de ${context.total}</span>
      </p>

      <h2 class="topic-title">
        <span class="topic-number">${escapeHtml(topic.id)}</span>
        ${escapeHtml(topic.title)}
      </h2>
      <p class="topic-body">${escapeHtml(topic.body)}</p>

      ${
        topic.keyIdea
          ? `<div class="topic-key"><span class="topic-key-label">La idea</span>${escapeHtml(topic.keyIdea)}</div>`
          : ''
      }
      ${topic.figure ? renderFigure(topic.figure) : ''}
      ${topic.demo ? demoRenderer(topic.demo) : ''}
      ${topic.id === '1.6.3' ? renderSeparationMethods() : ''}
      ${
        topic.gap
          ? `<div class="topic-gap"><span class="topic-key-label">Lo que aqui no hay</span>${escapeHtml(topic.gap)}</div>`
          : ''
      }

      ${renderMore(topic, cards, context.known)}

      ${
        topic.tryIt
          ? `<button class="button topic-try" ${topic.tryIt.mode ? `data-theory-mode="${escapeHtml(topic.tryIt.mode)}"` : ''} ${topic.tryIt.formula ? `data-theory-formula="${escapeHtml(topic.tryIt.formula)}"` : ''}>
               ${escapeHtml(topic.tryIt.label)} →
             </button>`
          : ''
      }
      ${topic.connects && topic.connects.length > 0 ? renderConnects(topic.connects) : ''}

      ${context.lineage ?? ''}

      <nav class="topic-nav" aria-label="Apartado anterior y siguiente">
        ${renderStep(context.previous, 'prev')}
        ${renderStep(context.next, 'next')}
      </nav>
    </article>`;
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
 * Los apartados de una unidad, en el orden en que se leen.
 *
 * Es la MISMA lista que pinta el indice y la misma que recorren los botones de
 * anterior y siguiente. Tenerla una sola vez es lo que garantiza que el
 * «7 de 21» del encabezado, la posicion marcada en el indice y el destino de
 * «siguiente» hablen siempre del mismo sitio.
 */
export function flattenTopics<D>(unit: TheoryTopic<D>): TheoryTopic<D>[] {
  const out: TheoryTopic<D>[] = [];
  const walk = (t: TheoryTopic<D>) => {
    out.push(t);
    for (const child of t.children ?? []) walk(child);
  };
  for (const child of unit.children ?? []) walk(child);
  return out;
}

export interface UnitView<D> {
  readonly unit: TheoryTopic<D>;
  readonly demoRenderer: (demo: D) => string;
  /** Que se calcula en esta unidad, para el aviso de la cabecera. */
  readonly claim: string;
}

/**
 * Una unidad con el tipo de su demostracion ya olvidado.
 *
 * Cada unidad tiene demostraciones de un tipo distinto —la 1 calcula leyes
 * ponderales, la 2 cuenta nucleones y sortea orbitales, la 3 suma dipolos y la
 * 4 deduce formulas de porcentajes— y cada renderizador solo sabe de las
 * suyas. Para poder guardarlas en la misma lista hace falta borrar ese tipo, y
 * la unica forma segura es borrarlo JUNTO CON su renderizador: `anyView`
 * empareja los dos en una clausura, y desde ese momento ya no existe ninguna
 * forma de pasarle a un renderizador una demostracion de otra unidad.
 */
export interface AnyUnitView {
  readonly unit: TheoryTopic<unknown>;
  readonly demoRenderer: (demo: unknown) => string;
  readonly claim: string;
}

export function anyView<D>(view: UnitView<D>): AnyUnitView {
  return {
    unit: view.unit,
    demoRenderer: (demo) => view.demoRenderer(demo as D),
    claim: view.claim,
  };
}

/**
 * La carcasa: el conmutador de unidad, el indice y el hueco del apartado.
 *
 * Se pinta UNA VEZ por sesion y no se vuelve a tocar. Lo unico que cambia al
 * navegar es el contenido de `.topic-page`, y eso mantiene el desplazamiento
 * del indice donde el lector lo dejo.
 */
export function renderTheoryShell(
  views: readonly AnyUnitView[],
  activeIndex: number,
  known: ReadonlySet<string>,
): string {
  const active = views[activeIndex]!;
  const demos = countDemos(active.unit);
  const deck = deckOf(active.unit);

  return `
    <div class="theory">
      <nav class="theory-toc" aria-label="Indice del temario">
        <div class="unit-switch" role="tablist" aria-label="Unidad">
          ${views
            .map(
              (view, i) =>
                /*
                 * El titulo va en su propio <span> para que el CSS pueda
                 * acortarlo en pantallas estrechas. Con tres unidades la fila
                 * cabia; con la cuarta se desbordaba 45 px en un movil de 320,
                 * y el desbordamiento afectaba a TODAS las unidades porque el
                 * conmutador es el mismo. El `aria-label` conserva el nombre
                 * completo aunque el texto se recorte.
                 */
                `<button class="unit-tab" role="tab" data-unit="${i}" aria-selected="${i === activeIndex}"
                         aria-label="Unidad ${escapeHtml(view.unit.id)}: ${escapeHtml(view.unit.title)}">
                   <span class="unit-number">${escapeHtml(view.unit.id)}</span>
                   <span class="unit-title">${escapeHtml(view.unit.title)}</span>
                 </button>`,
            )
            .join('')}
        </div>
        <p class="toc-claim">
          <strong>${demos} apartados no se afirman: se calculan.</strong> ${escapeHtml(active.claim)}
        </p>
        ${renderDeckBar(deck.length, progressOf(deck, known))}

        <!-- Temario o mapa. El mapa no sustituye al indice: contesta otra
             pregunta. El indice dice donde esta un tema; el mapa, que hace
             falta antes y que se abre despues. -->
        <div class="view-switch" role="tablist" aria-label="Como ver el temario">
          <button class="view-tab" role="tab" data-view="temario" aria-selected="true">Temario</button>
          <button class="view-tab" role="tab" data-view="mapa" aria-selected="false">Mapa</button>
        </div>
        <!-- El plegado solo actua en movil; en escritorio el boton no se
             dibuja y la lista esta siempre abierta. -->
        <button class="toc-toggle" data-toc-toggle>
          Indice · ${flattenTopics(active.unit).length} apartados
        </button>
        <div class="toc-list">${renderIndex(active.unit)}</div>
      </nav>

      <div class="theory-content">
        <div class="topic-page"></div>
      </div>
    </div>`;
}

function countDemos<D>(topic: TheoryTopic<D>): number {
  return (topic.demo ? 1 : 0) + (topic.children ?? []).reduce((sum, c) => sum + countDemos(c), 0);
}

/** La unidad 1, lista para el lector. */
export function materiaView(unit: TheoryTopic<TheoryDemo>): UnitView<TheoryDemo> {
  return {
    unit,
    demoRenderer: renderDemo,
    claim:
      'Los atomos de la conservacion se cuentan sobre una ecuacion que ajusto el balanceador, y los ' +
      'porcentajes en masa salen del desglose de la masa molar.',
  };
}

/** Utilidades que comparte la vista de la unidad 2. */
export { num, scientific };

/** El numero de Avogadro, ya formateado, para quien lo necesite fuera. */
export const AVOGADRO_TEXT = scientific(AVOGADRO);

// ---------------------------------------------------------------------------
// TARJETAS DE REPASO
// ---------------------------------------------------------------------------

/**
 * Las tarjetas de un apartado, en la segunda capa.
 *
 * Una tarjeta no es la autocomprobacion con otro marco: cambia lo que se hace
 * con ella. La autocomprobacion esta en medio del apartado, con el texto
 * recien leido a dos centimetros — y responder con la explicacion a la vista
 * no es recordar, es copiar. La tarjeta llega SOLA, sin contexto, y por eso
 * obliga a recuperar de verdad.
 *
 * De ahi que la cara delantera no diga de que apartado viene cuando se repasa
 * la unidad entera: saber que la pregunta es «de isotopos» ya es media
 * respuesta.
 */
export function renderCards(cards: readonly FlashCard[], known: ReadonlySet<string>): string {
  if (cards.length === 0) return '';

  return `
    <div class="cards" data-cards>
      <div class="cards-head">
        <span class="cards-count"><strong data-card-index>1</strong> de ${cards.length}</span>
        <button class="cards-shuffle" data-card-shuffle>Barajar</button>
      </div>
      ${cards
        .map(
          (card, i) => `
          <div class="card" data-card="${escapeHtml(card.id)}"${i === 0 ? '' : ' hidden'}>
            <p class="card-front">${escapeHtml(card.front)}</p>
            <div class="card-back" hidden>
              <p>${escapeHtml(card.back)}</p>
              <span class="card-source">${card.from === 'ejercicio' ? 'Ejercicio resuelto' : 'Autocomprobacion'} · ${escapeHtml(card.topicId)}</span>
            </div>
            <div class="card-actions">
              <button class="button card-flip" data-card-flip>Ver la respuesta</button>
              <div class="card-grade" hidden>
                <button class="card-known${known.has(card.id) ? ' is-on' : ''}" data-card-grade="known">La sabia</button>
                <button class="card-again" data-card-grade="again">Repasarla</button>
              </div>
            </div>
          </div>`,
        )
        .join('')}
      <p class="cards-done" hidden></p>
    </div>`;
}

/**
 * El mazo de la unidad entera, con lo que ya se sabe descontado.
 *
 * Repasar apartado por apartado tiene un limite: cada tarjeta llega rodeada de
 * las de su tema, y acertar «isotonos» cuando acabas de leer sobre isotonos no
 * demuestra gran cosa. El mazo mezcla las sesenta y cinco.
 */
export function renderDeckBar(total: number, known: number): string {
  const pct = total === 0 ? 0 : Math.round((100 * known) / total);
  return `
    <button class="deck-bar" data-deck>
      <span class="deck-label">Repasar con tarjetas</span>
      <span class="deck-meter"><span class="deck-fill" style="width:${pct}%"></span></span>
      <span class="deck-count">${known}/${total}</span>
    </button>`;
}
