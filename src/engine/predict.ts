/**
 * Motor de prediccion de reacciones (§8, §9, §23, §32).
 *
 * Dada una lista de reactivos, propone productos QUIMICAMENTE PLAUSIBLES.
 *
 * TRES PRINCIPIOS DE DISENO
 *
 * 1. La base de datos curada manda. Si la combinacion de reactivos aparece en
 *    reactions.ts, se devuelve esa entrada con evidencia 'established' o
 *    'conditional'. Las reglas solo actuan cuando no hay dato curado, y lo que
 *    producen se marca siempre como 'predicted'.
 *
 * 2. Se devuelven TODAS las alternativas, no una. Fe + O2 puede dar FeO,
 *    Fe2O3 o Fe3O4 segun las condiciones; el brief exige (§23, §32) mostrar
 *    las opciones y explicar de que dependen, no elegir en silencio.
 *
 * 3. Toda prediccion se balancea antes de devolverse. Si no balancea, se
 *    descarta: el motor nunca propone una ecuacion que viole la conservacion
 *    de la materia.
 */

import type {
  ChemicalEquation,
  EvidenceLevel,
  HazardLevel,
  ReactionCondition,
  ReactionType,
} from '../core/types.js';
import { balanceFormulas } from '../core/balance.js';
import { parseFormula } from '../core/formula/parse.js';
import { classify, isAcid, isBase, type Classification } from '../core/classify.js';
import { getSpecies } from '../data/species.js';
import { REACTIONS } from '../data/reactions.js';
import { buildIonicFormula } from '../core/build/ionicFormula.js';
import { getIon, getIonsByFormula, CATIONS_BY_ELEMENT, ANION_LIST } from '../data/ions.js';
import { getElement } from '../data/elements.js';
import { solubilityOf, splitSalt } from './rules/solubility.js';
import { activityOf, displaces, reactsWithAcid, isInActivitySeries } from './rules/activity.js';
import { METALLIC_CATEGORIES } from '../core/types.js';

export interface Prediction {
  readonly id: string;
  readonly reactants: readonly string[];
  readonly products: readonly string[];
  readonly equation: ChemicalEquation;
  readonly types: readonly ReactionType[];
  readonly evidence: EvidenceLevel;
  readonly hazard: HazardLevel;
  readonly conditions: ReactionCondition;
  /** Por que el motor propone estos productos. */
  readonly explanation: string;
  /** Nombre de la regla que la genero, o 'curated'. */
  readonly rule: string;
  readonly observations: readonly string[];
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly concepts: readonly string[];
  /** Si hay varias alternativas, que las distingue. */
  readonly dependsOn?: string;
}

export interface PredictionResult {
  readonly predictions: readonly Prediction[];
  /** Mensaje cuando no se ha encontrado nada. */
  readonly message: string;
  /** Advertencia si el resultado depende de las condiciones (§32). */
  readonly conditionDependent: boolean;
}

interface Reagent {
  readonly formula: string;
  readonly classification: Classification;
  readonly composition: Map<string, number>;
  readonly charge: number;
}

function toReagent(formula: string): Reagent | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  return {
    formula,
    classification: classify(formula, parsed.value.composition, parsed.value.charge),
    composition: new Map(parsed.value.composition),
    charge: parsed.value.charge,
  };
}

/** Construye la prediccion, balanceandola. Devuelve null si no balancea. */
function makePrediction(
  base: Omit<Prediction, 'equation' | 'id'> & { id?: string },
): Prediction | null {
  const balanced = balanceFormulas(base.reactants, base.products);
  if (!balanced.ok) return null;

  const stateOf = (f: string) => getSpecies(f)?.properties.state ?? undefined;

  const equation: ChemicalEquation = {
    reactants: base.reactants.map((formula, i) => ({
      speciesId: formula,
      formula,
      coefficient: balanced.value.reactantCoefficients[i]!,
      state: stateOf(formula),
    })),
    products: base.products.map((formula, i) => ({
      speciesId: formula,
      formula,
      coefficient: balanced.value.productCoefficients[i]!,
      state: stateOf(formula),
    })),
    balanced: true,
  };

  return {
    ...base,
    id: base.id ?? `pred-${base.reactants.join('+')}-${base.products.join('+')}`,
    equation,
  };
}

const AMBIENT: ReactionCondition = {
  temperature: { value: 298.15, unit: 'K' },
  description: 'temperatura ambiente',
};

const AQUEOUS: ReactionCondition = {
  temperature: { value: 298.15, unit: 'K' },
  solvent: 'agua',
  description: 'en disolucion acuosa',
};

const isMetalSymbol = (s: string): boolean => {
  const el = getElement(s);
  return el !== undefined && METALLIC_CATEGORIES.has(el.category);
};

/** Peligrosidad conjunta: la mas alta de los participantes. */
function combinedHazard(formulas: readonly string[]): HazardLevel {
  const order: HazardLevel[] = ['safe', 'special-conditions', 'hazardous', 'do-not-attempt'];
  let worst = 0;
  for (const f of formulas) {
    const h = getSpecies(f)?.properties.hazard;
    if (!h) continue;
    worst = Math.max(worst, order.indexOf(h));
  }
  return order[worst]!;
}

// ---------------------------------------------------------------------------
// REGLA 0 — base de datos curada
// ---------------------------------------------------------------------------

function curatedMatches(reactantFormulas: readonly string[]): Prediction[] {
  const wanted = new Set(reactantFormulas);
  const out: Prediction[] = [];

  for (const r of REACTIONS) {
    const rxReactants = r.equation.reactants.map((t) => t.formula);
    // Coincidencia exacta del conjunto de reactivos.
    if (rxReactants.length !== wanted.size) continue;
    if (!rxReactants.every((f) => wanted.has(f))) continue;

    out.push({
      id: r.id,
      reactants: rxReactants,
      products: r.equation.products.map((t) => t.formula),
      equation: r.equation,
      types: r.types,
      evidence: r.evidence,
      hazard: r.hazard,
      conditions: r.conditions,
      explanation: r.explanation,
      rule: 'curated',
      observations: r.observations,
      difficulty: r.difficulty,
      concepts: r.concepts,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// REGLA 1 — neutralizacion acido + base
// ---------------------------------------------------------------------------

function ruleNeutralization(a: Reagent, b: Reagent): Prediction[] {
  const acid = isAcid(a.classification) ? a : isAcid(b.classification) ? b : null;
  const base = isBase(a.classification) ? a : isBase(b.classification) ? b : null;
  if (!acid || !base || acid === base) return [];

  const metal = base.classification.cationSymbol;
  if (!metal) return [];

  // El anion del acido: lo que queda al quitarle los hidrogenos.
  const anion = anionOfAcidFormula(acid.formula);
  if (!anion) return [];

  const cations = CATIONS_BY_ELEMENT.get(metal) ?? [];
  const out: Prediction[] = [];

  for (const cation of cations) {
    const salt = buildIonicFormula(cation, anion);
    if (!salt.ok) continue;

    const p = makePrediction({
      reactants: [acid.formula, base.formula],
      products: [salt.value.formula, 'H2O'],
      types: ['neutralization', 'acid-base', 'double-displacement'],
      evidence: 'predicted',
      hazard: combinedHazard([acid.formula, base.formula]),
      conditions: AQUEOUS,
      rule: 'neutralizacion',
      explanation:
        `${acid.formula} es un acido y ${base.formula} es una base. El H⁺ del acido y el OH⁻ de la base se combinan formando agua, ` +
        `que es un electrolito muy debil; esa es la fuerza motriz de la reaccion. El cation ${cation.name} y el anion ${anion.name} quedan en disolucion y constituyen la sal ${salt.value.display}. ` +
        `Comprobacion de neutralidad de la sal: ${salt.value.neutralityCheck}.`,
      observations: ['La mezcla se calienta', 'El pH se acerca a la neutralidad'],
      difficulty: 2,
      concepts: ['neutralizacion', 'acido-base', 'iones espectadores'],
      ...(cations.length > 1
        ? { dependsOn: `${metal} puede actuar con varios estados de oxidacion; aqui se ha supuesto ${cation.name}.` }
        : {}),
    });
    if (p) out.push(p);
  }

  return out;
}

/** Anion que resulta de quitar los protones acidos a la formula del acido. */
function anionOfAcidFormula(acidFormula: string) {
  // Primero se busca por el acido padre declarado en la base de iones.
  const direct = ANION_LIST.find((i) => i.parentAcid === acidFormula && !i.formula.startsWith('H'));
  if (direct) return direct;

  // Si no, se quitan los H iniciales y se busca el resto como anion.
  const rest = acidFormula.replace(/^H\d*/, '');
  const candidates = getIonsByFormula(rest).filter((i) => i.charge < 0);
  return candidates[0];
}

// ---------------------------------------------------------------------------
// REGLA 2 — doble sustitucion con precipitacion
// ---------------------------------------------------------------------------

function ruleDoubleDisplacement(a: Reagent, b: Reagent): Prediction[] {
  const sa = splitSalt(a.formula);
  const sb = splitSalt(b.formula);
  if (!sa || !sb) return [];
  if (sa.cation === sb.cation || sa.anion === sb.anion) return [];

  const out: Prediction[] = [];

  const cationsA = getIonsByFormula(sa.cation).filter((i) => i.charge > 0);
  const cationsB = getIonsByFormula(sb.cation).filter((i) => i.charge > 0);
  const anionA = getIonsByFormula(sa.anion).find((i) => i.charge < 0);
  const anionB = getIonsByFormula(sb.anion).find((i) => i.charge < 0);
  if (!anionA || !anionB) return [];

  for (const cA of cationsA) {
    for (const cB of cationsB) {
      const p1 = buildIonicFormula(cA, anionB);
      const p2 = buildIonicFormula(cB, anionA);
      if (!p1.ok || !p2.ok) continue;

      const s1 = solubilityOf(p1.value.formula);
      const s2 = solubilityOf(p2.value.formula);
      const precipitating =
        s1.solubility === 'insoluble' || s1.solubility === 'slightly-soluble'
          ? p1.value
          : s2.solubility === 'insoluble' || s2.solubility === 'slightly-soluble'
            ? p2.value
            : null;

      const types: ReactionType[] = precipitating
        ? ['precipitation', 'double-displacement']
        : ['double-displacement'];

      const explanation = precipitating
        ? `Los iones intercambian pareja. ${precipitating.display} es INSOLUBLE en agua, luego abandona la disolucion como precipitado: ` +
          `esa retirada de iones del medio es la fuerza motriz de la reaccion. ` +
          `Regla aplicada: ${(precipitating === p1.value ? s1 : s2).rule}`
        : `Los iones podrian intercambiar pareja, pero ambos productos posibles (${p1.value.display} y ${p2.value.display}) son solubles. ` +
          'Sin precipitado, sin gas y sin agua formada, NO HAY REACCION: los cuatro iones se quedan simplemente mezclados en disolucion.';

      const p = makePrediction({
        reactants: [a.formula, b.formula],
        products: [p1.value.formula, p2.value.formula],
        types,
        // Sin precipitado no hay reaccion: se marca como 'unknown' para que la
        // interfaz la presente como "lo que NO ocurre", no como un resultado.
        evidence: precipitating ? 'predicted' : 'unknown',
        hazard: combinedHazard([a.formula, b.formula]),
        conditions: AQUEOUS,
        rule: precipitating ? 'precipitacion' : 'doble sustitucion sin fuerza motriz',
        explanation,
        observations: precipitating
          ? [
              `Aparece un precipitado de ${precipitating.display}`,
              getSpecies(precipitating.formula)?.properties.appearance ?? '',
            ].filter(Boolean)
          : ['Sin cambio visible'],
        difficulty: 2,
        concepts: ['doble sustitucion', 'reglas de solubilidad', 'precipitacion', 'ecuacion ionica neta'],
      });
      if (p) out.push(p);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// REGLA 3 — sustitucion simple: metal + sal, metal + acido
// ---------------------------------------------------------------------------

function ruleSingleDisplacement(a: Reagent, b: Reagent): Prediction[] {
  // Identifica cual es el metal libre.
  const metalFirst = a.classification.compoundClass === 'element' && a.composition.size === 1;
  const metalReagent = metalFirst ? a : b.classification.compoundClass === 'element' ? b : null;
  const other = metalReagent === a ? b : a;
  if (!metalReagent || metalReagent === other) return [];

  const metalSymbol = [...metalReagent.composition.keys()][0]!;
  if (!isMetalSymbol(metalSymbol) || !isInActivitySeries(metalSymbol)) return [];

  const out: Prediction[] = [];

  // --- metal + acido -> sal + H2 ------------------------------------------
  if (isAcid(other.classification)) {
    const verdict = reactsWithAcid(metalSymbol);
    if (!verdict.displaces) {
      return []; // no hay reaccion; el motor lo dira en el mensaje general
    }
    const anion = anionOfAcidFormula(other.formula);
    if (!anion) return [];
    const cations = CATIONS_BY_ELEMENT.get(metalSymbol) ?? [];
    for (const cation of cations) {
      const salt = buildIonicFormula(cation, anion);
      if (!salt.ok) continue;
      const p = makePrediction({
        reactants: [metalReagent.formula, other.formula],
        products: [salt.value.formula, 'H2'],
        types: ['single-displacement', 'redox'],
        evidence: 'predicted',
        hazard: combinedHazard([metalReagent.formula, other.formula]),
        conditions: AQUEOUS,
        rule: 'sustitucion simple (metal + acido)',
        explanation: `${verdict.explanation} El metal se oxida y pasa a la disolucion como ${cation.name}, mientras el H⁺ del acido se reduce a hidrogeno gaseoso.`,
        observations: ['Burbujeo de hidrogeno', 'El metal se va consumiendo'],
        difficulty: 2,
        concepts: ['sustitucion simple', 'serie de actividad', 'redox'],
        ...(cations.length > 1
          ? { dependsOn: `${metalSymbol} tiene varios estados de oxidacion posibles; el producto real depende de las condiciones.` }
          : {}),
      });
      if (p) out.push(p);
    }
    return out;
  }

  // --- metal + sal -> sal' + metal' ---------------------------------------
  const salt = splitSalt(other.formula);
  if (!salt) return [];
  const otherMetal = salt.cation;
  if (!isInActivitySeries(otherMetal)) return [];

  const verdict = displaces(metalSymbol, otherMetal);
  if (!verdict.displaces) return [];

  const anion = getIonsByFormula(salt.anion).find((i) => i.charge < 0);
  if (!anion) return [];

  const cations = CATIONS_BY_ELEMENT.get(metalSymbol) ?? [];
  for (const cation of cations) {
    const newSalt = buildIonicFormula(cation, anion);
    if (!newSalt.ok) continue;
    const p = makePrediction({
      reactants: [metalReagent.formula, other.formula],
      products: [newSalt.value.formula, otherMetal],
      types: ['single-displacement', 'redox'],
      evidence: 'predicted',
      hazard: combinedHazard([metalReagent.formula, other.formula]),
      conditions: AQUEOUS,
      rule: 'sustitucion simple (metal + sal)',
      explanation: `${verdict.explanation} El ${metalSymbol} pasa a la disolucion y el ${otherMetal} se deposita como metal.`,
      observations: [`Se deposita ${otherMetal} metalico`, 'Cambia el color de la disolucion'],
      difficulty: 3,
      concepts: ['sustitucion simple', 'serie de actividad', 'redox', 'potencial de celda'],
    });
    if (p) out.push(p);
  }

  return out;
}

// ---------------------------------------------------------------------------
// REGLA 4 — oxido + agua
// ---------------------------------------------------------------------------

function ruleOxideWater(a: Reagent, b: Reagent): Prediction[] {
  const water = a.formula === 'H2O' ? a : b.formula === 'H2O' ? b : null;
  const oxide = water === a ? b : a;
  if (!water || oxide === water) return [];

  const cls = oxide.classification.compoundClass;
  const out: Prediction[] = [];

  // Oxido basico + agua -> hidroxido
  if (cls === 'basic-oxide') {
    const metal = oxide.classification.cationSymbol;
    if (!metal) return [];
    const hydroxideIon = getIon('OH', -1)!;
    const cations = CATIONS_BY_ELEMENT.get(metal) ?? [];
    for (const cation of cations) {
      const hydroxide = buildIonicFormula(cation, hydroxideIon);
      if (!hydroxide.ok) continue;
      const p = makePrediction({
        reactants: [oxide.formula, 'H2O'],
        products: [hydroxide.value.formula],
        types: ['synthesis', 'hydration'],
        evidence: 'predicted',
        hazard: combinedHazard([oxide.formula]),
        conditions: AMBIENT,
        rule: 'oxido basico + agua',
        explanation:
          `${oxide.formula} es un OXIDO BASICO. El ion O²⁻ es una base fuerte y capta un proton del agua, generando dos iones OH⁻. ` +
          `Regla general: oxido de metal + agua -> hidroxido. Resultado: ${hydroxide.value.display}. ` +
          `Neutralidad: ${hydroxide.value.neutralityCheck}.`,
        observations: ['La disolucion se vuelve basica', 'Suele desprenderse calor'],
        difficulty: 2,
        concepts: ['oxido basico', 'hidratacion', 'caracter acido-base de los oxidos'],
      });
      if (p) out.push(p);
    }
    return out;
  }

  // Oxido acido + agua -> oxoacido
  if (cls === 'acidic-oxide') {
    const central = [...oxide.composition.keys()].find((s) => s !== 'O');
    if (!central) return [];
    // Se buscan oxoacidos conocidos con ese elemento central.
    const candidates = ANION_LIST.filter(
      (i) => i.parentAcid && i.composition.has(central) && i.composition.has('O'),
    );
    for (const anion of candidates) {
      const acidFormula = anion.parentAcid!;
      const p = makePrediction({
        reactants: [oxide.formula, 'H2O'],
        products: [acidFormula],
        types: ['synthesis', 'hydration'],
        evidence: 'predicted',
        hazard: combinedHazard([oxide.formula, acidFormula]),
        conditions: AMBIENT,
        rule: 'oxido acido + agua',
        explanation:
          `${oxide.formula} es un OXIDO ACIDO (anhidrido). Con agua da el oxoacido correspondiente. ` +
          'Regla general: oxido de no metal + agua -> oxoacido. ' +
          'El estado de oxidacion del elemento central no cambia: solo se le anade agua.',
        observations: ['La disolucion se vuelve acida'],
        difficulty: 2,
        concepts: ['oxido acido', 'anhidrido', 'oxoacido'],
      });
      // Solo se acepta si conserva el estado de oxidacion del elemento central,
      // que es lo que distingue SO2 -> H2SO3 de SO2 -> H2SO4 (que exigiria
      // oxidacion y por tanto un oxidante adicional).
      if (p && sameCentralOxidationState(oxide.formula, acidFormula, central)) out.push(p);
    }
    return out;
  }

  return [];
}

/** ¿Tiene el elemento central el mismo estado de oxidacion en ambas especies? */
function sameCentralOxidationState(a: string, b: string, element: string): boolean {
  const oxA = oxidationOf(a, element);
  const oxB = oxidationOf(b, element);
  return oxA !== null && oxB !== null && Math.abs(oxA - oxB) < 1e-9;
}

function oxidationOf(formula: string, element: string): number | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  // Importado de forma perezosa para no crear un ciclo con oxidation.ts.
  const mod = oxidationModule;
  const r = mod.assignOxidationStates(parsed.value.composition, parsed.value.charge, formula);
  if (!r.ok) return null;
  return r.value.assignments.find((x) => x.symbol === element)?.state ?? null;
}

import * as oxidationModule from '../core/oxidation.js';

// ---------------------------------------------------------------------------
// REGLA 5 — oxido basico + oxido acido -> sal
// ---------------------------------------------------------------------------

function ruleOxideOxide(a: Reagent, b: Reagent): Prediction[] {
  const basic =
    a.classification.compoundClass === 'basic-oxide'
      ? a
      : b.classification.compoundClass === 'basic-oxide'
        ? b
        : null;
  const acidic =
    a.classification.compoundClass === 'acidic-oxide'
      ? a
      : b.classification.compoundClass === 'acidic-oxide'
        ? b
        : null;
  if (!basic || !acidic) return [];

  const metal = basic.classification.cationSymbol;
  const central = [...acidic.composition.keys()].find((s) => s !== 'O');
  if (!metal || !central) return [];

  const centralState = oxidationOf(acidic.formula, central);
  const anions = ANION_LIST.filter(
    (i) => i.composition.has(central) && i.composition.has('O') && i.composition.size === 2,
  ).filter((i) => {
    const st = oxidationOf(`H${Math.abs(i.charge)}${i.formula}`, central);
    return st !== null && centralState !== null && Math.abs(st - centralState) < 1e-9;
  });

  const out: Prediction[] = [];
  for (const anion of anions) {
    for (const cation of CATIONS_BY_ELEMENT.get(metal) ?? []) {
      const salt = buildIonicFormula(cation, anion);
      if (!salt.ok) continue;
      const p = makePrediction({
        reactants: [basic.formula, acidic.formula],
        products: [salt.value.formula],
        types: ['synthesis', 'acid-base'],
        evidence: 'predicted',
        hazard: combinedHazard([basic.formula, acidic.formula]),
        conditions: AMBIENT,
        rule: 'oxido basico + oxido acido',
        explanation:
          `Un oxido basico (${basic.formula}) y un oxido acido (${acidic.formula}) se combinan directamente dando la sal, sin necesidad de agua. ` +
          `Es la version "seca" de una neutralizacion: el O²⁻ basico se incorpora al oxoanion. Resultado: ${salt.value.display}.`,
        observations: [],
        difficulty: 3,
        concepts: ['oxido basico', 'oxido acido', 'sintesis'],
      });
      if (p) out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// REGLA 6 — combustion de un compuesto organico
// ---------------------------------------------------------------------------

function ruleCombustion(a: Reagent, b: Reagent): Prediction[] {
  const oxygen = a.formula === 'O2' ? a : b.formula === 'O2' ? b : null;
  const fuel = oxygen === a ? b : a;
  if (!oxygen || fuel === oxygen) return [];
  if (!fuel.composition.has('C') || !fuel.composition.has('H')) return [];

  const out: Prediction[] = [];

  const complete = makePrediction({
    reactants: [fuel.formula, 'O2'],
    products: ['CO2', 'H2O'],
    types: ['combustion', 'redox'],
    evidence: 'predicted',
    hazard: 'hazardous',
    conditions: { description: 'combustion COMPLETA, con exceso de oxigeno' },
    rule: 'combustion completa',
    explanation:
      'Con oxigeno suficiente, todo el carbono se oxida hasta CO2 y todo el hidrogeno hasta H2O. ' +
      'Es la combustion completa, la que libera mas energia.',
    observations: ['Llama azul', 'Desprendimiento de calor'],
    difficulty: 2,
    concepts: ['combustion', 'redox', 'balanceo'],
    dependsOn: 'La cantidad de oxigeno disponible decide el producto.',
  });
  if (complete) out.push(complete);

  const incomplete = makePrediction({
    reactants: [fuel.formula, 'O2'],
    products: ['CO', 'H2O'],
    types: ['combustion', 'redox'],
    evidence: 'predicted',
    hazard: 'do-not-attempt',
    conditions: { description: 'combustion INCOMPLETA, con oxigeno insuficiente' },
    rule: 'combustion incompleta',
    explanation:
      'Con oxigeno insuficiente el carbono solo llega a +2 y se forma monoxido de carbono, un gas inodoro y letal. ' +
      'Los mismos reactivos, distinto producto: la condicion no es un detalle.',
    observations: ['Llama amarillenta', 'Posible hollin'],
    difficulty: 3,
    concepts: ['combustion incompleta', 'efecto de las condiciones', 'seguridad'],
    dependsOn: 'La cantidad de oxigeno disponible decide el producto.',
  });
  if (incomplete) out.push(incomplete);

  return out;
}

// ---------------------------------------------------------------------------
// REGLA 7 — sintesis directa de dos elementos
// ---------------------------------------------------------------------------

function ruleDirectSynthesis(a: Reagent, b: Reagent): Prediction[] {
  if (a.classification.compoundClass !== 'element' || b.classification.compoundClass !== 'element') {
    return [];
  }
  const symA = [...a.composition.keys()][0]!;
  const symB = [...b.composition.keys()][0]!;
  if (symA === symB) return [];

  const aIsMetal = isMetalSymbol(symA);
  const bIsMetal = isMetalSymbol(symB);
  if (aIsMetal === bIsMetal) return []; // metal+metal o nometal+nometal: fuera de alcance

  const metal = aIsMetal ? symA : symB;
  const nonmetal = aIsMetal ? symB : symA;

  const cations = CATIONS_BY_ELEMENT.get(metal) ?? [];
  const anions = getIonsByFormula(nonmetal).filter((i) => i.charge < 0);
  if (cations.length === 0 || anions.length === 0) return [];

  const out: Prediction[] = [];
  for (const cation of cations) {
    for (const anion of anions) {
      const compound = buildIonicFormula(cation, anion);
      if (!compound.ok) continue;
      const p = makePrediction({
        reactants: [a.formula, b.formula],
        products: [compound.value.formula],
        types: ['synthesis', 'redox'],
        evidence: 'predicted',
        hazard: combinedHazard([a.formula, b.formula]),
        conditions: AMBIENT,
        rule: 'sintesis directa',
        explanation:
          `El ${metal} es un metal y cede electrones; el ${nonmetal} es un no metal y los capta. ` +
          `Se forman ${cation.formula}${cation.charge > 0 ? '⁺'.repeat(1) : ''} y el anion ${anion.name}, que se combinan en la proporcion que hace la formula neutra. ` +
          `${compound.value.neutralityCheck}. Resultado: ${compound.value.display}.`,
        observations: [],
        difficulty: 1,
        concepts: ['sintesis', 'enlace ionico', 'transferencia de electrones', 'estados de oxidacion'],
        ...(cations.length > 1
          ? {
              dependsOn:
                `El ${metal} puede actuar con varios estados de oxidacion (${cations.map((c) => c.name).join(', ')}). ` +
                'El producto real depende de la temperatura y de la proporcion de reactivos.',
            }
          : {}),
      });
      if (p) out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// REGLA 8 — acido + carbonato
// ---------------------------------------------------------------------------

function ruleAcidCarbonate(a: Reagent, b: Reagent): Prediction[] {
  const acid = isAcid(a.classification) ? a : isAcid(b.classification) ? b : null;
  const other = acid === a ? b : a;
  if (!acid || other === acid) return [];

  const salt = splitSalt(other.formula);
  if (!salt || (salt.anion !== 'CO3' && salt.anion !== 'HCO3')) return [];

  const anion = anionOfAcidFormula(acid.formula);
  if (!anion) return [];

  const cations = getIonsByFormula(salt.cation).filter((i) => i.charge > 0);
  const out: Prediction[] = [];

  for (const cation of cations) {
    const newSalt = buildIonicFormula(cation, anion);
    if (!newSalt.ok) continue;
    const p = makePrediction({
      reactants: [acid.formula, other.formula],
      products: [newSalt.value.formula, 'H2O', 'CO2'],
      types: ['acid-base', 'double-displacement'],
      evidence: 'predicted',
      hazard: combinedHazard([acid.formula, other.formula]),
      conditions: AQUEOUS,
      rule: 'acido + carbonato',
      explanation:
        'Un acido mas fuerte desplaza al acido carbonico de su sal. El H2CO3 formado es inestable y se descompone al instante en agua y CO2. ' +
        'El escape del gas retira producto del sistema y empuja la reaccion hasta completarse.',
      observations: ['Efervescencia', 'El solido se disuelve'],
      difficulty: 2,
      concepts: ['acido-base', 'desplazamiento de acido debil', 'Le Chatelier'],
    });
    if (p) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

type PairRule = (a: Reagent, b: Reagent) => Prediction[];

const PAIR_RULES: PairRule[] = [
  ruleNeutralization,
  ruleAcidCarbonate,
  ruleDoubleDisplacement,
  ruleSingleDisplacement,
  ruleOxideWater,
  ruleOxideOxide,
  ruleCombustion,
  ruleDirectSynthesis,
];

/**
 * Predice los productos de una mezcla de reactivos.
 *
 * Devuelve TODAS las alternativas plausibles, ordenadas: primero las curadas,
 * despues las predichas. Nunca elige una en silencio cuando hay varias (§32).
 */
export function predict(reactantFormulas: readonly string[]): PredictionResult {
  const unique = [...new Set(reactantFormulas.map((f) => f.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { predictions: [], message: 'No se ha indicado ningun reactivo.', conditionDependent: false };
  }

  // --- 0. base curada -----------------------------------------------------
  const curated = curatedMatches(unique);

  // --- 1. reglas por pares ------------------------------------------------
  const reagents = unique.map(toReagent).filter((r): r is Reagent => r !== null);
  if (reagents.length !== unique.length) {
    const bad = unique.filter((f) => toReagent(f) === null);
    return {
      predictions: curated,
      message: `No se han podido interpretar estas formulas: ${bad.join(', ')}.`,
      conditionDependent: false,
    };
  }

  const predicted: Prediction[] = [];
  for (let i = 0; i < reagents.length; i++) {
    for (let j = i + 1; j < reagents.length; j++) {
      for (const rule of PAIR_RULES) {
        predicted.push(...rule(reagents[i]!, reagents[j]!));
      }
    }
  }

  // Se descartan las predicciones que reproducen una reaccion ya curada.
  const curatedKeys = new Set(
    curated.map((p) => `${[...p.reactants].sort().join('+')}=>${[...p.products].sort().join('+')}`),
  );
  const deduped = new Map<string, Prediction>();
  for (const p of predicted) {
    const key = `${[...p.reactants].sort().join('+')}=>${[...p.products].sort().join('+')}`;
    if (curatedKeys.has(key)) continue;
    if (!deduped.has(key)) deduped.set(key, p);
  }

  const all = [...curated, ...deduped.values()];

  if (all.length === 0) {
    return {
      predictions: [],
      message: buildNoReactionMessage(reagents),
      conditionDependent: false,
    };
  }

  const conditionDependent =
    all.some((p) => p.dependsOn !== undefined) ||
    all.filter((p) => sameReactants(p, all[0]!)).length > 1;

  return {
    predictions: all,
    message: conditionDependent
      ? 'Hay mas de un producto posible: el resultado DEPENDE DE LAS CONDICIONES. Compara las alternativas antes de elegir.'
      : `Se ha encontrado ${all.length === 1 ? 'una transformacion' : `${all.length} transformaciones`}.`,
    conditionDependent,
  };
}

function sameReactants(a: Prediction, b: Prediction): boolean {
  return [...a.reactants].sort().join('+') === [...b.reactants].sort().join('+');
}

/** Mensaje util cuando no hay reaccion: dice POR QUE no la hay. */
function buildNoReactionMessage(reagents: readonly Reagent[]): string {
  if (reagents.length === 1) {
    return 'Con un unico reactivo solo cabe una descomposicion, y no hay ninguna curada para esta sustancia.';
  }

  // Caso instructivo: metal por debajo del hidrogeno frente a un acido.
  for (const a of reagents) {
    for (const b of reagents) {
      if (a === b) continue;
      if (a.classification.compoundClass !== 'element') continue;
      const sym = [...a.composition.keys()][0];
      if (!sym || !isInActivitySeries(sym)) continue;
      if (!isAcid(b.classification)) continue;
      const verdict = reactsWithAcid(sym);
      if (!verdict.displaces) {
        return `NO HAY REACCION. ${verdict.explanation}`;
      }
    }
  }

  // Caso instructivo: metal por debajo del otro en la serie de actividad.
  for (const a of reagents) {
    for (const b of reagents) {
      if (a === b) continue;
      if (a.classification.compoundClass !== 'element') continue;
      const sym = [...a.composition.keys()][0];
      if (!sym || !isInActivitySeries(sym)) continue;
      const salt = splitSalt(b.formula);
      if (!salt || !isInActivitySeries(salt.cation)) continue;
      const verdict = displaces(sym, salt.cation);
      if (!verdict.displaces && verdict.cellPotential !== null) {
        return `NO HAY REACCION. ${verdict.explanation}`;
      }
    }
  }

  // Caso instructivo: doble sustitucion sin precipitado.
  const salts = reagents.map((r) => splitSalt(r.formula)).filter((s): s is NonNullable<typeof s> => s !== null);
  if (salts.length >= 2) {
    return (
      'NO HAY REACCION APRECIABLE. Los iones podrian intercambiar pareja, pero todos los productos posibles son solubles: ' +
      'no se forma precipitado, ni gas, ni agua. Sin una fuerza motriz que retire iones del medio, los cuatro iones se quedan mezclados en disolucion.'
    );
  }

  return (
    'El motor no ha encontrado ninguna transformacion conocida ni ninguna regla aplicable a esta combinacion. ' +
    'Eso NO significa que sea imposible: significa que este sistema no tiene informacion suficiente, y prefiere decirlo antes que inventar un producto.'
  );
}

/** Predicciones disponibles para una sola sustancia (§20). */
export function reactionsAvailableFor(formula: string): readonly Prediction[] {
  const out: Prediction[] = [];
  for (const r of REACTIONS) {
    if (!r.equation.reactants.some((t) => t.formula === formula)) continue;
    out.push({
      id: r.id,
      reactants: r.equation.reactants.map((t) => t.formula),
      products: r.equation.products.map((t) => t.formula),
      equation: r.equation,
      types: r.types,
      evidence: r.evidence,
      hazard: r.hazard,
      conditions: r.conditions,
      explanation: r.explanation,
      rule: 'curated',
      observations: r.observations,
      difficulty: r.difficulty,
      concepts: r.concepts,
    });
  }
  return out;
}
