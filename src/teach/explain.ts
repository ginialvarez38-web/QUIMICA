/**
 * Motor educativo (§34) — modo profesor.
 *
 * Responde, en este orden, a las diez preguntas que el brief enumera:
 *
 *    1. ¿Que tenemos?
 *    2. ¿Que tipo de sustancias son?
 *    3. ¿Que puede reaccionar?
 *    4. ¿Que productos se esperan?
 *    5. ¿Por que?
 *    6. ¿Como se balancea?
 *    7. ¿Que ocurre con los atomos?
 *    8. ¿Que ocurre con los electrones?
 *    9. ¿Que condiciones se necesitan?
 *   10. ¿Que concepto quimico debo aprender?
 *
 * ARQUITECTURA: este modulo NO calcula quimica. Solo consulta a los motores
 * (clasificacion, balanceo, redox, energia) y compone la narracion. Si alguna
 * vez hiciera un calculo propio, existiria el riesgo de que la explicacion y
 * el resultado se contradijeran.
 */

import type { ChemicalEquation, Reaction } from '../core/types.js';
import { classifyFormula, CLASS_LABEL_ES } from '../core/classify.js';
import { oxidationStatesOfFormula, fmt } from '../core/oxidation.js';
import { balanceFormulas } from '../core/balance.js';
import { molarMassOfFormula, arityOf, ARITY_LABEL_ES } from '../core/formula/composition.js';
import { parseFormula } from '../core/formula/parse.js';
import { formatEquation, formatPlainUnicode } from '../core/formula/render.js';
import { nameFormula, preferredName } from '../core/nomenclature/inorganic.js';
import { analyzeRedox } from '../engine/redox.js';
import { analyzeEnergy } from '../engine/energy.js';
import { getSpecies } from '../data/species.js';
import type { Prediction } from '../engine/predict.js';

export interface LessonSection {
  readonly n: number;
  readonly question: string;
  readonly answer: string;
  /** Lineas destacadas: ecuaciones, tablas, listas. */
  readonly details: readonly string[];
  /** Si la seccion no puede responderse con los datos disponibles. */
  readonly unavailable?: boolean;
}

export interface Lesson {
  readonly title: string;
  readonly equationText: string;
  readonly sections: readonly LessonSection[];
  /** Conceptos que el estudiante deberia llevarse. */
  readonly concepts: readonly string[];
}

const HAZARD_TEXT: Record<Reaction['hazard'], string> = {
  safe: '🟢 Segura para simulacion educativa.',
  'special-conditions': '🟡 Requiere condiciones especiales.',
  'hazardous': '🟠 Riesgo quimico relevante.',
  'do-not-attempt': '🔴 No realizar fisicamente sin controles profesionales.',
};

/**
 * Genera la leccion completa para una prediccion o reaccion.
 */
export function explain(prediction: Prediction): Lesson {
  const equation = prediction.equation;
  const reactants = prediction.reactants;
  const products = prediction.products;
  const sections: LessonSection[] = [];

  // --- 1. ¿Que tenemos? --------------------------------------------------
  sections.push({
    n: 1,
    question: '¿Que tenemos?',
    answer: `Partimos de ${reactants.length} sustancia${reactants.length === 1 ? '' : 's'}.`,
    details: reactants.map((f) => describeSubstance(f)),
  });

  // --- 2. ¿Que tipo de sustancias son? -----------------------------------
  sections.push({
    n: 2,
    question: '¿Que tipo de sustancias son?',
    answer:
      'Clasificarlas es el paso que decide que puede pasar: un acido y una base se neutralizan, dos sales intercambian iones, un metal y un no metal se combinan.',
    details: reactants.map((f) => {
      const c = classifyFormula(f);
      if (!c) return `${formatPlainUnicode(f)}: no se ha podido clasificar.`;
      return `${formatPlainUnicode(f)} → ${c.label}. ${c.reason}`;
    }),
  });

  // --- 3. ¿Que puede reaccionar? -----------------------------------------
  sections.push({
    n: 3,
    question: '¿Que puede reaccionar?',
    answer: reactionTypeSentence(prediction),
    details: [
      `Tipo de reaccion: ${prediction.types.join(', ')}.`,
      prediction.rule === 'curated'
        ? 'Esta transformacion esta documentada en la base de datos del sistema.'
        : `Regla aplicada por el motor: ${prediction.rule}.`,
    ],
  });

  // --- 4. ¿Que productos se esperan? -------------------------------------
  sections.push({
    n: 4,
    question: '¿Que productos se esperan?',
    answer: `Se forman ${products.length} producto${products.length === 1 ? '' : 's'}.`,
    details: [
      ...products.map((f) => describeSubstance(f)),
      ...(prediction.dependsOn ? [`⚠ ${prediction.dependsOn}`] : []),
    ],
  });

  // --- 5. ¿Por que? -------------------------------------------------------
  sections.push({
    n: 5,
    question: '¿Por que ocurre esta reaccion?',
    answer: prediction.explanation,
    details: prediction.observations.length
      ? ['Lo que se observaria:', ...prediction.observations.map((o) => `• ${o}`)]
      : [],
  });

  // --- 6. ¿Como se balancea? ---------------------------------------------
  sections.push(balanceSection(reactants, products));

  // --- 7. ¿Que ocurre con los atomos? ------------------------------------
  sections.push(atomsSection(equation));

  // --- 8. ¿Que ocurre con los electrones? --------------------------------
  sections.push(electronsSection(equation));

  // --- 9. ¿Que condiciones se necesitan? ---------------------------------
  sections.push(conditionsSection(prediction));

  // --- 10. ¿Que concepto debo aprender? ----------------------------------
  sections.push({
    n: 10,
    question: '¿Que concepto quimico debo aprender aqui?',
    answer:
      prediction.concepts.length > 0
        ? `Esta reaccion es un buen ejemplo de: ${prediction.concepts.join(', ')}.`
        : 'Los conceptos concretos dependen de en que parte del curso te encuentres.',
    details: prediction.concepts.map((c) => `• ${c}`),
  });

  return {
    title: `${reactants.map(formatPlainUnicode).join(' + ')} → ${products.map(formatPlainUnicode).join(' + ')}`,
    equationText: formatEquation(equation, { showStates: true }),
    sections,
    concepts: prediction.concepts,
  };
}

// ---------------------------------------------------------------------------

function describeSubstance(formula: string): string {
  const species = getSpecies(formula);
  const names = species?.names ?? nameFormula(formula);
  const label = names ? preferredName(names) : null;
  const mass = molarMassOfFormula(formula);
  const parsed = parseFormula(formula);

  const bits: string[] = [formatPlainUnicode(formula)];
  if (label) bits.push(`(${label})`);
  if (mass.ok) bits.push(`— M = ${mass.value.total.toFixed(3)} g/mol`);
  if (parsed.ok) {
    const arity = arityOf(parsed.value.composition);
    bits.push(`— ${ARITY_LABEL_ES[arity].toLowerCase()}`);
  }
  if (species?.properties.appearance) bits.push(`— ${species.properties.appearance}`);
  return bits.join(' ');
}

function reactionTypeSentence(prediction: Prediction): string {
  const t = prediction.types;
  if (t.includes('neutralization')) {
    return 'Un acido y una base pueden neutralizarse: el H⁺ y el OH⁻ se combinan dando agua, y los iones restantes forman una sal.';
  }
  if (t.includes('precipitation')) {
    return 'Dos sales en disolucion pueden intercambiar sus iones. Solo hay reaccion real si uno de los productos abandona la disolucion como precipitado.';
  }
  if (t.includes('single-displacement')) {
    return 'Un elemento libre puede desplazar a otro de su compuesto, siempre que sea mas reactivo, es decir, que ceda electrones con mas facilidad.';
  }
  if (t.includes('combustion')) {
    return 'Un combustible y el oxigeno pueden arder. El carbono acaba como oxido de carbono y el hidrogeno como agua.';
  }
  if (t.includes('decomposition')) {
    return 'Una sola sustancia puede romperse en otras mas sencillas cuando se le aporta suficiente energia.';
  }
  if (t.includes('synthesis')) {
    return 'Dos sustancias pueden combinarse directamente para formar una sola, mas compleja.';
  }
  return 'Las sustancias presentes son compatibles con la transformacion descrita.';
}

function balanceSection(reactants: readonly string[], products: readonly string[]): LessonSection {
  const result = balanceFormulas(reactants, products);
  if (!result.ok) {
    return {
      n: 6,
      question: '¿Como se balancea?',
      answer: `No se ha podido balancear: ${result.error}`,
      details: result.detail ? [result.detail] : [],
      unavailable: true,
    };
  }

  const details: string[] = [
    'La ecuacion se balancea imponiendo que el numero de atomos de cada elemento sea el mismo a ambos lados.',
    '',
    'Elemento │ Reactivos │ Productos',
    '─────────┼───────────┼──────────',
    ...result.value.tally.map(
      (t) =>
        `${t.symbol.padEnd(8)} │ ${String(t.reactants).padStart(9)} │ ${String(t.products).padStart(9)}  ${t.balanced ? '✓' : '✗'}`,
    ),
  ];

  if (result.value.chargeTally.reactants !== 0 || result.value.chargeTally.products !== 0) {
    details.push(
      `Carga    │ ${String(result.value.chargeTally.reactants).padStart(9)} │ ${String(result.value.chargeTally.products).padStart(9)}  ${result.value.chargeTally.balanced ? '✓' : '✗'}`,
    );
    details.push('', 'En una ecuacion ionica tambien debe conservarse la CARGA, no solo los atomos.');
  }

  const coefs = result.value.coefficients;
  const nonTrivial = coefs.some((c) => c !== 1);

  return {
    n: 6,
    question: '¿Como se balancea?',
    answer: nonTrivial
      ? `Los coeficientes minimos enteros son ${coefs.join(', ')}.`
      : 'La ecuacion ya esta balanceada tal como se escribe: todos los coeficientes valen 1.',
    details,
  };
}

function atomsSection(equation: ChemicalEquation): LessonSection {
  const before = new Map<string, number>();
  const after = new Map<string, number>();

  for (const t of equation.reactants) {
    const p = parseFormula(t.formula);
    if (!p.ok) continue;
    for (const [sym, n] of p.value.composition) before.set(sym, (before.get(sym) ?? 0) + n * t.coefficient);
  }
  for (const t of equation.products) {
    const p = parseFormula(t.formula);
    if (!p.ok) continue;
    for (const [sym, n] of p.value.composition) after.set(sym, (after.get(sym) ?? 0) + n * t.coefficient);
  }

  const details = [...before.keys()].map((sym) => {
    const b = before.get(sym) ?? 0;
    const a = after.get(sym) ?? 0;
    return `${sym}: ${b} atomo${b === 1 ? '' : 's'} antes → ${a} despues${b === a ? ' (se conservan)' : ' ⚠'}`;
  });

  return {
    n: 7,
    question: '¿Que ocurre con los atomos?',
    answer:
      'Los atomos no se crean ni se destruyen: solo se REORGANIZAN. Los mismos atomos que estaban en los reactivos estan en los productos, unidos de otra forma. Eso es exactamente lo que significa balancear.',
    details: [
      ...details,
      '',
      'Se rompen unos enlaces y se forman otros. Romper enlaces cuesta energia; formarlos la libera. El balance entre ambas cosas decide si la reaccion desprende o absorbe calor.',
    ],
  };
}

function electronsSection(equation: ChemicalEquation): LessonSection {
  const redox = analyzeRedox(equation);

  if (!redox.isRedox) {
    return {
      n: 8,
      question: '¿Que ocurre con los electrones?',
      answer:
        'NO es una reaccion redox: ningun elemento cambia su estado de oxidacion, luego no hay transferencia neta de electrones.',
      details: [redox.explanation],
    };
  }

  const details: string[] = [];
  details.push('Semirreacciones:');
  for (const h of redox.halfReactions) {
    details.push(`  ${h.kind === 'oxidation' ? 'Oxidacion' : 'Reduccion'}: ${h.text}`);
  }
  details.push('');
  for (const c of redox.changes.slice(0, 6)) {
    details.push(
      `${c.element}: ${fmt(c.fromState)} en ${formatPlainUnicode(c.fromFormula)} → ${fmt(c.toState)} en ${formatPlainUnicode(c.toFormula)} ` +
        `(${c.direction === 'oxidation' ? 'pierde' : 'gana'} ${c.electronsPerAtom} e⁻ por atomo)`,
    );
  }
  if (redox.electronsTransferred !== null) {
    details.push('', `Electrones transferidos en total: ${redox.electronsTransferred}.`);
  }
  details.push(
    '',
    'Cuidado con la terminologia: la especie que SE OXIDA es el AGENTE REDUCTOR, porque al ceder electrones reduce a la otra. Y al reves.',
  );

  return {
    n: 8,
    question: '¿Que ocurre con los electrones?',
    answer: redox.explanation,
    details,
  };
}

function conditionsSection(prediction: Prediction): LessonSection {
  const c = prediction.conditions;
  const details: string[] = [];

  if (c.temperature?.value != null) {
    details.push(`Temperatura: ${c.temperature.value.toFixed(0)} K (${(c.temperature.value - 273.15).toFixed(0)} °C)`);
  }
  if (c.pressure?.value != null) details.push(`Presion: ${c.pressure.value} atm`);
  if (c.solvent) details.push(`Disolvente: ${c.solvent}`);
  if (c.catalyst) details.push(`Catalizador: ${c.catalyst}`);
  if (c.atmosphere) details.push(`Atmosfera: ${c.atmosphere}`);
  if (c.description) details.push(`Observacion: ${c.description}`);

  details.push('', HAZARD_TEXT[prediction.hazard]);

  // Termodinamica frente a cinetica (§19).
  const energy = analyzeEnergy(prediction.equation);
  details.push('', energy.summary);

  if (prediction.evidence === 'conditional') {
    details.push(
      '',
      '⚠ Esta reaccion es CONDICIONAL: solo ocurre asi bajo las condiciones indicadas. Con otras condiciones los productos pueden ser distintos.',
    );
  }
  if (prediction.evidence === 'predicted') {
    details.push(
      '',
      'ℹ Producto PREDICHO por las reglas del motor, no tomado de una entrada curada. Es quimicamente razonable, pero conviene contrastarlo.',
    );
  }

  return {
    n: 9,
    question: '¿Que condiciones se necesitan?',
    answer:
      c.description ??
      'La reaccion transcurre en las condiciones indicadas. Conviene distinguir tres cosas distintas: que sea termodinamicamente posible, que sea cineticamente rapida, y que sea observable en el laboratorio.',
    details,
  };
}

// ---------------------------------------------------------------------------
// Explicacion de una sola sustancia (para la ficha de la biblioteca)
// ---------------------------------------------------------------------------

export interface SubstanceLesson {
  readonly formula: string;
  readonly display: string;
  readonly sections: readonly LessonSection[];
}

export function explainSubstance(formula: string): SubstanceLesson | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;

  const classification = classifyFormula(formula);
  const names = nameFormula(formula);
  const mass = molarMassOfFormula(formula);
  const ox = oxidationStatesOfFormula(formula);
  const species = getSpecies(formula);

  const sections: LessonSection[] = [];

  sections.push({
    n: 1,
    question: '¿Que es esta sustancia?',
    answer: classification
      ? `${CLASS_LABEL_ES[classification.compoundClass]}. ${classification.reason}`
      : 'No se ha podido clasificar.',
    details: [
      `Aridad: ${ARITY_LABEL_ES[arityOf(parsed.value.composition)]} — contiene ${parsed.value.composition.size} elemento${parsed.value.composition.size === 1 ? '' : 's'} distinto${parsed.value.composition.size === 1 ? '' : 's'}.`,
      ...(species?.properties.appearance ? [`Aspecto: ${species.properties.appearance}`] : []),
    ],
  });

  if (names) {
    const rows: string[] = [];
    if (names.common) rows.push(`Comun: ${names.common}`);
    if (names.stock) rows.push(`Stock: ${names.stock}`);
    if (names.systematic) rows.push(`Sistematica: ${names.systematic}`);
    if (names.traditional) rows.push(`Tradicional: ${names.traditional}`);
    sections.push({
      n: 2,
      question: '¿Como se llama?',
      answer: rows.length
        ? 'Una misma sustancia tiene varios nombres validos segun el sistema de nomenclatura.'
        : 'El sistema no dispone de un nombre fiable para esta formula, y prefiere no inventarlo.',
      details: rows,
      unavailable: rows.length === 0,
    });
  }

  if (mass.ok) {
    sections.push({
      n: 3,
      question: '¿Cuanto pesa un mol?',
      answer: `M = ${mass.value.total.toFixed(3)} g/mol`,
      details: [
        ...mass.value.perElement.map(
          (r) =>
            `${r.symbol}: ${r.count} × ${r.atomicMass} = ${r.subtotal.toFixed(3)} g/mol  (${r.massPercent.toFixed(1)} % en masa)`,
        ),
        `Suma: ${mass.value.total.toFixed(3)} g/mol`,
      ],
    });
  }

  if (ox.ok) {
    sections.push({
      n: 4,
      question: '¿Que estados de oxidacion hay?',
      answer: ox.value.balanceText,
      details: ox.value.assignments.map((a) => `${a.symbol}: ${fmt(a.state)} — [${a.rule}] ${a.reason}`),
    });
  }

  return { formula, display: formatPlainUnicode(formula), sections };
}
