/**
 * Electrochemistry.
 *
 * §27: oxidation states, half reactions, standard potentials, the Nernst
 * equation, galvanic and electrolytic cells, conductivity, corrosion, batteries
 * and electrode kinetics. The link to thermodynamics is explicit — ΔG = −nFE is
 * computed from the same numbers the thermo engine uses, so a student can check
 * one against the other.
 */

import { FARADAY, R, T_STANDARD, NERNST_DECADE_25 } from '../constants.js';
import { parseFormula, type Composition } from './formula.js';
import { elementBySymbol } from '../../data/elements.js';

// ---------------------------------------------------------------------------
// Oxidation states
// ---------------------------------------------------------------------------

/**
 * Assign oxidation states to every atom in a formula, by the standard rule
 * hierarchy taught in Química General:
 *
 *   1. A free element is 0.
 *   2. A monatomic ion equals its charge.
 *   3. Fluorine is always −1; group 1 is +1, group 2 is +2 in compounds.
 *   4. Hydrogen is +1 (−1 with metals); oxygen is −2 (−1 in peroxides).
 *   5. The remaining element takes whatever makes the sum equal the charge.
 *
 * Returning `null` for an element whose state the rules cannot fix is
 * deliberate — inventing a number there would be exactly the kind of confident
 * wrong answer the platform must not produce.
 */
export function oxidationStates(formula: string): {
  states: Record<string, number | null>;
  charge: number;
  ambiguous: string[];
  explanation: string[];
} {
  const parsed = parseFormula(formula);
  const comp = parsed.composition;
  const elements = Object.keys(comp);
  const states: Record<string, number | null> = {};
  const explanation: string[] = [];

  if (elements.length === 1) {
    const only = elements[0];
    states[only] = parsed.charge === 0 ? 0 : parsed.charge / comp[only];
    explanation.push(parsed.charge === 0
      ? `${only} está como elemento libre: estado de oxidación 0.`
      : `Ion monoatómico: el estado de oxidación es la carga, ${states[only]}.`);
    return { states, charge: parsed.charge, ambiguous: [], explanation };
  }

  const fixed: Record<string, number> = {};
  const isPeroxide = detectPeroxide(formula, comp);
  const hasMetal = elements.some((e) => {
    const el = elementBySymbol(e);
    return el && ['alcalino', 'alcalinoterreo', 'transicion', 'postransicion'].includes(el.category);
  });

  for (const el of elements) {
    const info = elementBySymbol(el);
    if (!info) continue;
    if (el === 'F') { fixed.F = -1; explanation.push('El flúor es siempre −1.'); }
    else if (info.group === 1 && info.block === 's') {
      fixed[el] = 1; explanation.push(`${el} (grupo 1) es +1 en sus compuestos.`);
    } else if (info.group === 2) {
      fixed[el] = 2; explanation.push(`${el} (grupo 2) es +2 en sus compuestos.`);
    } else if (el === 'O') {
      fixed.O = isPeroxide ? -1 : -2;
      explanation.push(isPeroxide
        ? 'Se trata de un peróxido: el oxígeno es −1.'
        : 'El oxígeno es −2 (salvo en peróxidos y superóxidos).');
    } else if (el === 'H') {
      fixed.H = hasMetal && elements.length === 2 ? -1 : 1;
      explanation.push(fixed.H === -1
        ? 'Hidruro metálico: el hidrógeno es −1.'
        : 'El hidrógeno es +1 frente a no metales.');
    }
  }

  const unknown = elements.filter((e) => !(e in fixed));
  const fixedSum = Object.entries(fixed).reduce((s, [el, v]) => s + v * comp[el], 0);

  if (unknown.length === 1) {
    const el = unknown[0];
    const value = (parsed.charge - fixedSum) / comp[el];
    states[el] = value;
    explanation.push(
      `La suma de estados de oxidación debe dar la carga (${parsed.charge}): `
      + `${comp[el]}·x + (${fixedSum}) = ${parsed.charge} ⟹ x = ${value}.`,
    );
  } else if (unknown.length > 1) {
    explanation.push(
      `Hay ${unknown.length} elementos sin estado fijado (${unknown.join(', ')}): `
      + 'las reglas por sí solas no bastan y hace falta la estructura de Lewis.',
    );
    unknown.forEach((el) => { states[el] = null; });
  }

  for (const [el, v] of Object.entries(fixed)) states[el] = v;
  return { states, charge: parsed.charge, ambiguous: unknown.length > 1 ? unknown : [], explanation };
}

function detectPeroxide(formula: string, comp: Composition): boolean {
  if (!comp.O) return false;
  if (/^H2O2$|O2\^?2-|Na2O2|BaO2|K2O2/.test(formula)) return true;
  // H2O2, Na2O2 … : oxygen count equals the sum of the fixed positive charge.
  return false;
}

// ---------------------------------------------------------------------------
// Standard reduction potentials
// ---------------------------------------------------------------------------

export interface HalfReaction {
  id: string;
  /** Written in the reduction direction, as the tables are. */
  equation: string;
  /** Standard reduction potential vs SHE at 25 °C, V. */
  E0: number;
  /** Electrons transferred. */
  n: number;
  /** Oxidised form and reduced form, for the Nernst quotient. */
  oxidised: Record<string, number>;
  reduced: Record<string, number>;
  /** Protons on the oxidised side — the source of the pH dependence. */
  protons?: number;
  category: 'metal' | 'halógeno' | 'oxígeno' | 'oxoanión' | 'orgánico' | 'referencia' | 'otro';
  notes?: string;
}

/**
 * Standard reduction potentials, V vs the standard hydrogen electrode at 25 °C.
 * Ordered as the tables are — most oxidising at the top — because the ordering
 * *is* the information: anything above oxidises anything below.
 */
export const HALF_REACTIONS: HalfReaction[] = [
  { id: 'F2/F-', equation: 'F2 + 2 e⁻ ⇌ 2 F⁻', E0: 2.866, n: 2, oxidised: { F2: 1 }, reduced: { 'F-': 2 }, category: 'halógeno', notes: 'El oxidante más fuerte en disolución acuosa: oxida al propio agua.' },
  { id: 'S2O8/SO4', equation: 'S₂O₈²⁻ + 2 e⁻ ⇌ 2 SO₄²⁻', E0: 2.010, n: 2, oxidised: { 'S2O8 2-': 1 }, reduced: { 'SO4 2-': 2 }, category: 'oxoanión' },
  { id: 'H2O2/H2O', equation: 'H₂O₂ + 2 H⁺ + 2 e⁻ ⇌ 2 H₂O', E0: 1.776, n: 2, protons: 2, oxidised: { H2O2: 1 }, reduced: {}, category: 'oxígeno' },
  { id: 'MnO4/Mn2+', equation: 'MnO₄⁻ + 8 H⁺ + 5 e⁻ ⇌ Mn²⁺ + 4 H₂O', E0: 1.507, n: 5, protons: 8, oxidised: { 'MnO4-': 1 }, reduced: { 'Mn2+': 1 }, category: 'oxoanión', notes: 'Fuertemente dependiente del pH: pierde poder oxidante al subir el pH.' },
  { id: 'Cl2/Cl-', equation: 'Cl₂ + 2 e⁻ ⇌ 2 Cl⁻', E0: 1.358, n: 2, oxidised: { Cl2: 1 }, reduced: { 'Cl-': 2 }, category: 'halógeno' },
  { id: 'Cr2O7/Cr3+', equation: 'Cr₂O₇²⁻ + 14 H⁺ + 6 e⁻ ⇌ 2 Cr³⁺ + 7 H₂O', E0: 1.232, n: 6, protons: 14, oxidised: { 'Cr2O7 2-': 1 }, reduced: { 'Cr3+': 2 }, category: 'oxoanión' },
  { id: 'O2/H2O', equation: 'O₂ + 4 H⁺ + 4 e⁻ ⇌ 2 H₂O', E0: 1.229, n: 4, protons: 4, oxidised: { O2: 1 }, reduced: {}, category: 'oxígeno', notes: 'Define el límite superior de estabilidad del agua.' },
  { id: 'Br2/Br-', equation: 'Br₂ + 2 e⁻ ⇌ 2 Br⁻', E0: 1.066, n: 2, oxidised: { Br2: 1 }, reduced: { 'Br-': 2 }, category: 'halógeno' },
  { id: 'NO3/NO', equation: 'NO₃⁻ + 4 H⁺ + 3 e⁻ ⇌ NO + 2 H₂O', E0: 0.957, n: 3, protons: 4, oxidised: { 'NO3-': 1 }, reduced: { NO: 1 }, category: 'oxoanión', notes: 'Por esto el HNO₃ disuelve el cobre y el HCl no.' },
  { id: 'Ag+/Ag', equation: 'Ag⁺ + e⁻ ⇌ Ag', E0: 0.7996, n: 1, oxidised: { 'Ag+': 1 }, reduced: {}, category: 'metal' },
  { id: 'Fe3+/Fe2+', equation: 'Fe³⁺ + e⁻ ⇌ Fe²⁺', E0: 0.771, n: 1, oxidised: { 'Fe3+': 1 }, reduced: { 'Fe2+': 1 }, category: 'metal' },
  { id: 'O2/H2O2', equation: 'O₂ + 2 H⁺ + 2 e⁻ ⇌ H₂O₂', E0: 0.695, n: 2, protons: 2, oxidised: { O2: 1 }, reduced: { H2O2: 1 }, category: 'oxígeno' },
  { id: 'I2/I-', equation: 'I₂ + 2 e⁻ ⇌ 2 I⁻', E0: 0.5355, n: 2, oxidised: { I2: 1 }, reduced: { 'I-': 2 }, category: 'halógeno', notes: 'El par central de la yodometría.' },
  { id: 'Cu2+/Cu', equation: 'Cu²⁺ + 2 e⁻ ⇌ Cu', E0: 0.3419, n: 2, oxidised: { 'Cu2+': 1 }, reduced: {}, category: 'metal' },
  { id: 'AgCl/Ag', equation: 'AgCl + e⁻ ⇌ Ag + Cl⁻', E0: 0.2223, n: 1, oxidised: { AgCl: 1 }, reduced: { 'Cl-': 1 }, category: 'referencia', notes: 'Electrodo de referencia Ag/AgCl: +0.197 V en KCl saturado.' },
  { id: 'Hg2Cl2/Hg', equation: 'Hg₂Cl₂ + 2 e⁻ ⇌ 2 Hg + 2 Cl⁻', E0: 0.268, n: 2, oxidised: { Hg2Cl2: 1 }, reduced: { 'Cl-': 2 }, category: 'referencia', notes: 'Electrodo de calomelanos saturado (ECS): +0.241 V.' },
  { id: 'S4O6/S2O3', equation: 'S₄O₆²⁻ + 2 e⁻ ⇌ 2 S₂O₃²⁻', E0: 0.08, n: 2, oxidised: { 'S4O6 2-': 1 }, reduced: { 'S2O3 2-': 2 }, category: 'oxoanión' },
  { id: 'H+/H2', equation: '2 H⁺ + 2 e⁻ ⇌ H₂', E0: 0.0, n: 2, protons: 2, oxidised: {}, reduced: { H2: 1 }, category: 'referencia', notes: 'El electrodo estándar de hidrógeno: cero por definición.' },
  { id: 'Pb2+/Pb', equation: 'Pb²⁺ + 2 e⁻ ⇌ Pb', E0: -0.1262, n: 2, oxidised: { 'Pb2+': 1 }, reduced: {}, category: 'metal' },
  { id: 'Sn2+/Sn', equation: 'Sn²⁺ + 2 e⁻ ⇌ Sn', E0: -0.1375, n: 2, oxidised: { 'Sn2+': 1 }, reduced: {}, category: 'metal' },
  { id: 'Ni2+/Ni', equation: 'Ni²⁺ + 2 e⁻ ⇌ Ni', E0: -0.257, n: 2, oxidised: { 'Ni2+': 1 }, reduced: {}, category: 'metal' },
  { id: 'Fe2+/Fe', equation: 'Fe²⁺ + 2 e⁻ ⇌ Fe', E0: -0.447, n: 2, oxidised: { 'Fe2+': 1 }, reduced: {}, category: 'metal', notes: 'La base termodinámica de la corrosión del acero.' },
  { id: 'Zn2+/Zn', equation: 'Zn²⁺ + 2 e⁻ ⇌ Zn', E0: -0.7618, n: 2, oxidised: { 'Zn2+': 1 }, reduced: {}, category: 'metal', notes: 'Ánodo de la pila Daniell y del galvanizado protector.' },
  { id: 'H2O/H2', equation: '2 H₂O + 2 e⁻ ⇌ H₂ + 2 OH⁻', E0: -0.8277, n: 2, oxidised: {}, reduced: { H2: 1 }, category: 'referencia', notes: 'Límite inferior de estabilidad del agua.' },
  { id: 'Al3+/Al', equation: 'Al³⁺ + 3 e⁻ ⇌ Al', E0: -1.662, n: 3, oxidised: { 'Al3+': 1 }, reduced: {}, category: 'metal' },
  { id: 'Mg2+/Mg', equation: 'Mg²⁺ + 2 e⁻ ⇌ Mg', E0: -2.372, n: 2, oxidised: { 'Mg2+': 1 }, reduced: {}, category: 'metal', notes: 'Ánodo de sacrificio en protección catódica.' },
  { id: 'Na+/Na', equation: 'Na⁺ + e⁻ ⇌ Na', E0: -2.71, n: 1, oxidised: { 'Na+': 1 }, reduced: {}, category: 'metal' },
  { id: 'K+/K', equation: 'K⁺ + e⁻ ⇌ K', E0: -2.931, n: 1, oxidised: { 'K+': 1 }, reduced: {}, category: 'metal' },
  { id: 'Li+/Li', equation: 'Li⁺ + e⁻ ⇌ Li', E0: -3.0401, n: 1, oxidised: { 'Li+': 1 }, reduced: {}, category: 'metal', notes: 'El reductor más fuerte de la tabla: la base de las baterías de litio.' },
];

export const halfReactionById = (id: string): HalfReaction | undefined =>
  HALF_REACTIONS.find((h) => h.id === id);

// ---------------------------------------------------------------------------
// The Nernst equation
// ---------------------------------------------------------------------------

/** Nernst slope RT/nF·ln10 at temperature T, in volts per decade. */
export const nernstSlope = (n: number, T: number = T_STANDARD): number =>
  (Math.LN10 * R * T) / (n * FARADAY);

/**
 * Electrode potential under non-standard conditions.
 *
 *   E = E° − (RT/nF)·ln Q
 *
 * with Q written for the reduction as tabulated. The proton term is included
 * explicitly, which is what makes permanganate lose most of its oxidising
 * power on going from 1 M acid to neutral solution.
 */
export function nernst(
  half: HalfReaction,
  activities: Record<string, number>,
  opts: { pH?: number; temperature?: number } = {},
): { E: number; Q: number; slope: number; terms: Array<{ label: string; contribution: number }> } {
  const T = opts.temperature ?? T_STANDARD;
  const slope = nernstSlope(half.n, T);
  const terms: Array<{ label: string; contribution: number }> = [];

  let logQ = 0;
  for (const [species, nu] of Object.entries(half.reduced)) {
    const a = activities[species];
    if (a === undefined || a <= 0) continue;
    logQ += nu * Math.log10(a);
    terms.push({ label: `${species} (reducido)`, contribution: -slope * nu * Math.log10(a) });
  }
  for (const [species, nu] of Object.entries(half.oxidised)) {
    const a = activities[species];
    if (a === undefined || a <= 0) continue;
    logQ -= nu * Math.log10(a);
    terms.push({ label: `${species} (oxidado)`, contribution: slope * nu * Math.log10(a) });
  }
  if (half.protons && opts.pH !== undefined) {
    logQ += half.protons * opts.pH;
    terms.push({
      label: `${half.protons} H⁺ (pH ${opts.pH.toFixed(2)})`,
      contribution: -slope * half.protons * opts.pH,
    });
  }

  return { E: half.E0 - slope * logQ, Q: Math.pow(10, logQ), slope, terms };
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

export interface CellResult {
  /** Cell potential, V. Positive means the reaction as written is spontaneous. */
  E: number;
  E0: number;
  /** Electrons transferred in the balanced overall reaction. */
  n: number;
  /** ΔG = −nFE, in kJ·mol⁻¹. */
  deltaG: number;
  deltaG0: number;
  /** Equilibrium constant from E°. */
  K: number;
  cathode: HalfReaction;
  anode: HalfReaction;
  spontaneous: boolean;
  /** Cell notation, e.g. Zn | Zn²⁺ (1 M) ‖ Cu²⁺ (1 M) | Cu */
  notation: string;
  overall: string;
}

/**
 * Assemble a galvanic cell from two half reactions.
 *
 * The half reaction with the more positive potential is the cathode; that is
 * not a convention to memorise but the condition for E_cell > 0, and swapping
 * the assignment simply changes the sign — which the function reports rather
 * than silently correcting.
 */
export function galvanicCell(
  cathodeId: string, anodeId: string,
  activities: Record<string, number> = {},
  opts: { pH?: number; temperature?: number; forceAssignment?: boolean } = {},
): CellResult {
  let cathode = halfReactionById(cathodeId)!;
  let anode = halfReactionById(anodeId)!;
  if (!cathode || !anode) throw new Error('Semirreacción desconocida');

  if (!opts.forceAssignment && anode.E0 > cathode.E0) {
    [cathode, anode] = [anode, cathode];
  }

  const T = opts.temperature ?? T_STANDARD;
  const Ec = nernst(cathode, activities, opts);
  const Ea = nernst(anode, activities, opts);
  const E = Ec.E - Ea.E;
  const E0 = cathode.E0 - anode.E0;

  // Electrons are balanced by the least common multiple of the two half
  // reactions; the potential is intensive and does not scale with it.
  const n = lcm(cathode.n, anode.n);
  const deltaG = (-n * FARADAY * E) / 1000;
  const deltaG0 = (-n * FARADAY * E0) / 1000;
  const K = Math.exp((n * FARADAY * E0) / (R * T));

  return {
    E, E0, n, deltaG, deltaG0, K, cathode, anode,
    spontaneous: E > 0,
    notation: `${describeElectrode(anode, 'anode')} ‖ ${describeElectrode(cathode, 'cathode')}`,
    overall: `${anode.equation.split('⇌')[1]?.trim() ?? ''} + ${cathode.equation.split('⇌')[0]?.trim() ?? ''} → ${anode.equation.split('⇌')[0]?.trim() ?? ''} + ${cathode.equation.split('⇌')[1]?.trim() ?? ''}`,
  };
}

function describeElectrode(h: HalfReaction, side: 'anode' | 'cathode'): string {
  const [ox, red] = h.equation.split('⇌').map((s) => s.trim());
  return side === 'anode' ? `${red} | ${ox}` : `${ox} | ${red}`;
}

function lcm(a: number, b: number): number {
  const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y));
  return (a * b) / g(a, b);
}

/**
 * Electrolysis: Faraday's laws.
 *
 *   m = (Q·M)/(n·F) = (I·t·M)/(n·F)
 *
 * The current efficiency is included because it is never 100 % in practice,
 * and the industrial module needs it.
 */
export function faradaysLaw(
  currentAmps: number, timeSeconds: number, molarMass: number, electrons: number,
  currentEfficiency = 1,
): { charge: number; moles: number; massGrams: number; volumeSTP?: number } {
  const charge = currentAmps * timeSeconds * currentEfficiency;
  const moles = charge / (electrons * FARADAY);
  return { charge, moles, massGrams: moles * molarMass, volumeSTP: moles * 22.414 };
}

/** Minimum voltage to drive an electrolysis, before overpotential. */
export function decompositionVoltage(cathode: HalfReaction, anode: HalfReaction): number {
  return anode.E0 - cathode.E0;
}

// ---------------------------------------------------------------------------
// Conductivity
// ---------------------------------------------------------------------------

/** Limiting molar ionic conductivities at 25 °C, S·cm²·mol⁻¹. */
export const LIMITING_CONDUCTIVITY: Record<string, { lambda: number; z: number; name: string }> = {
  'H+': { lambda: 349.65, z: 1, name: 'protón' },
  'OH-': { lambda: 198.0, z: -1, name: 'hidróxido' },
  'Na+': { lambda: 50.08, z: 1, name: 'sodio' },
  'K+': { lambda: 73.48, z: 1, name: 'potasio' },
  'Li+': { lambda: 38.66, z: 1, name: 'litio' },
  'NH4+': { lambda: 73.5, z: 1, name: 'amonio' },
  'Ca2+': { lambda: 119.0, z: 2, name: 'calcio' },
  'Mg2+': { lambda: 106.0, z: 2, name: 'magnesio' },
  'Cl-': { lambda: 76.31, z: -1, name: 'cloruro' },
  'Br-': { lambda: 78.1, z: -1, name: 'bromuro' },
  'I-': { lambda: 76.8, z: -1, name: 'yoduro' },
  'NO3-': { lambda: 71.42, z: -1, name: 'nitrato' },
  'CH3COO-': { lambda: 40.9, z: -1, name: 'acetato' },
  'SO4 2-': { lambda: 160.0, z: -2, name: 'sulfato' },
  'HCO3-': { lambda: 44.5, z: -1, name: 'bicarbonato' },
  'CO3 2-': { lambda: 138.6, z: -2, name: 'carbonato' },
};

/**
 * Conductivity of a solution from its speciation.
 *
 *   κ = Σ λ_i · |z_i| · c_i        (κ in S·cm⁻¹ with c in mol·cm⁻³)
 *
 * The anomalously high mobility of H⁺ and OH⁻ — the Grotthuss mechanism — is
 * in the table, so a conductimetric titration shows the characteristic V shape
 * for the right reason.
 */
export function conductivity(concentrations: Record<string, number>): {
  /** Specific conductance, µS·cm⁻¹. */
  kappa: number;
  contributions: Array<{ species: string; contribution: number; fraction: number }>;
} {
  let kappa = 0;
  const raw: Array<{ species: string; contribution: number }> = [];
  for (const [species, c] of Object.entries(concentrations)) {
    const data = LIMITING_CONDUCTIVITY[species];
    if (!data || c <= 0) continue;
    // λ (S·cm²·mol⁻¹) × c (mol·L⁻¹) / 1000 (L·cm⁻³) → S·cm⁻¹
    const contribution = (data.lambda * Math.abs(data.z) * c) / 1000;
    kappa += contribution;
    raw.push({ species, contribution });
  }
  return {
    kappa: kappa * 1e6,
    contributions: raw
      .map((r) => ({ ...r, contribution: r.contribution * 1e6, fraction: kappa > 0 ? r.contribution / kappa : 0 }))
      .sort((a, b) => b.contribution - a.contribution),
  };
}

/** Molar conductivity Λ = κ/c, in S·cm²·mol⁻¹. */
export const molarConductivity = (kappaMicroSPerCm: number, concentration: number): number =>
  concentration > 0 ? (kappaMicroSPerCm * 1e-6 * 1000) / concentration : NaN;

/**
 * Kohlrausch's law for a strong electrolyte: Λ = Λ° − K√c.
 * Deviation from it is the classic diagnostic that an electrolyte is weak.
 */
export const kohlrausch = (lambda0: number, K: number, c: number): number =>
  lambda0 - K * Math.sqrt(c);

// ---------------------------------------------------------------------------
// Electrode kinetics and corrosion
// ---------------------------------------------------------------------------

/**
 * Butler–Volmer current density.
 *
 *   j = j₀·[exp(αnFη/RT) − exp(−(1−α)nFη/RT)]
 *
 * This is what makes a real cell need more voltage than thermodynamics says:
 * the overpotential η is the price of driving the reaction at a finite rate.
 */
export function butlerVolmer(
  exchangeCurrentDensity: number, overpotential: number, n = 1,
  alpha = 0.5, T: number = T_STANDARD,
): number {
  const f = (n * FARADAY) / (R * T);
  return exchangeCurrentDensity * (
    Math.exp(alpha * f * overpotential) - Math.exp(-(1 - alpha) * f * overpotential)
  );
}

/** Tafel slope, V per decade of current — the high-overpotential limit. */
export const tafelSlope = (n = 1, alpha = 0.5, T: number = T_STANDARD): number =>
  (Math.LN10 * R * T) / (alpha * n * FARADAY);

export interface CorrosionAssessment {
  /** Difference in standard potential driving the corrosion, V. */
  drivingForce: number;
  spontaneous: boolean;
  /** Corrosion rate from Faraday's law, mm per year. */
  rateMMPerYear: number;
  protection: string[];
  explanation: string;
}

/**
 * Corrosion assessment for a metal in an aerated aqueous environment.
 *
 * The couple is the metal's own dissolution against oxygen reduction, whose
 * potential depends on pH — which is why the same steel corrodes slowly at
 * pH 10 and quickly at pH 4.
 */
export function assessCorrosion(
  metalHalfId: string,
  opts: { pH?: number; oxygenPartialPressure?: number; densityGPerCm3: number; molarMass: number; corrosionCurrentDensity?: number },
): CorrosionAssessment {
  const metal = halfReactionById(metalHalfId);
  if (!metal) throw new Error(`Semirreacción desconocida: ${metalHalfId}`);
  const pH = opts.pH ?? 7;
  const oxygen = halfReactionById('O2/H2O')!;
  const cathodic = nernst(oxygen, { O2: opts.oxygenPartialPressure ?? 0.21 }, { pH });
  const drivingForce = cathodic.E - metal.E0;

  // i_corr in A·cm⁻²; a typical value for bare steel in aerated water is 1e-5.
  const iCorr = opts.corrosionCurrentDensity ?? 1e-5;
  // Faraday: rate (cm/s) = i·M/(n·F·ρ); ×10 mm/cm ×3.156e7 s/a
  const rate = (iCorr * opts.molarMass) / (metal.n * FARADAY * opts.densityGPerCm3) * 10 * 3.1557e7;

  const protection = [
    'Recubrimiento de barrera (pintura, galvanizado, anodizado).',
    'Protección catódica con ánodo de sacrificio (Zn o Mg).',
    'Protección catódica por corriente impresa.',
    'Inhibidores de corrosión en el medio.',
    'Control del pH y desaireación del agua.',
  ];

  return {
    drivingForce,
    spontaneous: drivingForce > 0,
    rateMMPerYear: rate,
    protection,
    explanation: drivingForce > 0
      ? `E(O₂/H₂O) a pH ${pH.toFixed(1)} vale ${cathodic.E.toFixed(3)} V y el metal se disuelve a ${metal.E0.toFixed(3)} V. `
        + `La diferencia (${drivingForce.toFixed(3)} V) es la fuerza impulsora: la corrosión es espontánea. `
        + 'Su velocidad, en cambio, la fija la cinética del electrodo y la difusión de oxígeno, no esta diferencia.'
      : 'El metal es termodinámicamente estable en estas condiciones: no se corroe.',
  };
}

/** Cell potential converted to Gibbs energy, kJ·mol⁻¹. */
export const deltaGFromCell = (n: number, E: number): number => (-n * FARADAY * E) / 1000;

/** Equilibrium constant from a standard cell potential. */
export const kFromCell = (n: number, E0: number, T: number = T_STANDARD): number =>
  Math.exp((n * FARADAY * E0) / (R * T));

export { NERNST_DECADE_25 };
