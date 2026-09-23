/**
 * UNIDAD 4 — vista.
 *
 * OJO CON EL NOMBRE: esto NO es `combos-view.ts`. Aquel dibuja la tabla
 * interactiva de cationes × aniones que sale de `engine/combinations.ts`; este
 * dibuja el TEMARIO de la unidad 4, que sale de `teach/combos.ts`. Son dos
 * cosas distintas que se llaman parecido porque las dos hablan de
 * combinaciones.
 *
 * LAS DOS DECISIONES DE PRESENTACION QUE IMPORTAN
 *
 * 1. LAS CASILLAS VACIAS SE VEN. En la tabla de nomenclatura, un nombre que el
 *    motor no da se pinta como una raya y no como un hueco en blanco, para que
 *    se distinga «aqui no hay nombre» de «aqui se nos olvido mirar». La
 *    diferencia entre las dos cosas es todo el §32.
 *
 * 2. LA TABLA DE ARIDAD PONE LAS DOS CUENTAS PEGADAS. Igual que en la unidad 3
 *    los dipolos de enlace iban al lado de la polaridad de la molecula para que
 *    la contradiccion saltara sola, aqui «atomos» y «elementos» van en columnas
 *    contiguas, y las filas donde las dos cuentas difieren van marcadas. El
 *    H₂SO₄ con siete atomos y el NaHCO₃ con seis, uno debajo del otro, con el
 *    segundo siendo de orden superior, es el argumento entero del apartado.
 */

import type { ComboDemo } from '../teach/combos.js';
import type { TheoryTopic } from '../teach/theory.js';
import { escapeHtml } from './dom.js';
import { num, type UnitView } from './theory-view.js';

/** Un nombre que el motor no da. Se marca, no se deja en blanco. */
function orDash(name: string | null): string {
  return name ? escapeHtml(name) : '<span class="no-name">sin nombre en este sistema</span>';
}

function renderDemo(demo: ComboDemo): string {
  switch (demo.kind) {
    /* 4.1 y sus hijos — los tres sistemas, con sus huecos. */
    case 'naming':
      return `
        <div class="demo">
          <div class="demo-title">${escapeHtml(demo.title)}</div>
          <div class="demo-scroll">
            <table class="demo-table naming-table">
              <thead>
                <tr>
                  <th>Formula</th><th>Familia</th>
                  <th>Stock</th><th>Sistematica</th><th>Tradicional</th>
                </tr>
              </thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row" class="formula-cell">${escapeHtml(r.pretty)}</th>
                      <td class="nuclide-note">${escapeHtml(r.family)}</td>
                      <td>${orDash(r.stock)}</td>
                      <td>${orDash(r.systematic)}</td>
                      <td>${orDash(r.traditional)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">${escapeHtml(demo.note)}</p>

          ${
            demo.refused.length === 0
              ? ''
              : `
            <h5 class="trend-title">Lo que el motor NO nombra, y por que</h5>
            <table class="demo-table">
              <tbody>
                ${demo.refused
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row" class="formula-cell">${escapeHtml(r.pretty)}</th>
                      <td class="nuclide-note">${escapeHtml(r.why)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            <p class="demo-note">
              Una casilla vacia es un dato: dice que este motor no llega ahi. Rellenarla con un nombre
              plausible seria mas comodo y bastante peor.
            </p>`
          }
        </div>`;

    /* 4.1.3 — atomos frente a elementos. LA tabla de la unidad. */
    case 'arity':
      return `
        <div class="demo">
          <div class="demo-title">Las dos cuentas, una al lado de la otra</div>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead>
                <tr>
                  <th>Formula</th>
                  <th class="is-paired">Atomos</th>
                  <th class="is-paired">Elementos DISTINTOS</th>
                  <th>Como se llama</th>
                </tr>
              </thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) => `
                    <tr${r.trap ? ' class="is-contradiction"' : ''}>
                      <th scope="row" class="formula-cell">${escapeHtml(r.pretty)}</th>
                      <td class="is-paired">${r.atoms}</td>
                      <td class="is-paired"><strong>${r.elements}</strong></td>
                      <td>${escapeHtml(r.label)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">
            Busca el acido sulfurico y el bicarbonato. El primero tiene <strong>siete</strong> atomos y
            es ternario; el segundo tiene <strong>seis</strong> y es cuaternario. Ordenados por atomos
            salen al reves que ordenados por aridad, y eso demuestra que las dos cuentas no tienen nada
            que ver. Solo la segunda decide el nombre.
          </p>
          <p class="demo-note">
            Las filas marcadas son aquellas en las que las dos cuentas no coinciden — es decir, casi
            todas. Que coincidan, como en el NaCl, es la excepcion.
          </p>
        </div>`;

    /* 4.2.1 y 4.2.2 — el calculo, paso a paso y con sus rechazos. */
    case 'empirical':
      return `
        <div class="demo">
          <div class="demo-title">${escapeHtml(demo.title)}</div>
          <p class="demo-note">${escapeHtml(demo.sample)}</p>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead>
                <tr>
                  <th>Elemento</th><th>% en masa</th><th>Masa atomica</th>
                  <th>Moles en 100 g</th><th>÷ el menor</th>
                  ${demo.multiplier > 1 ? `<th>× ${demo.multiplier}</th>` : ''}
                  <th>Subindice</th>
                </tr>
              </thead>
              <tbody>
                ${demo.steps
                  .map(
                    (s) => `
                    <tr>
                      <th scope="row">${escapeHtml(s.symbol)}</th>
                      <td>${num(s.percent, 2)} %</td>
                      <td>${num(s.atomicMass, 3)}</td>
                      <td>${num(s.moles, 4)}</td>
                      <td>${num(s.ratio, 3)}</td>
                      ${demo.multiplier > 1 ? `<td>${num(s.scaled, 3)}</td>` : ''}
                      <td><strong>${s.subscript}</strong></td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-equation">
            Formula minima: <strong>${escapeHtml(demo.empiricalPretty)}</strong>
            &nbsp;·&nbsp; M = ${num(demo.empiricalMass, 3)} g/mol
          </p>
          ${
            demo.multiplier > 1
              ? `<p class="demo-note">
                   Las razones no salieron enteras, asi que se multiplicaron TODAS por
                   ${demo.multiplier}. No se redondeo ninguna: redondear un subindice es cambiar de
                   sustancia.
                 </p>`
              : `<p class="demo-note">
                   Las razones salieron enteras a la primera, asi que no hizo falta multiplicar por
                   nada. Cuando no salen, se multiplica el conjunto entero — nunca se redondea una
                   sola.
                 </p>`
          }

          ${
            demo.molar === null
              ? ''
              : `
            <h5 class="trend-title">Y ahora, con la masa molar</h5>
            <table class="demo-table">
              <tbody>
                <tr><th scope="row">Masa molar medida</th><td>${num(demo.molar.given, 2)} g/mol</td></tr>
                <tr><th scope="row">Masa de la formula minima</th><td>${num(demo.empiricalMass, 3)} g/mol</td></tr>
                <tr><th scope="row">n = M / M(minima)</th><td><strong>${num(demo.molar.factorRaw, 3)}</strong></td></tr>
                <tr><th scope="row">n, redondeado a entero</th><td>${demo.molar.factor}</td></tr>
              </tbody>
            </table>
            <p class="demo-equation">
              ${escapeHtml(demo.empiricalPretty)} × ${demo.molar.factor} =
              <strong>${escapeHtml(demo.molar.molecularPretty)}</strong>
              &nbsp;·&nbsp; M = ${num(demo.molar.molecularMass, 2)} g/mol
            </p>
            <p class="demo-note">
              Mira el <strong>${num(demo.molar.factorRaw, 3)}</strong>: sale practicamente entero, y
              tiene que salirlo. Una molecula contiene un numero entero de veces su formula minima. Si
              hubiera salido 5,8, el fallo estaria en la masa molar o en los porcentajes.
            </p>`
          }

          ${
            demo.refused.length === 0
              ? ''
              : `
            <h5 class="trend-title">Datos con los que el motor se niega a seguir</h5>
            <table class="demo-table">
              <tbody>
                ${demo.refused
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row">${escapeHtml(r.label)}</th>
                      <td class="nuclide-note">${escapeHtml(r.why)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            <p class="demo-note">
              Estos no son errores del programa: son el programa negandose a inventar. Un numero
              aproximado aqui no es «casi la respuesta», es otra sustancia.
            </p>`
          }
        </div>`;

    /* 4.2 — tres sustancias, los mismos porcentajes. */
    case 'same-ratio':
      return `
        <div class="demo">
          <div class="demo-title">Tres sustancias distintas con el mismo analisis</div>
          <p class="demo-equation">
            ${demo.percents.map((p) => `${escapeHtml(p.symbol)} ${num(p.percent, 2)} %`).join(' &nbsp;·&nbsp; ')}
          </p>
          <div class="demo-scroll">
            <table class="demo-table">
              <thead>
                <tr><th>Formula</th><th>Que es</th><th>Formula minima</th><th>M (g/mol)</th><th>n</th></tr>
              </thead>
              <tbody>
                ${demo.rows
                  .map(
                    (r) => `
                    <tr>
                      <th scope="row" class="formula-cell">${escapeHtml(r.pretty)}</th>
                      <td>${escapeHtml(r.name)}</td>
                      <td class="formula-cell">${escapeHtml(r.empirical)}</td>
                      <td>${num(r.molarMass, 2)}</td>
                      <td><strong>${r.factor}</strong></td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <p class="demo-note">
            Los porcentajes de arriba no estan escritos a mano: se han calculado a partir de la glucosa,
            y despues se ha comprobado que las tres formulas devuelven la MISMA formula minima. La
            columna «formula minima» es esa comprobacion, no una afirmacion.
          </p>
          <p class="demo-gap">
            <strong>Lo que esto significa:</strong> un analisis elemental que diga «40,00 % de carbono»
            es compatible con las tres. Una es un conservante de cadaveres, otra es vinagre y otra es
            azucar. Sin la masa molar no hay forma de elegir — y por eso existe el apartado 4.2.2.
          </p>
        </div>`;

    /* 4.2.3 — el desglose que ES la composicion porcentual. */
    case 'percent':
      return `
        <div class="demo">
          <div class="demo-title">De donde sale cada tanto por ciento</div>
          ${demo.rows
            .map(
              (r) => `
              <h5 class="trend-title">${escapeHtml(r.pretty)} &nbsp;·&nbsp; M = ${num(r.total, 3)} g/mol</h5>
              <table class="demo-table">
                <thead>
                  <tr><th>Elemento</th><th>Atomos</th><th>Masa atomica</th><th>Aporta</th><th>% en masa</th><th></th></tr>
                </thead>
                <tbody>
                  ${r.parts
                    .map(
                      (p) => `
                      <tr>
                        <th scope="row">${escapeHtml(p.symbol)}</th>
                        <td>${p.count}</td>
                        <td>${num(p.atomicMass, 3)}</td>
                        <td>${num(p.subtotal, 3)}</td>
                        <td><strong>${num(p.percent, 2)} %</strong></td>
                        <td class="trend-cell">
                          <span class="trend-track">
                            <span class="trend-bar is-mass" style="width:${p.percent.toFixed(1)}%"></span>
                          </span>
                        </td>
                      </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>`,
            )
            .join('')}
          <p class="demo-note">
            Mira el agua: <strong>dos</strong> hidrogenos frente a <strong>un</strong> oxigeno, y aun
            asi el hidrogeno se queda en el 11 %. Contar atomos y pesar atomos son dos cosas distintas,
            y las barras lo ensenan de un vistazo. Cada oxigeno pesa unas dieciseis veces lo que un
            hidrogeno.
          </p>
        </div>`;
  }
}

/** La unidad 4, lista para el lector. */
export function combinacionesView(unit: TheoryTopic<ComboDemo>): UnitView<ComboDemo> {
  return {
    unit,
    demoRenderer: renderDemo,
    claim:
      'Los nombres los genera el motor de nomenclatura formula a formula, con sus huecos incluidos; las ' +
      'formulas minimas y moleculares se calculan a partir de los porcentajes, y el motor rechaza los ' +
      'datos con los que no se puede concluir en lugar de redondearlos.',
  };
}
