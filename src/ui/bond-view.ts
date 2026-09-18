/**
 * UNIDAD 3 — vista.
 *
 * Ocho demostraciones, y ninguna es una tabla escrita a mano: todas salen del
 * motor de analisis. Lo que hace esta vista es presentarlas de forma que el
 * ARGUMENTO se vea, no solo los numeros.
 *
 * El caso que mas cuidado ha llevado es el de los dipolos. La tabla podria
 * limitarse a tres columnas —enlaces, geometria, polar si o no— y seria
 * correcta y no ensenaria nada. Lo que hace falta ver es la CONTRADICCION
 * aparente: «enlaces polares SI» junto a «molecula polar NO» en la misma fila,
 * una al lado de la otra, para que la pregunta surja sola. Por eso esas dos
 * columnas van juntas y marcadas, y por eso las filas donde no coinciden se
 * senalan.
 */

import type { BondDemo } from '../teach/bond.js';
import type { TheoryTopic } from '../teach/theory.js';
import { escapeHtml } from './dom.js';
import { num, type UnitView } from './theory-view.js';

/** El motor describe las diatomicas con una frase; en una celda sobra. */
function shortShape(shape: string): string {
  const cut = shape.split(':')[0]!.trim();
  return cut.length > 26 ? `${cut.slice(0, 24)}…` : cut;
}

function renderDemo(demo: BondDemo): string {
  switch (demo.kind) {
    /* 3.1 — que hace cada elemento y a que gas noble llega. */
    case 'octet':
      return `
        <div class="demo">
          <div class="demo-title">Que le conviene a cada elemento, deducido de su valencia</div>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead><tr><th>Elemento</th><th>e⁻ valencia</th><th>Le faltan</th><th>Camino mas corto</th><th>Ion</th><th>Acaba en</th></tr></thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row">${escapeHtml(r.name)} (${escapeHtml(r.symbol)})</th>
                      <td><strong>${r.valence}</strong></td>
                      <td>${r.needs}</td>
                      <td><span class="route-tag is-${escapeHtml(r.route.replace(/ /g, '-'))}">${escapeHtml(r.route)}</span></td>
                      <td class="config-cell">${r.ion ? escapeHtml(r.ion) : '—'}</td>
                      <td class="config-cell">${escapeHtml(r.target)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">
            La columna «camino mas corto» no esta escrita: se deduce comparando cuantos electrones habria
            que ceder con cuantos habria que captar. Ahi esta la frontera entre metales y no metales, y
            sale de una resta.
          </p>

          <h5 class="trend-title">Donde la regla falla, y por que</h5>
          <table class="demo-table">
            <tbody>
              ${demo.exceptions
                .map(
                  (e) =>
                    `<tr><th scope="row">${escapeHtml(e.formula)}</th>
                     <td class="nuclide-note">${escapeHtml(e.why)}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p class="demo-note">
            Las excepciones no se esconden. Una regla que dice donde falla es mucho mas util que una que
            se presenta como ley — y quien toma el octeto por ley se queda sin poder explicar el SF₆.
          </p>
        </div>`;

    /* 3.2.1 — la transferencia, con las configuraciones del motor. */
    case 'transfer':
      return `
        <div class="demo">
          <div class="demo-title">El electron cambiando de dueno, configuracion a configuracion</div>
          <table class="demo-table">
            <thead><tr><th>Antes</th><th>Configuracion</th></tr></thead>
            <tbody>
              ${demo.before
                .map(
                  (r) =>
                    `<tr><th scope="row">${escapeHtml(r.label)}</th>
                     <td class="config-cell">${escapeHtml(r.config)}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p class="demo-equation">Na + Cl → Na⁺ + Cl⁻ &nbsp;·&nbsp; ΔEN = ${num(demo.deltaEN, 2)}</p>
          <table class="demo-table">
            <thead><tr><th>Despues</th><th>Configuracion</th><th>Igual que</th></tr></thead>
            <tbody>
              ${demo.after
                .map(
                  (r) =>
                    `<tr><th scope="row">${escapeHtml(r.label)}</th>
                     <td class="config-cell">${escapeHtml(r.config)}</td>
                     <td>${escapeHtml(r.like)}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <ol class="worked-steps">
            ${demo.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
          <p class="demo-note">
            Las cuatro configuraciones las calcula el mismo motor que escribe la ficha de cualquier
            elemento. Ninguna esta copiada: se pide la del atomo neutro y la del ion, y se comparan.
          </p>
        </div>`;

    /* 3.2.1.2 / 3.2.2.x — Lewis derivado, y lo que el motor rehusa. */
    case 'lewis-set':
      return `
        <div class="demo">
          <div class="demo-title">${escapeHtml(demo.title)}</div>
          ${
            demo.rows.length > 0
              ? `<div class="demo-scroll">
                   <table class="demo-table">
                     <thead><tr><th>Especie</th><th>Estructura derivada</th><th>e⁻ valencia</th><th>Geometria</th></tr></thead>
                     <tbody>
                       ${demo.rows
                         .map(
                           (r) => `
                           <tr>
                             <th scope="row">${escapeHtml(r.pretty)}</th>
                             <td class="lewis-line">${escapeHtml(r.line)}</td>
                             <td>${r.valenceElectrons}</td>
                             <td>${escapeHtml(shortShape(r.shape))}</td>
                           </tr>
                           ${r.note ? `<tr class="anomaly-note"><td colspan="4">${escapeHtml(r.note)}</td></tr>` : ''}`,
                         )
                         .join('')}
                     </tbody>
                   </table>
                 </div>`
              : ''
          }
          ${
            demo.refused.length > 0
              ? `<div class="demo-gap">
                   <strong>Lo que el motor se NIEGA a derivar:</strong>
                   <ul class="refused-list">
                     ${demo.refused
                       .map(
                         (r) =>
                           `<li><strong>${escapeHtml(r.formula)}</strong> — ${escapeHtml(r.why)}</li>`,
                       )
                       .join('')}
                   </ul>
                   Negarse es parte de la respuesta. Si lo intentara con un compuesto ionico colocaria el
                   metal como atomo central con carga formal negativa: una estructura falsa y convincente,
                   que es la peor clase de error que puede cometer una herramienta de estudio.
                 </div>`
              : ''
          }
        </div>`;

    /* 3.2 — la rampa de ΔEN. */
    case 'bond-scale':
      return `
        <div class="demo">
          <div class="demo-title">La escala de electronegatividad, ordenada</div>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead><tr><th>Enlace</th><th>ΔEN</th><th>Caracter ionico</th><th>Etiqueta</th><th>e⁻ hacia</th></tr></thead>
              <tbody>
                ${demo.rows
                  .map((r) => {
                    const w = Math.min(100, r.ionicCharacter);
                    return `
                    <tr>
                      <th scope="row">${escapeHtml(r.label)}</th>
                      <td>${num(r.deltaEN, 2)}</td>
                      <td class="trend-cell">
                        <span class="trend-track"><span class="trend-bar" style="width:${w.toFixed(1)}%"></span></span>
                        <span class="trend-value">${w.toFixed(0)} %</span>
                      </td>
                      <td><span class="bond-tag is-${escapeHtml(r.kind)}">${escapeHtml(r.kind)}</span></td>
                      <td>${escapeHtml(r.towards)}</td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">
            Leelo de arriba abajo: es una RAMPA continua, sin ningun salto. La etiqueta cambia en
            ΔEN = 1,7 porque alguien eligio ese numero — fijate en que ahi el caracter ionico ronda el
            50 %, es decir, se llamo «ionico» a partir de donde pasa de la mitad. El H–F lo supera y aun
            asi es covalente, porque no hay ningun metal: el convenio no es la ultima palabra.
          </p>
        </div>`;

    /* 3.2.2.5 — LA demostracion. */
    case 'dipole':
      return `
        <div class="demo">
          <div class="demo-title">Dipolos de enlace frente a dipolo de la molecula</div>
          <div class="demo-scroll">
            <table class="demo-table dipole-table">
              <thead>
                <tr>
                  <th>Molecula</th><th>Geometria</th>
                  <th class="col-pair">¿Enlaces polares?</th>
                  <th class="col-pair">¿MOLECULA polar?</th>
                  <th>|μ| neto</th>
                </tr>
              </thead>
              <tbody>
                ${demo.rows
                  .map((r) => {
                    // La fila donde las dos columnas NO coinciden es la que
                    // ensena: enlaces polares y molecula apolar.
                    const contradice = r.bondsArePolar && !r.isPolar;
                    return `
                    <tr class="${contradice ? 'is-contradiction' : ''}">
                      <th scope="row">${escapeHtml(r.pretty)}</th>
                      <td>${escapeHtml(shortShape(r.shape))}</td>
                      <td class="col-pair"><span class="yesno is-${r.bondsArePolar}">${r.bondsArePolar ? 'SI' : 'no'}</span></td>
                      <td class="col-pair"><span class="yesno is-${r.isPolar}">${r.isPolar ? 'SI' : 'no'}</span></td>
                      <td><strong>${num(r.netMagnitude, 2)}</strong></td>
                    </tr>
                    <tr class="dipole-why"><td colspan="5">${escapeHtml(r.reason)}</td></tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">
            Las filas marcadas son las que hay que mirar dos veces: <strong>enlaces polares y molecula
            apolar</strong>. No es una contradiccion — es que el momento dipolar es una SUMA VECTORIAL, y
            el motor la calcula de verdad sobre las posiciones reales de los atomos. Si la geometria
            coloca los dipolos de forma simetrica, la suma da cero por mucho que cada sumando sea grande.
          </p>
        </div>`;

    /* 3.2.2.3 — de donde sale el par. */
    case 'coordinate':
      return `
        <div class="demo">
          <div class="demo-title">Quien pone el par compartido</div>
          ${demo.rows
            .map(
              (r) => `
              <div class="coord-case">
                <h5 class="trend-title">${escapeHtml(r.pretty)}</h5>
                <p class="demo-equation">${escapeHtml(r.line)}</p>
                <table class="demo-table">
                  <tbody>
                    <tr><th scope="row">Dona el par</th><td class="nuclide-note">${escapeHtml(r.donor)}</td></tr>
                    <tr><th scope="row">Lo recibe</th><td class="nuclide-note">${escapeHtml(r.acceptor)}</td></tr>
                  </tbody>
                </table>
                <p class="demo-note">${escapeHtml(r.note)}</p>
              </div>`,
            )
            .join('')}
        </div>`;

    /* 3.2.3 — datos medidos, sin motor. */
    case 'metallic':
      return `
        <div class="demo">
          <div class="demo-title">Metales: datos medidos</div>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead><tr><th>Metal</th><th>e⁻ que cede</th><th>Punto de fusion</th><th>Densidad</th></tr></thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row">${escapeHtml(r.name)} (${escapeHtml(r.symbol)})</th>
                      <td>${r.valence}</td>
                      <td>${r.melting === null ? 'sin dato' : `${num(r.melting - 273.15, 0)} °C`}</td>
                      <td>${r.density === null ? 'sin dato' : `${num(r.density, 2)} g/cm³`}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-gap"><strong>Lo que aqui NO se calcula:</strong> ${escapeHtml(demo.gap)}</p>
        </div>`;

    /* 3.3 — fuerzas, y la medida que las contrasta. */
    case 'imf':
      return `
        <div class="demo">
          <div class="demo-title">Que fuerza domina en cada sustancia</div>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead><tr><th>Sustancia</th><th>Polar</th><th>Fuerza dominante</th><th>e⁻</th><th>M (g/mol)</th><th>Teb medido</th></tr></thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row">${escapeHtml(r.pretty)}</th>
                      <td><span class="yesno is-${r.polar}">${r.polar ? 'SI' : 'no'}</span></td>
                      <td><span class="force-tag is-${escapeHtml(r.dominant)}">${escapeHtml(r.dominant)}</span></td>
                      <td>${r.electrons}</td>
                      <td>${num(r.molarMass, 1)}</td>
                      <td><strong>${r.boiling === null ? 'sin dato' : `${num(r.boiling, 1)} °C`}</strong></td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <h5 class="trend-title">El motor predice, y la medida decide</h5>
          <table class="demo-table">
            <thead><tr><th>Comparacion</th><th>Hierve mas alto</th><th>Por que</th><th>¿Acierta?</th></tr></thead>
            <tbody>
              ${demo.comparisons
                .map(
                  (c) => `
                  <tr>
                    <th scope="row">${escapeHtml(c.a)} / ${escapeHtml(c.b)}</th>
                    <td><strong>${escapeHtml(c.higher)}</strong></td>
                    <td class="nuclide-note">${escapeHtml(c.because)}</td>
                    <td class="check-cell">${
                      c.confirmed === null
                        ? '<span class="yesno">sin dato</span>'
                        : c.confirmed
                          ? '<span class="yesno is-true">✓ lo confirma</span>'
                          : '<span class="yesno is-false">✗ FALLA</span>'
                    }</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p class="demo-note">
            La ultima columna es la que convierte esto en ciencia y no en una opinion: la prediccion sale
            de la estructura de la molecula, y despues se contrasta con puntos de ebullicion MEDIDOS que
            vienen del CRC Handbook. Si alguna fallara, se veria aqui — no se ha escondido ninguna.
          </p>
          <p class="demo-gap"><strong>Y el aviso que acompana a todo el apartado:</strong> ${escapeHtml(demo.caution)}</p>
        </div>`;
  }
}

/** La unidad 3, lista para el lector. */
export function enlaceView(unit: TheoryTopic<BondDemo>): UnitView<BondDemo> {
  return {
    unit,
    demoRenderer: renderDemo,
    claim:
      'Las estructuras de Lewis se derivan de la formula, los momentos dipolares se suman como vectores ' +
      'sobre la geometria real, y las predicciones de punto de ebullicion se contrastan con medidas.',
  };
}
