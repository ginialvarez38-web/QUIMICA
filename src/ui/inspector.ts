/**
 * Inspector: las cuatro pestanas del panel derecho.
 *
 *   Ficha      — propiedades, nomenclatura y estados de oxidacion (§27, §28)
 *   Lewis      — estructura electronica y geometria (§15)
 *   Balance    — recuento de atomos y carga, y analisis redox (§10, §17)
 *   Explicame  — modo profesor con las diez preguntas (§34)
 *
 * Todo lo que se muestra viene de los motores; este modulo solo compone HTML.
 * Cuando un dato no existe se escribe "Dato no disponible", nunca un valor
 * aproximado (§27).
 */

import type { Measured, Species, Structure } from '../core/types.js';
import { escapeHtml, num } from './dom.js';
import { parseFormula } from '../core/formula/parse.js';
import { formatFormulaHtml, formatPlainUnicode, formatEquationHtml } from '../core/formula/render.js';
import { molarMassOfFormula, ARITY_LABEL_ES, arityOf, atomCount } from '../core/formula/composition.js';
import { classifyFormula, CLASS_LABEL_ES } from '../core/classify.js';
import { nameFormula, NOMENCLATURE_LABELS } from '../core/nomenclature/inorganic.js';
import { oxidationStatesOfFormula, fmt } from '../core/oxidation.js';
import { getSpecies } from '../data/species.js';
import { getElement } from '../data/elements.js';
import { solubilityOf } from '../engine/rules/solubility.js';
import { analyzeRedox } from '../engine/redox.js';
import { analyzeEnergy } from '../engine/energy.js';
import { balanceFormulas } from '../core/balance.js';
import { buildLewis } from '../render/lewis.js';
import { describeGeometry } from '../geometry/vsepr.js';
import { explain, explainSubstance } from '../teach/explain.js';
import type { Prediction } from '../engine/predict.js';
import type { BuiltFormula } from '../core/build/ionicFormula.js';

const UNAVAILABLE = '<span class="prop-unavailable">Dato no disponible</span>';

const HAZARD_LABEL: Record<string, string> = {
  safe: '🟢 Segura para simulacion educativa',
  'special-conditions': '🟡 Requiere condiciones especiales',
  hazardous: '🟠 Riesgo quimico relevante',
  'do-not-attempt': '🔴 No realizar fisicamente sin controles profesionales',
};

const EVIDENCE_LABEL: Record<string, string> = {
  established: 'Reaccion documentada',
  conditional: 'Depende de las condiciones',
  predicted: 'Prediccion del motor',
  unknown: 'Sin reaccion apreciable',
};

/** Renderiza un valor medido con su unidad, o "Dato no disponible". */
function measured(m: Measured | undefined, digits = 3, transform?: (v: number) => string): string {
  if (!m || m.value === null) return UNAVAILABLE;
  if (transform) return escapeHtml(transform(m.value));
  return `${num(m.value, digits)} ${escapeHtml(m.unit)}`;
}

function kelvinToCelsius(k: number): string {
  return `${num(k - 273.15, 4)} °C`;
}

function row(label: string, value: string): string {
  return `<tr><td>${escapeHtml(label)}</td><td>${value}</td></tr>`;
}

// ---------------------------------------------------------------------------
// Pestana: FICHA
// ---------------------------------------------------------------------------

export function renderFicha(formula: string): string {
  const parsed = parseFormula(formula);
  if (!parsed.ok) {
    return `<div class="notice danger">No se ha podido interpretar la formula «${escapeHtml(formula)}».<br>${escapeHtml(parsed.error)}</div>`;
  }

  const species = getSpecies(formula);
  const classification = classifyFormula(formula);
  const names = species?.names ?? nameFormula(formula);
  const mass = molarMassOfFormula(formula);
  const composition = parsed.value.composition;

  const out: string[] = [];

  // --- Encabezado --------------------------------------------------------
  const displayName = names?.common ?? names?.stock ?? names?.systematic ?? '';
  out.push(`
    <div class="section">
      <div class="formula-display">${formatFormulaHtml(parsed.value)}</div>
      ${displayName ? `<div class="formula-name">${escapeHtml(displayName)}</div>` : ''}
      ${
        classification
          ? `<div class="tag-row"><span class="tag">${escapeHtml(CLASS_LABEL_ES[classification.compoundClass])}</span>
             <span class="tag">${escapeHtml(ARITY_LABEL_ES[arityOf(composition)])}</span></div>`
          : ''
      }
      ${
        species
          ? `<div class="hazard-banner ${species.properties.hazard}">${escapeHtml(HAZARD_LABEL[species.properties.hazard] ?? '')}</div>`
          : ''
      }
      ${classification ? `<p class="small muted" style="margin:0">${escapeHtml(classification.reason)}</p>` : ''}
    </div>`);

  // --- Nomenclatura (§28) ------------------------------------------------
  if (names) {
    const rows = (['common', 'stock', 'systematic', 'traditional'] as const)
      .filter((k) => names[k])
      .map(
        (k) => `<div class="nomenclature-row">
            <span class="nomenclature-system">${escapeHtml(NOMENCLATURE_LABELS[k])}</span>
            <span class="nomenclature-name">${escapeHtml(names[k]!)}</span>
          </div>`,
      )
      .join('');
    if (rows) {
      out.push(`<div class="section"><h3 class="section-title">Nomenclatura</h3>${rows}</div>`);
    }
  }

  // --- Composicion y masa molar ------------------------------------------
  if (mass.ok) {
    const breakdown = mass.value.perElement
      .map(
        (r) =>
          row(
            `${getElement(r.symbol)?.name ?? r.symbol} × ${r.count}`,
            `${num(r.subtotal, 4)} <span class="faint">(${num(r.massPercent, 3)} %)</span>`,
          ),
      )
      .join('');
    out.push(`
      <div class="section">
        <h3 class="section-title">Masa molar</h3>
        <table class="prop-table">
          ${breakdown}
          ${row('Total', `<strong>${num(mass.value.total, 5)} g/mol</strong>`)}
          ${row('Atomos totales', String(atomCount(composition)))}
          ${row('Elementos distintos', String(composition.size))}
        </table>
      </div>`);
  }

  // --- Propiedades fisicas (§27) -----------------------------------------
  if (species) {
    const p = species.properties;
    const solubility = solubilityOf(formula);
    const SOLUBILITY_TEXT: Record<string, string> = {
      soluble: 'Soluble',
      'slightly-soluble': 'Poco soluble',
      insoluble: 'Insoluble',
      unknown: 'No determinada',
    };
    const STATE_TEXT: Record<string, string> = {
      s: 'Solido', l: 'Liquido', g: 'Gas', aq: 'En disolucion acuosa',
    };

    out.push(`
      <div class="section">
        <h3 class="section-title">Propiedades</h3>
        <table class="prop-table">
          ${row('Estado (25 °C)', p.state ? escapeHtml(STATE_TEXT[p.state] ?? p.state) : UNAVAILABLE)}
          ${row('Aspecto', p.appearance ? escapeHtml(p.appearance) : UNAVAILABLE)}
          ${row('Densidad', measured(p.density, 4))}
          ${row('Punto de fusion', measured(p.meltingPoint, 5, kelvinToCelsius))}
          ${row('Punto de ebullicion', measured(p.boilingPoint, 5, kelvinToCelsius))}
          ${row('Solubilidad en agua', escapeHtml(SOLUBILITY_TEXT[solubility.solubility] ?? '—'))}
          ${p.solubility.gramsPer100mL ? row('', measured(p.solubility.gramsPer100mL, 4)) : ''}
          ${row('pKa', measured(p.pKa, 3))}
          ${row('pKb', measured(p.pKb, 3))}
          ${row('ΔH°f', measured(p.deltaHf, 5))}
          ${row('ΔG°f', measured(p.deltaGf, 5))}
          ${row('S°', measured(p.standardEntropy, 4))}
        </table>
        <p class="small faint" style="margin-top:8px">${escapeHtml(solubility.rule)}</p>
      </div>`);

    if (p.notes.length > 0) {
      out.push(`
        <div class="section">
          <h3 class="section-title">Notas</h3>
          <div class="stack small muted">${p.notes.map((n) => `<div>• ${escapeHtml(n)}</div>`).join('')}</div>
        </div>`);
    }
  } else {
    out.push(
      `<div class="notice info">Esta sustancia no esta en la biblioteca curada, asi que solo se muestran las propiedades que el motor puede DERIVAR de la formula. No se inventan valores experimentales.</div>`,
    );
  }

  // --- Estados de oxidacion ----------------------------------------------
  const ox = oxidationStatesOfFormula(formula);
  if (ox.ok) {
    const items = ox.value.assignments
      .map(
        (a) => `<div class="ox-item">
          <span class="ox-badge">${escapeHtml(a.symbol)} ${escapeHtml(fmt(a.state))}</span>
          <span class="ox-reason"><span class="ox-rule">[${escapeHtml(a.rule)}]</span>${escapeHtml(a.reason)}</span>
        </div>`,
      )
      .join('');
    out.push(`
      <div class="section">
        <h3 class="section-title">Estados de oxidacion</h3>
        ${items}
        <div class="derivation-math" style="margin-top:8px">${escapeHtml(ox.value.balanceText)}</div>
        ${ox.value.notes.map((n) => `<p class="small muted" style="margin:8px 0 0">${escapeHtml(n)}</p>`).join('')}
      </div>`);
  }

  return out.join('');
}

// ---------------------------------------------------------------------------
// Pestana: LEWIS / ESTRUCTURA
// ---------------------------------------------------------------------------

export function renderEstructura(formula: string, structure: Structure | null): string {
  if (!structure) {
    return `<div class="notice info">No hay una estructura tridimensional disponible para <strong>${escapeHtml(formatPlainUnicode(formula))}</strong>.<br><br>El generador construye moleculas por VSEPR y redes ionicas, pero no adivina la conectividad de cualquier compuesto: prefiere no mostrar nada antes que dibujar una geometria falsa.</div>`;
  }

  const out: string[] = [];

  if (structure.motif === 'ionic-lattice') {
    out.push(`<div class="notice info">Esta sustancia forma una <strong>red ionica</strong>, no moleculas discretas. Lo que se ve en el visor es una porcion del cristal: no existe "una molecula" de esta sustancia, sino un ordenamiento periodico de iones que se extiende por todo el solido.</div>`);
  }

  // --- Geometria VSEPR ---------------------------------------------------
  const geometry = describeGeometry(structure);
  if (geometry) {
    out.push(`
      <div class="section">
        <h3 class="section-title">Geometria molecular</h3>
        <table class="prop-table">
          ${row('Notacion', `<strong>${escapeHtml(geometry.axeNotation)}</strong>`)}
          ${row('Numero esterico', String(geometry.stericNumber))}
          ${row('Atomos enlazados', String(geometry.bondedAtoms))}
          ${row('Pares libres', String(geometry.lonePairs))}
          ${row('Dominios electronicos', escapeHtml(geometry.electronGeometry))}
          ${row('Geometria molecular', `<strong>${escapeHtml(geometry.geometry)}</strong>`)}
          ${row('Angulo de enlace', geometry.idealAngle ? `${num(geometry.idealAngle, 4)}°` : UNAVAILABLE)}
        </table>
        <p class="small muted" style="margin-top:8px">${escapeHtml(geometry.explanation)}</p>
      </div>`);
  }

  // --- Diagrama de Lewis (§15) -------------------------------------------
  if (structure.motif === 'molecular' || structure.motif === 'atomic') {
    const lewis = buildLewis(structure);
    out.push(`
      <div class="section">
        <h3 class="section-title">Estructura de Lewis</h3>
        ${lewis.svg}
        <table class="prop-table" style="margin-top:10px">
          ${row('Electrones de valencia', String(lewis.totalValenceElectrons))}
        </table>
      </div>`);

    const atomRows = lewis.atoms
      .map(
        (a) =>
          row(
            `${a.symbol} · ${a.lonePairs} par${a.lonePairs === 1 ? '' : 'es'} libre${a.lonePairs === 1 ? '' : 's'}`,
            `${a.totalElectrons} e⁻${a.formalCharge !== 0 ? ` · carga formal ${fmt(a.formalCharge)}` : ''}`,
          ),
      )
      .join('');
    out.push(`<div class="section"><h3 class="section-title">Recuento electronico por atomo</h3><table class="prop-table">${atomRows}</table></div>`);

    if (lewis.notes.length > 0) {
      out.push(
        `<div class="section"><h3 class="section-title">Observaciones</h3>${lewis.notes
          .map((n) => `<div class="notice warn">${escapeHtml(n)}</div>`)
          .join('')}</div>`,
      );
    }
  }

  // --- Enlaces -----------------------------------------------------------
  const BOND_LABEL: Record<string, string> = {
    ionic: 'Ionico',
    'covalent-nonpolar': 'Covalente apolar',
    'covalent-polar': 'Covalente polar',
    metallic: 'Metalico',
    coordinate: 'Dativo',
    hydrogen: 'Puente de hidrogeno',
    'van-der-waals': 'Van der Waals',
  };
  const ORDER_LABEL = ['', 'simple', 'doble', 'triple'];

  if (structure.bonds.length > 0 && structure.motif !== 'ionic-lattice') {
    const bondRows = structure.bonds
      .map((b) => {
        const a = structure.atoms[b.a];
        const c = structure.atoms[b.b];
        if (!a || !c) return '';
        return row(
          `${a.symbol}—${c.symbol} (${ORDER_LABEL[b.order]})`,
          `${escapeHtml(BOND_LABEL[b.kind] ?? b.kind)}${b.electronegativityDelta !== undefined ? ` <span class="faint">Δχ ${num(b.electronegativityDelta, 3)}</span>` : ''}`,
        );
      })
      .join('');
    out.push(`
      <div class="section">
        <h3 class="section-title">Enlaces</h3>
        <table class="prop-table">${bondRows}</table>
        <p class="small faint" style="margin-top:8px">El tipo de enlace se asigna por la diferencia de electronegatividad (Δχ ≥ 1,7 ionico; ≥ 0,4 covalente polar). Los umbrales son una convencion didactica: en realidad el caracter ionico varia de forma continua.</p>
      </div>`);
  }

  return out.join('');
}

// ---------------------------------------------------------------------------
// Pestana: BALANCE
// ---------------------------------------------------------------------------

export function renderBalance(prediction: Prediction | null): string {
  if (!prediction) {
    return `<div class="empty-state">Selecciona una reaccion en el banco para ver el balance de atomos, la conservacion de la carga y el analisis redox.</div>`;
  }

  const out: string[] = [];
  const result = balanceFormulas([...prediction.reactants], [...prediction.products]);

  out.push(`
    <div class="section">
      <h3 class="section-title">Ecuacion balanceada</h3>
      <div class="reaction-equation">${formatEquationHtml(prediction.equation, { showStates: true })}</div>
    </div>`);

  // --- Recuento de atomos (§10) ------------------------------------------
  if (result.ok) {
    const rows = result.value.tally
      .map(
        (t) => `<tr>
          <td>${escapeHtml(t.symbol)}</td>
          <td>${t.reactants}</td>
          <td>${t.products}</td>
          <td class="${t.balanced ? 'tally-ok' : 'tally-bad'}">${t.balanced ? '✓' : '✗'}</td>
        </tr>`,
      )
      .join('');

    const charge = result.value.chargeTally;
    const chargeRow =
      charge.reactants !== 0 || charge.products !== 0
        ? `<tr><td>Carga</td><td>${charge.reactants}</td><td>${charge.products}</td>
             <td class="${charge.balanced ? 'tally-ok' : 'tally-bad'}">${charge.balanced ? '✓' : '✗'}</td></tr>`
        : '';

    out.push(`
      <div class="section">
        <h3 class="section-title">Conservacion de la materia</h3>
        <table class="tally-table">
          <thead><tr><th>Elemento</th><th>Reactivos</th><th>Productos</th><th></th></tr></thead>
          <tbody>${rows}${chargeRow}</tbody>
        </table>
        <p class="small muted" style="margin-top:8px">Coeficientes minimos enteros: <span class="mono">${result.value.coefficients.join(', ')}</span></p>
        ${result.value.warnings.map((w) => `<div class="notice warn">${escapeHtml(w)}</div>`).join('')}
      </div>`);
  } else {
    out.push(`<div class="notice danger">${escapeHtml(result.error)}<br><br>${escapeHtml(result.detail ?? '')}</div>`);
  }

  // --- Redox (§17) -------------------------------------------------------
  const redox = analyzeRedox(prediction.equation);
  out.push(`<div class="section"><h3 class="section-title">Analisis redox</h3>`);
  if (redox.isRedox) {
    out.push(
      redox.halfReactions
        .map(
          (h) => `<div class="half-reaction ${h.kind}">
            <span class="half-reaction-label">${h.kind === 'oxidation' ? 'Oxidacion (cede electrones)' : 'Reduccion (capta electrones)'}</span>
            ${escapeHtml(h.text)}
          </div>`,
        )
        .join(''),
    );
    out.push(`<table class="prop-table" style="margin-top:10px">
      ${row('Agente oxidante', redox.oxidizingAgent ? formatPlainUnicode(redox.oxidizingAgent) : '—')}
      ${row('Agente reductor', redox.reducingAgent ? formatPlainUnicode(redox.reducingAgent) : '—')}
      ${row('Electrones transferidos', redox.electronsTransferred !== null ? String(redox.electronsTransferred) : UNAVAILABLE)}
      ${row('Desproporcion', redox.isDisproportionation ? 'Si' : 'No')}
    </table>`);
  }
  out.push(`<p class="small muted" style="margin-top:8px">${escapeHtml(redox.explanation)}</p></div>`);

  // --- Energia (§18) -----------------------------------------------------
  const energy = analyzeEnergy(prediction.equation);
  out.push(`
    <div class="section">
      <h3 class="section-title">Perfil energetico</h3>
      <table class="prop-table">
        ${row('ΔH°', measured(energy.profile.deltaH, 5))}
        ${row('ΔG°', measured(energy.profile.deltaG, 5))}
        ${row('ΔS°', measured(energy.profile.deltaS, 5))}
        ${row('Energia de activacion', UNAVAILABLE)}
        ${row('Caracter', energy.profile.character === 'exothermic' ? 'Exotermica' : energy.profile.character === 'endothermic' ? 'Endotermica' : UNAVAILABLE)}
      </table>
      <p class="small muted" style="margin-top:8px">${escapeHtml(energy.summary)}</p>
      ${
        energy.workings.length
          ? `<div class="lesson-details" style="margin-top:8px">${escapeHtml(energy.workings.join('\n'))}</div>`
          : ''
      }
      <p class="small faint" style="margin-top:8px">La energia de activacion no se estima nunca: depende del mecanismo y no se deriva de las entalpias de formacion.</p>
    </div>`);

  return out.join('');
}

// ---------------------------------------------------------------------------
// Pestana: EXPLICAME (modo profesor, §34)
// ---------------------------------------------------------------------------

export function renderProfesor(prediction: Prediction | null, formula: string | null): string {
  if (prediction) {
    const lesson = explain(prediction);
    const sections = lesson.sections
      .map(
        (s) => `<div class="lesson-section">
          <h4 class="lesson-question"><span class="lesson-number">${s.n}</span>${escapeHtml(s.question)}</h4>
          <p class="lesson-answer">${escapeHtml(s.answer)}</p>
          ${
            s.details.length
              ? `<div class="lesson-details">${escapeHtml(s.details.join('\n'))}</div>`
              : ''
          }
        </div>`,
      )
      .join('');
    return `<div class="section">
      <h3 class="section-title">Modo profesor</h3>
      <div class="reaction-equation" style="margin-bottom:14px">${formatEquationHtml(prediction.equation, { showStates: true })}</div>
      ${sections}
    </div>`;
  }

  if (formula) {
    const lesson = explainSubstance(formula);
    if (!lesson) return `<div class="empty-state">No se ha podido analizar esta sustancia.</div>`;
    const sections = lesson.sections
      .map(
        (s) => `<div class="lesson-section">
          <h4 class="lesson-question"><span class="lesson-number">${s.n}</span>${escapeHtml(s.question)}</h4>
          <p class="lesson-answer">${escapeHtml(s.answer)}</p>
          ${s.details.length ? `<div class="lesson-details">${escapeHtml(s.details.join('\n'))}</div>` : ''}
        </div>`,
      )
      .join('');
    return `<div class="section"><h3 class="section-title">Modo profesor</h3>${sections}</div>`;
  }

  return `<div class="empty-state">Elige una sustancia o ejecuta una reaccion, y el sistema la explicara paso a paso: que tenemos, que puede reaccionar, que productos se esperan, por que, como se balancea, que ocurre con los atomos y con los electrones, y que concepto hay detras.</div>`;
}

// ---------------------------------------------------------------------------
// Derivacion del constructor (§5, §7)
// ---------------------------------------------------------------------------

/**
 * Los seis pasos que llevan de dos iones a una formula.
 *
 * El brief es explicito: «No simplemente mostrar el resultado». Este bloque es
 * la razon de ser del modo Construir, y va ARRIBA del todo en el inspector,
 * por delante de la ficha del compuesto: primero el razonamiento, despues el
 * dato.
 */
export function renderDerivation(built: BuiltFormula): string {
  const steps = built.derivation
    .map(
      (s) => `<div class="derivation-step">
        <span class="derivation-number">${s.n}</span>
        <div>
          <div class="derivation-title">${escapeHtml(s.title)}</div>
          <div class="derivation-detail">${escapeHtml(s.detail)}</div>
          ${s.math ? `<div class="derivation-math">${escapeHtml(s.math)}</div>` : ''}
        </div>
      </div>`,
    )
    .join('');

  return `<div class="section">
    <h3 class="section-title">Como se llega a esta formula</h3>
    <div class="derivation-headline">
      <span class="derivation-ion">${escapeHtml(formatPlainUnicode(built.cation.formula))}${chargeSup(built.cation.charge)}</span>
      <span class="derivation-op">+</span>
      <span class="derivation-ion">${escapeHtml(formatPlainUnicode(built.anion.formula))}${chargeSup(built.anion.charge)}</span>
      <span class="derivation-op">→</span>
      <span class="derivation-outcome">${escapeHtml(built.display)}</span>
    </div>
    ${steps}
  </div>`;
}

function chargeSup(charge: number): string {
  const magnitude = Math.abs(charge);
  const digits = magnitude === 1 ? '' : String(magnitude).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
  return `${digits}${charge > 0 ? '⁺' : '⁻'}`;
}

// ---------------------------------------------------------------------------
// Tarjeta de reaccion, usada en el banco
// ---------------------------------------------------------------------------

export function renderReactionCard(prediction: Prediction, selected: boolean): string {
  const observations = prediction.observations.filter(Boolean);
  return `
    <article class="reaction-card" data-prediction="${escapeHtml(prediction.id)}" aria-current="${selected}">
      <div class="reaction-equation" data-action="select">${formatEquationHtml(prediction.equation, { showStates: true })}</div>
      <div class="tag-row">
        <span class="tag evidence-${prediction.evidence}">${escapeHtml(EVIDENCE_LABEL[prediction.evidence] ?? prediction.evidence)}</span>
        <span class="tag hazard-${prediction.hazard}">${escapeHtml((HAZARD_LABEL[prediction.hazard] ?? '').slice(2))}</span>
        ${prediction.types.slice(0, 3).map((t) => `<span class="tag">${escapeHtml(TYPE_LABEL[t] ?? t)}</span>`).join('')}
        <span class="tag">Nivel ${prediction.difficulty}</span>
      </div>
      <p class="reaction-why">${escapeHtml(prediction.explanation)}</p>
      ${
        prediction.dependsOn
          ? `<div class="notice warn" style="margin-top:9px">${escapeHtml(prediction.dependsOn)}</div>`
          : ''
      }
      ${
        observations.length
          ? `<p class="small faint" style="margin-top:8px">Se observaria: ${escapeHtml(observations.join(' · '))}</p>`
          : ''
      }
      ${
        prediction.conditions.description
          ? `<p class="small faint" style="margin-top:4px">Condiciones: ${escapeHtml(prediction.conditions.description)}${prediction.conditions.catalyst ? ` · catalizador: ${escapeHtml(prediction.conditions.catalyst)}` : ''}</p>`
          : ''
      }
      <div class="reaction-actions">
        <button class="button" data-action="simulate">Simular</button>
        <button class="button" data-action="explain">Explicame</button>
        <button class="button" data-action="balance">Balance</button>
        ${prediction.products.map((p) => `<button class="button button-ghost" data-action="open" data-formula="${escapeHtml(p)}">→ ${escapeHtml(formatPlainUnicode(p))}</button>`).join('')}
      </div>
    </article>`;
}

const TYPE_LABEL: Record<string, string> = {
  synthesis: 'Sintesis',
  decomposition: 'Descomposicion',
  'single-displacement': 'Sustitucion simple',
  'double-displacement': 'Doble sustitucion',
  combustion: 'Combustion',
  neutralization: 'Neutralizacion',
  precipitation: 'Precipitacion',
  'acid-base': 'Acido-base',
  redox: 'Redox',
  hydrolysis: 'Hidrolisis',
  hydration: 'Hidratacion',
  calcination: 'Calcinacion',
  dissolution: 'Disolucion',
  complexation: 'Complejacion',
  substitution: 'Sustitucion',
  elimination: 'Eliminacion',
  addition: 'Adicion',
  esterification: 'Esterificacion',
  saponification: 'Saponificacion',
  polymerization: 'Polimerizacion',
  oxidation: 'Oxidacion',
  reduction: 'Reduccion',
};

export { TYPE_LABEL, HAZARD_LABEL, EVIDENCE_LABEL };
